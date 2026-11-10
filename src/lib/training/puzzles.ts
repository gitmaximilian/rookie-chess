import { Game } from '#lib/chess/game.js';

export interface Puzzle {
	id: string;
	fen: string;
	moves: string[];
	rating: number;
	themes: string[];
	source: 'lichess' | 'mistake';
	/** Zusatzinfo, z. B. bei eigenen Fehlern */
	note?: string;
}

interface PackInfo {
	file: string;
	min: number;
	max: number;
	count: number;
	themes: number[];
}

interface PuzzleIndex {
	themes: string[];
	packs: PackInfo[];
}

type RawPuzzle = [string, string, string, number, number[]];

let indexCache: Promise<PuzzleIndex> | null = null;
const packCache = new Map<string, Promise<Puzzle[]>>();

export function loadIndex(fetcher: typeof fetch = fetch): Promise<PuzzleIndex> {
	indexCache ??= fetcher('/puzzles/index.json').then((r) => {
		if (!r.ok) throw new Error('Puzzle-Index nicht gefunden');
		return r.json();
	});
	return indexCache;
}

export async function loadPack(file: string, fetcher: typeof fetch = fetch): Promise<Puzzle[]> {
	if (!packCache.has(file)) {
		packCache.set(
			file,
			(async () => {
				const idx = await loadIndex(fetcher);
				const res = await fetcher(`/puzzles/${file}`);
				if (!res.ok) throw new Error('Puzzle-Paket nicht gefunden');
				const raw: RawPuzzle[] = await res.json();
				return raw.map(([id, fen, moves, rating, t]) => ({
					id,
					fen,
					moves: moves.split(' '),
					rating,
					themes: t.map((i) => idx.themes[i]),
					source: 'lichess' as const
				}));
			})()
		);
	}
	return packCache.get(file)!;
}

export interface PickOptions {
	rating: number;
	theme?: string | null;
	/** bereits gesehene Puzzle-IDs */
	exclude: Set<string>;
	rng?: () => number;
}

/** Wählt ein passendes Puzzle (Rating ±150, optional mit Thema) */
export async function pickPuzzle(
	opts: PickOptions,
	fetcher: typeof fetch = fetch
): Promise<Puzzle> {
	const rng = opts.rng ?? Math.random;
	const idx = await loadIndex(fetcher);
	const themeIdx = opts.theme ? idx.themes.indexOf(opts.theme) : -1;
	const target = opts.rating + (rng() - 0.5) * 300;

	// Pakete nach Nähe zum Ziel, mit Thema nur solche, die es enthalten
	const packs = idx.packs
		.filter((p) => themeIdx < 0 || p.themes[themeIdx] > 0)
		.sort(
			(a, b) => Math.abs((a.min + a.max) / 2 - target) - Math.abs((b.min + b.max) / 2 - target)
		);

	for (const p of packs.slice(0, 4)) {
		const all = await loadPack(p.file, fetcher);
		const pool = all.filter(
			(z) => !opts.exclude.has(z.id) && (!opts.theme || z.themes.includes(opts.theme))
		);
		if (pool.length) {
			// innerhalb des Pakets möglichst nah am Ziel
			pool.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
			const top = pool.slice(0, Math.min(40, pool.length));
			return top[Math.floor(rng() * top.length)];
		}
	}
	throw new Error('Kein passendes Puzzle gefunden');
}

/** „Puzzle des Tages“: für alle gleich, wechselt täglich */
export async function dailyPuzzle(day: string, fetcher: typeof fetch = fetch): Promise<Puzzle> {
	const idx = await loadIndex(fetcher);
	let h = 0;
	for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	// Anfängerfreundlich: Pakete 600–1100
	const packs = idx.packs.filter((p) => p.min >= 600 && p.min <= 1100);
	const pack = packs[h % packs.length];
	const all = await loadPack(pack.file, fetcher);
	const short = all.filter((p) => p.moves.length <= 4);
	const pool = short.length ? short : all;
	return pool[(h >>> 8) % pool.length];
}

export async function puzzleById(
	id: string,
	fetcher: typeof fetch = fetch
): Promise<Puzzle | null> {
	const idx = await loadIndex(fetcher);
	for (const p of idx.packs) {
		const found = (await loadPack(p.file, fetcher)).find((z) => z.id === id);
		if (found) return found;
	}
	return null;
}

/**
 * Ablauf eines Puzzles. Lichess-Format: moves[0] ist der Zug des Gegners,
 * danach abwechselnd Lösung (Spieler) und Antwort (Gegner).
 */
export class PuzzleRun {
	readonly puzzle: Puzzle;
	readonly game: Game;
	/** Index des nächsten erwarteten Zugs in puzzle.moves */
	step = 0;
	mistakes = 0;
	readonly playerColor: 'white' | 'black';

	constructor(puzzle: Puzzle) {
		this.puzzle = puzzle;
		this.game = new Game(puzzle.fen);
		// Spieler ist die Seite, die NACH dem ersten Gegnerzug am Zug ist
		this.playerColor =
			puzzle.source === 'mistake' ? this.game.turn : this.game.turn === 'white' ? 'black' : 'white';
		if (puzzle.source === 'mistake') this.step = 1;
	}

	/** Spielt den Einleitungszug des Gegners */
	playIntro(): boolean {
		if (this.step !== 0) return false;
		this.game.play(this.puzzle.moves[0]);
		this.step = 1;
		return true;
	}

	get expected(): string | undefined {
		return this.puzzle.moves[this.step];
	}

	get done(): boolean {
		return this.step >= this.puzzle.moves.length;
	}

	/**
	 * Prüft einen Spielerzug.
	 * - 'correct': richtig; danach `playReply()` für die Gegnerantwort, oder Puzzle gelöst (done)
	 * - 'wrong': falsch, Stellung bleibt
	 */
	try(uci: string): { result: 'correct' | 'wrong'; reply?: string; done: boolean } {
		const exp = this.expected;
		if (!exp) return { result: 'wrong', done: true };
		let ok = uci === exp || (uci.length === 4 && exp.startsWith(uci) && exp[4] === 'q');
		// Jedes Matt ist richtig (wie bei Lichess)
		if (!ok) {
			const test = Game.fromUciMoves(
				this.game.moves.map((m) => m.uci),
				this.game.startFen
			);
			if (test.play(uci) && test.end()?.kind === 'checkmate') ok = true;
		}
		if (!ok) {
			this.mistakes++;
			return { result: 'wrong', done: false };
		}
		const isMateAlt = uci !== exp && !exp.startsWith(uci);
		this.game.play(isMateAlt ? uci : exp);
		this.step++;
		if (isMateAlt) this.step = this.puzzle.moves.length;
		if (this.done) return { result: 'correct', done: true };
		return { result: 'correct', reply: this.puzzle.moves[this.step], done: false };
	}

	/** Spielt die Antwort des Gegners nach einem richtigen Zug */
	playReply(): string | null {
		const reply = this.expected;
		if (!reply) return null;
		this.game.play(reply);
		this.step++;
		return reply;
	}

	/** Spielt den nächsten Lösungszug (für „Lösung zeigen“) */
	showNext(): string | null {
		const exp = this.expected;
		if (!exp) return null;
		this.game.play(exp);
		this.step++;
		return exp;
	}
}
