/* eslint-disable svelte/prefer-svelte-reactivity -- Sets hier nur lokal während eines Abrufs, nicht als UI-Zustand */
import { db, getSetting, setSetting, type GameRow } from '#lib/db/db.js';
import { analyseGame, createMistakePuzzles } from '#lib/analysis/run.js';
import {
	archiveEnd,
	chessComArchives,
	chessComMonth,
	streamLichess,
	toGameRow,
	ImportError,
	type ImportedGame,
	type Source
} from './importers.js';

/**
 * Verknüpfte Konten: Rookie holt neue Partien automatisch, sobald die App geöffnet wird.
 * Partien sind auf Lichess und Chess.com öffentlich – ein Benutzername genügt, kein Passwort.
 */
export interface LinkedAccounts {
	lichess?: string;
	chesscom?: string;
	/** letzter erfolgreicher Abruf neuer Partien je Quelle (ms) */
	lastSync?: Partial<Record<Source, number>>;
	/** Nachladen der kompletten Historie – fortsetzbar, falls die App geschlossen wird */
	backfill?: Partial<Record<Source, Backfill>>;
}

export interface Backfill {
	done: boolean;
	/** Lichess: nur Partien vor diesem Zeitpunkt fehlen noch */
	until?: number;
	/** Chess.com: bereits vollständig geladene Monatsarchive */
	months?: string[];
}

const KEY = 'linkedAccounts';
/** so oft höchstens automatisch abrufen */
const AUTO_INTERVAL = 30 * 60 * 1000;
/** pro Sitzung höchstens so viele Partien im Hintergrund analysieren (Akku) */
const ANALYSE_PER_SESSION = 8;

export const syncState = $state({
	running: false,
	analysing: false,
	/** zuletzt neu importierte Partien */
	lastNew: 0,
	/** während des laufenden Abrufs importiert (für die Fortschrittsanzeige) */
	imported: 0,
	/** gerade wird die ältere Historie nachgeladen */
	history: false,
	/** vom Nutzer gestartete Analyse (Coach): erledigt / insgesamt */
	batchDone: 0,
	batchTotal: 0,
	error: '' as '' | 'notFound' | 'network' | 'rateLimit'
});

export function getLinked(): Promise<LinkedAccounts> {
	return getSetting<LinkedAccounts>(KEY, {});
}

export async function link(source: Source, user: string): Promise<void> {
	const acc = await getLinked();
	acc[source] = user.trim();
	if (acc.lastSync) delete acc.lastSync[source];
	if (acc.backfill) delete acc.backfill[source];
	await setSetting(KEY, acc);
}

export async function unlink(source: Source): Promise<void> {
	const acc = await getLinked();
	delete acc[source];
	if (acc.lastSync) delete acc.lastSync[source];
	if (acc.backfill) delete acc.backfill[source];
	await setSetting(KEY, acc);
}

async function patch(update: (acc: LinkedAccounts) => void): Promise<void> {
	const acc = await getLinked();
	update(acc);
	await setSetting(KEY, acc);
}

/** Lädt neue Partien und – beim ersten Mal – die komplette Historie. Liefert die Anzahl neuer Partien. */
export async function syncNow(fetcher: typeof fetch = fetch): Promise<number> {
	if (syncState.running) return 0;
	syncState.running = true;
	syncState.error = '';
	syncState.imported = 0;
	let added = 0;
	try {
		const acc = await getLinked();
		for (const source of ['lichess', 'chesscom'] as const) {
			const user = acc[source];
			if (!user) continue;
			// bekannte Partien einmal laden – schneller als eine Abfrage pro Partie
			const known = new Set(
				(await db.games.where('source').equals(source).toArray()).map((g) => g.externalId)
			);
			const save = async (games: ImportedGame[]) => {
				const rows = games
					.filter((g) => !known.has(g.externalId))
					.map((g) => toGameRow(g, user))
					.filter((r) => r !== null);
				if (!rows.length) return;
				await db.games.bulkAdd(rows);
				for (const r of rows) known.add(r.externalId);
				added += rows.length;
				syncState.imported += rows.length;
			};
			try {
				await syncSource(source, user, acc, save, fetcher);
			} catch (e) {
				const code = (e as ImportError).code;
				syncState.error =
					code === 'notFound' ? 'notFound' : code === 'rateLimit' ? 'rateLimit' : 'network';
			}
		}
	} finally {
		syncState.running = false;
		syncState.history = false;
		syncState.lastNew = added;
	}
	return added;
}

async function syncSource(
	source: Source,
	user: string,
	acc: LinkedAccounts,
	save: (g: ImportedGame[]) => Promise<void>,
	fetcher: typeof fetch
): Promise<void> {
	const startedAt = Date.now();
	const since = acc.lastSync?.[source];

	// 1) Neue Partien seit dem letzten Abruf
	if (since) {
		if (source === 'lichess') await streamLichess(user, { since }, save, fetcher);
		else {
			const archives = await chessComArchives(user, fetcher);
			for (const url of [...archives].reverse()) {
				if (archiveEnd(url) < since) break;
				await save((await chessComMonth(url, fetcher)).filter((g) => g.date > since));
			}
		}
	}
	// Grenze für künftige Abrufe – alles davor erledigt das Nachladen der Historie
	await patch((a) => (a.lastSync = { ...a.lastSync, [source]: startedAt }));
	const boundary = since ?? startedAt;

	// 2) Komplette Historie (einmalig, fortsetzbar)
	const bf: Backfill = acc.backfill?.[source] ?? { done: false };
	if (bf.done) return;
	syncState.history = true;
	if (source === 'lichess') {
		await streamLichess(
			user,
			{ until: bf.until ?? boundary },
			async (games) => {
				await save(games);
				const oldest = Math.min(...games.map((g) => g.date));
				await patch(
					(a) => (a.backfill = { ...a.backfill, lichess: { done: false, until: oldest } })
				);
			},
			fetcher
		);
	} else {
		const archives = await chessComArchives(user, fetcher);
		const months = new Set(bf.months ?? []);
		for (const url of [...archives].reverse()) {
			if (months.has(url)) continue;
			await save(await chessComMonth(url, fetcher));
			months.add(url);
			await patch(
				(a) => (a.backfill = { ...a.backfill, chesscom: { done: false, months: [...months] } })
			);
		}
	}
	await patch((a) => (a.backfill = { ...a.backfill, [source]: { done: true } }));
}

let bgAbort: AbortController | null = null;
let analysedThisSession = 0;

/** Analysiert importierte, noch nicht analysierte Partien – neueste zuerst */
export async function analyseInBackground(): Promise<void> {
	if (syncState.analysing || analysedThisSession >= ANALYSE_PER_SESSION) return;
	const acc = await getLinked();
	if (!acc.lichess && !acc.chesscom) return;
	syncState.analysing = true;
	bgAbort = new AbortController();
	const signal = bgAbort.signal;
	try {
		const pending = (await db.games.orderBy('date').reverse().toArray()).filter(
			(g) => (g.source === 'lichess' || g.source === 'chesscom') && !g.analysis?.done
		);
		for (const row of pending) {
			if (signal.aborted || analysedThisSession >= ANALYSE_PER_SESSION) break;
			const evals = await analyseGame(row, () => {}, signal);
			if (signal.aborted) break;
			const fresh = await db.games.get(row.id!);
			if (fresh?.analysis?.done) await createMistakePuzzles(fresh, evals);
			analysedThisSession++;
		}
	} finally {
		syncState.analysing = false;
		bgAbort = null;
	}
}

/** Partien, die noch nicht analysiert sind (neueste zuerst). Kurze Partien lohnen sich nicht. */
export async function pendingGames(): Promise<GameRow[]> {
	return (await db.games.orderBy('date').reverse().toArray()).filter(
		(g) => g.result !== '*' && g.moves.length >= 6 && !g.analysis?.done
	);
}

/**
 * Analysiert auf Wunsch des Nutzers die nächsten Partien (alle Quellen, neueste zuerst) –
 * ohne das Sitzungslimit der Hintergrund-Analyse. Fortschritt in `syncState.batchDone/batchTotal`.
 */
export async function analyseBatch(limit: number): Promise<void> {
	if (syncState.analysing) return;
	const pending = (await pendingGames()).slice(0, limit);
	if (!pending.length) return;
	syncState.analysing = true;
	syncState.batchDone = 0;
	syncState.batchTotal = pending.length;
	bgAbort = new AbortController();
	const signal = bgAbort.signal;
	try {
		for (const row of pending) {
			if (signal.aborted) break;
			const evals = await analyseGame(row, () => {}, signal);
			if (signal.aborted) break;
			const fresh = await db.games.get(row.id!);
			if (fresh?.analysis?.done) await createMistakePuzzles(fresh, evals);
			syncState.batchDone++;
		}
	} finally {
		syncState.analysing = false;
		syncState.batchTotal = 0;
		bgAbort = null;
	}
}

/** Hintergrund-Analyse anhalten (z. B. während einer Partie gegen einen Bot) */
export function pauseBackground(): void {
	bgAbort?.abort();
}

/** Beim App-Start bzw. Zurückkehren: abrufen, wenn der letzte Abruf länger her ist */
export async function autoSync(path: string): Promise<void> {
	const acc = await getLinked();
	if (!acc.lichess && !acc.chesscom) return;
	const linked = (['lichess', 'chesscom'] as const).filter((s) => acc[s]);
	const last = Math.min(...linked.map((s) => acc.lastSync?.[s] ?? 0));
	// unvollständige Historie (z. B. App während des Imports geschlossen) sofort fortsetzen
	const historyOpen = linked.some((s) => !acc.backfill?.[s]?.done);
	if (historyOpen || Date.now() - last > AUTO_INTERVAL) await syncNow();
	if (!busyRoute(path)) void analyseInBackground();
}

/** Auf diesen Seiten braucht die App die Engine selbst */
export function busyRoute(path: string): boolean {
	return path.startsWith('/play') || path.startsWith('/analysis');
}
