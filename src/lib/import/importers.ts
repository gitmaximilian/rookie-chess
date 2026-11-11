import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';

export type Source = 'lichess' | 'chesscom';

export interface ImportedGame {
	externalId: string;
	source: Source;
	pgn: string;
	date: number;
	white: string;
	black: string;
	result: GameRow['result'];
	whiteRating?: number;
	blackRating?: number;
	speed?: string;
}

export class ImportError extends Error {
	constructor(public code: 'notFound' | 'network' | 'none' | 'rateLimit') {
		super(code);
	}
}

function result(r: string | undefined): GameRow['result'] {
	return r === '1-0' || r === '0-1' || r === '1/2-1/2' ? r : '*';
}

function header(pgn: string, key: string): string | undefined {
	return pgn.match(new RegExp(`\\[${key}\\s+"([^"]*)"\\]`))?.[1];
}

/** Lichess NDJSON (pgnInJson=true) → Partien */
export function parseLichessNdjson(text: string): ImportedGame[] {
	const out: ImportedGame[] = [];
	for (const line of text.split('\n')) {
		if (!line.trim()) continue;
		let g: {
			id: string;
			variant?: string;
			createdAt?: number;
			pgn?: string;
			speed?: string;
			players?: {
				white?: { user?: { name?: string }; rating?: number };
				black?: { user?: { name?: string }; rating?: number };
			};
		};
		try {
			g = JSON.parse(line);
		} catch {
			continue;
		}
		if (!g.pgn || (g.variant && g.variant !== 'standard')) continue;
		out.push({
			externalId: `lichess:${g.id}`,
			source: 'lichess',
			pgn: g.pgn,
			date: g.createdAt ?? Date.now(),
			white: g.players?.white?.user?.name ?? header(g.pgn, 'White') ?? '?',
			black: g.players?.black?.user?.name ?? header(g.pgn, 'Black') ?? '?',
			result: result(header(g.pgn, 'Result')),
			whiteRating: g.players?.white?.rating,
			blackRating: g.players?.black?.rating,
			speed: g.speed
		});
	}
	return out;
}

interface ChessComGame {
	url: string;
	pgn?: string;
	end_time: number;
	rules: string;
	time_class?: string;
	white: { username: string; rating?: number };
	black: { username: string; rating?: number };
}

/** Chess.com Monatsarchiv → Partien (nur Standardschach) */
export function parseChessComMonth(json: { games?: ChessComGame[] }): ImportedGame[] {
	return (json.games ?? [])
		.filter((g) => g.rules === 'chess' && g.pgn)
		.map((g) => ({
			externalId: `chesscom:${g.url}`,
			source: 'chesscom' as const,
			pgn: g.pgn!,
			date: g.end_time * 1000,
			white: g.white.username,
			black: g.black.username,
			result: result(header(g.pgn!, 'Result')),
			whiteRating: g.white.rating,
			blackRating: g.black.rating,
			speed: g.time_class
		}));
}

export async function fetchLichess(
	user: string,
	max: number,
	fetcher: typeof fetch = fetch,
	since?: number
): Promise<ImportedGame[]> {
	let res: Response;
	try {
		res = await fetcher(
			`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${max}&pgnInJson=true&moves=true&clocks=false&evals=false&opening=false${since ? `&since=${since}` : ''}`,
			{ headers: { Accept: 'application/x-ndjson' } }
		);
	} catch {
		throw new ImportError('network');
	}
	if (res.status === 404) throw new ImportError('notFound');
	if (!res.ok) throw new ImportError('network');
	return parseLichessNdjson(await res.text()).slice(0, max);
}

export async function fetchChessCom(
	user: string,
	max: number,
	fetcher: typeof fetch = fetch,
	since?: number
): Promise<ImportedGame[]> {
	let archives: string[];
	try {
		const res = await fetcher(
			`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`
		);
		if (res.status === 404) throw new ImportError('notFound');
		if (!res.ok) throw new ImportError('network');
		archives = (await res.json()).archives ?? [];
	} catch (e) {
		throw e instanceof ImportError ? e : new ImportError('network');
	}
	const out: ImportedGame[] = [];
	// neueste Monate zuerst
	for (const url of [...archives].reverse()) {
		if (out.length >= max) break;
		// Archiv-URLs enden auf /YYYY/MM – ältere Monate als `since` überspringen
		if (since) {
			const m = url.match(/(\d{4})\/(\d{2})$/);
			if (m && Date.UTC(+m[1], +m[2], 1) < since) break;
		}
		try {
			const month = await (await fetcher(url)).json();
			const games = parseChessComMonth(month)
				.filter((g) => !since || g.date > since)
				.sort((a, b) => b.date - a.date);
			out.push(...games);
		} catch {
			throw new ImportError('network');
		}
	}
	return out.sort((a, b) => b.date - a.date).slice(0, max);
}

/** Wandelt eine importierte Partie in eine Datenbankzeile (oder null bei ungültigem PGN) */
export function toGameRow(g: ImportedGame, user: string): GameRow | null {
	let game: Game;
	try {
		game = Game.fromPgn(g.pgn);
	} catch {
		return null;
	}
	if (game.ply < 4) return null;
	const me = user.toLowerCase();
	const myColor = g.black.toLowerCase() === me ? 'black' : 'white';
	return {
		date: g.date,
		pgn: g.pgn,
		moves: game.moves.map((m) => m.uci),
		startFen: game.startFen,
		result: g.result,
		myColor,
		opponent: myColor === 'white' ? g.black : g.white,
		source: g.source,
		externalId: g.externalId,
		myRating: myColor === 'white' ? g.whiteRating : g.blackRating,
		oppRating: myColor === 'white' ? g.blackRating : g.whiteRating,
		speed: g.speed
	};
}

// ───────────────────── Komplette Historie (Datenstrom) ─────────────────────

/**
 * Lichess: alle Partien eines Spielers als Datenstrom (neueste zuerst).
 * `since`/`until` begrenzen den Zeitraum (ms). `onBatch` bekommt Pakete von Partien,
 * sobald sie ankommen – so bleibt der Speicher klein und Fortschritt sichtbar.
 * Wirft ImportError('rateLimit') bei HTTP 429.
 */
export async function streamLichess(
	user: string,
	opts: { since?: number; until?: number; signal?: AbortSignal },
	onBatch: (games: ImportedGame[]) => Promise<void>,
	fetcher: typeof fetch = fetch,
	batchSize = 50
): Promise<void> {
	const q = new URLSearchParams({
		pgnInJson: 'true',
		moves: 'true',
		clocks: 'false',
		evals: 'false',
		opening: 'false'
	});
	if (opts.since) q.set('since', String(opts.since));
	if (opts.until) q.set('until', String(opts.until));
	let res: Response;
	try {
		res = await fetcher(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${q}`, {
			headers: { Accept: 'application/x-ndjson' },
			signal: opts.signal
		});
	} catch {
		throw new ImportError('network');
	}
	if (res.status === 404) throw new ImportError('notFound');
	if (res.status === 429) throw new ImportError('rateLimit');
	if (!res.ok) throw new ImportError('network');

	let batch: ImportedGame[] = [];
	const flush = async () => {
		if (batch.length) await onBatch(batch);
		batch = [];
	};
	const handle = async (line: string) => {
		const g = parseLichessNdjson(line)[0];
		if (g) batch.push(g);
		if (batch.length >= batchSize) await flush();
	};

	if (!res.body) {
		for (const line of (await res.text()).split('\n')) await handle(line);
		return flush();
	}
	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let rest = '';
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			rest += value;
			const lines = rest.split('\n');
			rest = lines.pop() ?? '';
			for (const line of lines) await handle(line);
		}
	} catch (e) {
		if (opts.signal?.aborted) throw e;
		throw new ImportError('network');
	}
	if (rest.trim()) await handle(rest);
	await flush();
}

/** Chess.com: Liste der Monatsarchive (älteste zuerst) */
export async function chessComArchives(
	user: string,
	fetcher: typeof fetch = fetch
): Promise<string[]> {
	let res: Response;
	try {
		res = await fetcher(
			`https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`
		);
	} catch {
		throw new ImportError('network');
	}
	if (res.status === 404) throw new ImportError('notFound');
	if (res.status === 429) throw new ImportError('rateLimit');
	if (!res.ok) throw new ImportError('network');
	return ((await res.json()).archives ?? []) as string[];
}

export async function chessComMonth(
	url: string,
	fetcher: typeof fetch = fetch
): Promise<ImportedGame[]> {
	let res: Response;
	try {
		res = await fetcher(url);
	} catch {
		throw new ImportError('network');
	}
	if (res.status === 429) throw new ImportError('rateLimit');
	if (!res.ok) throw new ImportError('network');
	return parseChessComMonth(await res.json());
}

/** Monat eines Archiv-Links als Zeitpunkt (Monatsende, UTC) */
export function archiveEnd(url: string): number {
	const m = url.match(/(\d{4})\/(\d{2})$/);
	return m ? Date.UTC(+m[1], +m[2], 1) : 0;
}
