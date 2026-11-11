import { db, getSetting, setSetting } from '#lib/db/db.js';
import { analyseGame, createMistakePuzzles } from '#lib/analysis/run.js';
import { fetchChessCom, fetchLichess, toGameRow, type Source } from './importers.js';

/**
 * Verknüpfte Konten: Rookie holt neue Partien automatisch, sobald die App geöffnet wird.
 * Partien sind auf Lichess und Chess.com öffentlich – ein Benutzername genügt, kein Passwort.
 */
export interface LinkedAccounts {
	lichess?: string;
	chesscom?: string;
	/** letzter erfolgreicher Abruf je Quelle (ms) */
	lastSync?: Partial<Record<Source, number>>;
}

const KEY = 'linkedAccounts';
/** so oft höchstens automatisch abrufen */
const AUTO_INTERVAL = 30 * 60 * 1000;
/** beim ersten Verknüpfen so viele Partien holen */
const FIRST_BATCH = 20;
/** pro Sitzung höchstens so viele Partien im Hintergrund analysieren (Akku) */
const ANALYSE_PER_SESSION = 8;

export const syncState = $state({
	running: false,
	analysing: false,
	/** zuletzt neu importierte Partien */
	lastNew: 0,
	error: '' as '' | 'notFound' | 'network'
});

export function getLinked(): Promise<LinkedAccounts> {
	return getSetting<LinkedAccounts>(KEY, {});
}

export async function link(source: Source, user: string): Promise<void> {
	const acc = await getLinked();
	acc[source] = user.trim();
	if (acc.lastSync) delete acc.lastSync[source];
	await setSetting(KEY, acc);
}

export async function unlink(source: Source): Promise<void> {
	const acc = await getLinked();
	delete acc[source];
	if (acc.lastSync) delete acc.lastSync[source];
	await setSetting(KEY, acc);
}

/** Holt neue Partien aller verknüpften Konten; liefert die Anzahl neu gespeicherter Partien */
export async function syncNow(fetcher: typeof fetch = fetch): Promise<number> {
	if (syncState.running) return 0;
	syncState.running = true;
	syncState.error = '';
	let added = 0;
	try {
		const acc = await getLinked();
		for (const source of ['lichess', 'chesscom'] as const) {
			const user = acc[source];
			if (!user) continue;
			const since = acc.lastSync?.[source];
			const startedAt = Date.now();
			try {
				const games =
					source === 'lichess'
						? await fetchLichess(user, since ? 100 : FIRST_BATCH, fetcher, since)
						: await fetchChessCom(user, since ? 100 : FIRST_BATCH, fetcher, since);
				for (const g of games) {
					if (await db.games.where('externalId').equals(g.externalId).first()) continue;
					const row = toGameRow(g, user);
					if (!row) continue;
					await db.games.add(row);
					added++;
				}
				const fresh = await getLinked();
				fresh.lastSync = { ...fresh.lastSync, [source]: startedAt };
				await setSetting(KEY, fresh);
			} catch (e) {
				syncState.error = (e as { code?: string }).code === 'notFound' ? 'notFound' : 'network';
			}
		}
	} finally {
		syncState.running = false;
		syncState.lastNew = added;
	}
	return added;
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

/** Hintergrund-Analyse anhalten (z. B. während einer Partie gegen einen Bot) */
export function pauseBackground(): void {
	bgAbort?.abort();
}

/** Beim App-Start bzw. Zurückkehren: abrufen, wenn der letzte Abruf länger her ist */
export async function autoSync(path: string): Promise<void> {
	const acc = await getLinked();
	if (!acc.lichess && !acc.chesscom) return;
	const last = Math.min(
		...(['lichess', 'chesscom'] as const).filter((s) => acc[s]).map((s) => acc.lastSync?.[s] ?? 0)
	);
	if (Date.now() - last > AUTO_INTERVAL) await syncNow();
	if (!busyRoute(path)) void analyseInBackground();
}

/** Auf diesen Seiten braucht die App die Engine selbst */
export function busyRoute(path: string): boolean {
	return path.startsWith('/play') || path.startsWith('/analysis');
}
