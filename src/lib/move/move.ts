/**
 * Umzug von chess.maximilianauer.at nach rookie.maximilianauer.at.
 *
 * Trainingsdaten liegen in IndexedDB – und die gehört immer zu genau einer Adresse.
 * Damit beim Umzug nichts verloren geht, nimmt der Browser-Tab die Daten selbst mit:
 * static/move-out.html (alte Adresse) legt alles in window.name und öffnet /move-in der
 * neuen Adresse; dort werden die Daten übernommen, ohne Vorhandenes zu löschen.
 * Kein Server sieht die Daten. Die alte Adresse behält ihre Daten in jedem Fall.
 * (Ein unsichtbares iframe ginge nicht: Safari gibt eingebetteten Seiten einen eigenen Speicher.)
 */
import { db, TABLES, type GameRow } from '#lib/db/db.js';
import { gameKey, LOCAL_ONLY_SETTINGS, mergeSnapshots, type Snapshot } from '#lib/sync/merge.js';
import { applySnapshot, buildSnapshot } from '#lib/sync/sync.svelte.js';

export const OLD_HOST = 'chess.maximilianauer.at';
export const NEW_ORIGIN = 'https://rookie.maximilianauer.at';
export const OLD_ORIGIN = `https://${OLD_HOST}`;
const MOVED_KEY = 'rookie:moved';
/** Kennung in window.name (muss zu static/move-out.html passen) */
export const NAME_PREFIX = 'rookie-move:';

export interface MovePayload {
	tables: Snapshot;
	local: Record<string, string>;
}

export const isOldHost = () => typeof location !== 'undefined' && location.hostname === OLD_HOST;

/** als App vom Home-Bildschirm gestartet? (dort hat die neue Adresse einen eigenen Speicher) */
export function isStandalone(): boolean {
	return (
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

/** gleiche Seite unter der neuen Adresse */
export function newUrl(): string {
	return NEW_ORIGIN + location.pathname + location.search + location.hash;
}

/** Pfad, der nach dem Umzug geöffnet wird (nur eigene Pfade) */
export function safePath(p: string | null): string {
	return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

/** gibt es überhaupt etwas umzuziehen? */
export async function hasLocalData(): Promise<boolean> {
	const counts = await Promise.all(
		(['games', 'puzzleAttempts', 'activity', 'ratings', 'repertoire', 'endgames'] as const).map(
			(t) => db.table(t).count()
		)
	);
	return counts.some((n) => n > 0);
}

/** Merker der alten Adresse: Daten wurden schon übergeben (setzt static/move-out.html) */
export function alreadyMoved(): boolean {
	try {
		return localStorage.getItem(MOVED_KEY) === '1';
	} catch {
		return false;
	}
}

export function clearMoved(): void {
	try {
		localStorage.removeItem(MOVED_KEY);
	} catch {
		/* egal */
	}
}

/** ist die lokale Datenbank (fast) leer? Dann wird 1:1 übernommen, mit denselben IDs. */
async function isFresh(): Promise<boolean> {
	return !(await hasLocalData());
}

/** Neue Adresse: übergebene Daten übernehmen, ohne Vorhandenes zu löschen */
export async function receive(p: MovePayload): Promise<void> {
	const tables = { ...p.tables };
	tables.settings = ((tables.settings ?? []) as { key: string }[]).filter(
		(r) => !LOCAL_ONLY_SETTINGS.has(r.key)
	);
	if (await isFresh()) {
		await db.transaction(
			'rw',
			TABLES.map((t) => db.table(t)),
			async () => {
				for (const t of TABLES) {
					const rows = tables[t];
					if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
				}
			}
		);
	} else {
		// schon Daten da: wie beim Konto-Abgleich zusammenführen (nichts geht verloren)
		await applySnapshot(mergeSnapshots(await buildSnapshot(), tables));
		// importierte Partien (Lichess/Chess.com) gleicht der Abgleich nicht ab – hier ergänzen
		const have = new Set((await db.games.toArray()).map(gameKey));
		const extra = ((tables.games ?? []) as GameRow[])
			.filter((g) => !have.has(gameKey(g)))
			.map((g) => {
				const row = { ...g };
				delete row.id;
				return row;
			});
		if (extra.length) await db.games.bulkAdd(extra);
	}
	try {
		for (const [k, v] of Object.entries(p.local ?? {}))
			if (localStorage.getItem(k) === null || k === 'rookie:onboarded') localStorage.setItem(k, v);
	} catch {
		/* egal */
	}
}

async function fromHash(): Promise<string | null> {
	const m = /^#d=([A-Za-z0-9_-]+)$/.exec(location.hash);
	if (!m) return null;
	const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).text();
}

/** wurde etwas mitgebracht? (vor takeOver abfragen) */
export function brought(): boolean {
	return window.name.startsWith(NAME_PREFIX) || location.hash.startsWith('#d=');
}

/**
 * Neue Adresse, Seite /move-in: mitgebrachte Daten übernehmen –
 * aus window.name oder dem gepackten #-Teil der Adresse (siehe static/move-out.html).
 * true = übernommen, false = nichts mitgebracht oder Fehler.
 */
export async function takeOver(): Promise<boolean> {
	const name = window.name;
	window.name = '';
	try {
		const json = name.startsWith(NAME_PREFIX) ? name.slice(NAME_PREFIX.length) : await fromHash();
		// Daten nicht in der Adresszeile oder im Verlauf stehen lassen
		if (location.hash) history.replaceState(null, '', location.pathname + location.search);
		if (!json) return false;
		const p = JSON.parse(json) as MovePayload;
		if (!p?.tables) return false;
		await receive(p);
		return true;
	} catch {
		return false;
	}
}
