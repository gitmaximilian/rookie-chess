/* eslint-disable svelte/prefer-svelte-reactivity -- Sets hier nur lokal während eines Abrufs, nicht als UI-Zustand */
import { db, getSetting, setSetting, type GameRow } from '#lib/db/db.js';
import { analyseGame, createMistakePuzzles } from '#lib/analysis/run.js';
import { Game } from '#lib/chess/game.js';
import {
	archiveEnd,
	chessComArchives,
	chessComMonth,
	fetchLichessByIds,
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
/**
 * Import-Fortschritt (letzter Abruf, Historie) gehört zum Gerät, nicht zum Konto: importierte Partien werden nicht
 * zwischen Geräten abgeglichen. Lag er bis 0.13.0 in `linkedAccounts`, kam er per Abgleich aufs zweite Gerät – das
 * hielt die Historie dann für geladen und holte nur noch neue Partien. Alte Werte dort werden ignoriert.
 */
export const IMPORT_PROGRESS_KEY = 'importProgress';
type Progress = Pick<LinkedAccounts, 'lastSync' | 'backfill'>;
/**
 * so oft höchstens automatisch abrufen – kurz, damit eine gerade beendete Partie sofort da ist (der Abruf seit dem
 * letzten Mal ist eine kleine Anfrage; bis 0.10.0 waren es 30 Minuten)
 */
export const AUTO_INTERVAL = 15 * 1000;
/**
 * Lichess filtert `since` nach dem Beginn der Partie und liefert laufende Partien nicht mit. Eine Partie, die beim
 * letzten Abruf noch lief, begann also vor `lastSync` – ohne Überlappung fehlte sie für immer. Bekannte Partien
 * werden beim Speichern übersprungen.
 */
export const SINCE_OVERLAP = 12 * 60 * 60 * 1000;
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

export async function getLinked(): Promise<LinkedAccounts> {
	const [acc, prog] = await Promise.all([
		getSetting<LinkedAccounts>(KEY, {}),
		getSetting<Progress>(IMPORT_PROGRESS_KEY, {})
	]);
	const out: LinkedAccounts = {};
	if (acc.lichess) out.lichess = acc.lichess;
	if (acc.chesscom) out.chesscom = acc.chesscom;
	if (prog.lastSync) out.lastSync = prog.lastSync;
	if (prog.backfill) out.backfill = prog.backfill;
	return out;
}

/** nur die Benutzernamen werden gespeichert (und abgeglichen) */
async function saveAccounts(update: (acc: LinkedAccounts) => void): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- alten Gerätestand nicht weitertragen
	const { lastSync, backfill, ...acc } = await getSetting<LinkedAccounts>(KEY, {});
	update(acc);
	await setSetting(KEY, acc);
}

async function patch(update: (p: Progress) => void): Promise<void> {
	const p = await getSetting<Progress>(IMPORT_PROGRESS_KEY, {});
	update(p);
	await setSetting(IMPORT_PROGRESS_KEY, p);
}

async function resetProgress(source: Source): Promise<void> {
	await patch((p) => {
		if (p.lastSync) delete p.lastSync[source];
		if (p.backfill) delete p.backfill[source];
	});
}

export async function link(source: Source, user: string): Promise<void> {
	await saveAccounts((acc) => (acc[source] = user.trim()));
	await resetProgress(source);
}

export async function unlink(source: Source): Promise<void> {
	await saveAccounts((acc) => delete acc[source]);
	await resetProgress(source);
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
				if (source === 'lichess') await backfillClocks(fetcher);
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

/** Fortschritt beim Nachladen der Uhrzeiten – nur auf diesem Gerät (importierte Partien werden nicht synchronisiert) */
export const CLOCK_BACKFILL_KEY = 'clockBackfill';
const CLOCK_BATCH = 300;

/**
 * Lädt für ältere Lichess-Importe ohne Uhrzeiten das PGN mit `%clk` nach (neueste zuerst, höchstens `batches`
 * Anfragen je Abruf). Ersetzt wird nur das PGN und nur, wenn die Züge exakt gleich sind – Analyse, Wiederholungs-
 * karten und alles andere an der Partie bleiben unverändert.
 */
export async function backfillClocks(fetcher: typeof fetch = fetch, batches = 2): Promise<number> {
	const state = await getSetting<{ before?: number; done?: boolean }>(CLOCK_BACKFILL_KEY, {});
	if (state.done) return 0;
	const missing = (await db.games.where('source').equals('lichess').toArray())
		.filter((g) => !g.pgn.includes('%clk') && (state.before === undefined || g.date < state.before))
		.sort((a, b) => b.date - a.date);
	let updated = 0;
	for (let b = 0; b < batches; b++) {
		const batch = missing.slice(b * CLOCK_BATCH, (b + 1) * CLOCK_BATCH);
		if (!batch.length) {
			await setSetting(CLOCK_BACKFILL_KEY, { done: true });
			break;
		}
		const fresh = new Map(
			(
				await fetchLichessByIds(
					batch.map((g) => g.externalId!.slice('lichess:'.length)),
					fetcher
				)
			).map((g) => [g.externalId, g.pgn])
		);
		for (const row of batch) {
			const pgn = fresh.get(row.externalId!);
			if (!pgn?.includes('%clk') || row.id === undefined) continue;
			try {
				if (
					Game.fromPgn(pgn)
						.moves.map((m) => m.uci)
						.join(' ') !== row.moves.join(' ')
				)
					continue;
			} catch {
				continue;
			}
			await db.games.update(row.id, { pgn });
			updated++;
		}
		await setSetting(CLOCK_BACKFILL_KEY, { before: Math.min(...batch.map((g) => g.date)) });
	}
	return updated;
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
		if (source === 'lichess')
			await streamLichess(user, { since: since - SINCE_OVERLAP }, save, fetcher);
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

/**
 * Analysiert noch nicht analysierte eigene Partien im Hintergrund – Bot-Partien zuerst, dann
 * importierte; jeweils neueste zuerst. So werden eigene Fehler zu Wiederholungsaufgaben, auch wenn
 * man die Analyse nie öffnet (Grundsatz „Eigene Fehler werden Training“).
 */
export async function analyseInBackground(): Promise<void> {
	if (syncState.analysing || analysedThisSession >= ANALYSE_PER_SESSION) return;
	syncState.analysing = true;
	bgAbort = new AbortController();
	const signal = bgAbort.signal;
	try {
		const acc = await getLinked();
		const online = !!(acc.lichess || acc.chesscom);
		const all = (await db.games.orderBy('date').reverse().toArray()).filter(
			(g) => !g.analysis?.done && g.result !== '*' && g.moves.length >= 6
		);
		const pending = [
			...all.filter((g) => g.source === 'bot'),
			...(online ? all.filter((g) => g.source === 'lichess' || g.source === 'chesscom') : [])
		];
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
export async function analyseBatch(
	limit: number,
	only: (g: GameRow) => boolean = () => true
): Promise<void> {
	if (syncState.analysing) return;
	const pending = (await pendingGames()).filter(only).slice(0, limit);
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
	if (!acc.lichess && !acc.chesscom) {
		// ohne verknüpftes Konto: trotzdem eigene Bot-Partien analysieren
		if (!busyRoute(path)) void analyseInBackground();
		return;
	}
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
