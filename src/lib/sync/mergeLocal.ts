/**
 * Daten in die lokale Datenbank übernehmen, ohne Vorhandenes zu löschen.
 * Gemeinsame Grundlage für den Umzug (lib/move) und „Sicherung laden“ (lib/db/backup).
 */
import { db, TABLES, type GameRow, type SettingRow } from '#lib/db/db.js';
import { gameKey, LOCAL_ONLY_SETTINGS, mergeSnapshots, type Snapshot } from './merge.js';
import { applySnapshot, buildSnapshot } from './sync.svelte.js';

/** gibt es lokal schon Trainingsdaten? */
export async function hasLocalData(): Promise<boolean> {
	const counts = await Promise.all(
		(['games', 'puzzleAttempts', 'activity', 'ratings', 'repertoire', 'endgames'] as const).map(
			(t) => db.table(t).count()
		)
	);
	return counts.some((n) => n > 0);
}

/**
 * Leere Datenbank: 1:1 übernehmen (gleiche IDs). Sonst wie beim Konto-Abgleich zusammenführen –
 * Listen werden vereinigt, bei gleichen Einträgen gewinnt der weiter fortgeschrittene.
 */
export async function mergeIntoLocal(input: Snapshot): Promise<void> {
	const tables = { ...input };
	tables.settings = ((tables.settings ?? []) as { key: string }[]).filter(
		(r) => !LOCAL_ONLY_SETTINGS.has(r.key)
	);
	if (!(await hasLocalData())) {
		// Einstellungen gibt es auch ohne Trainingsdaten: die jeweils neuere Fassung behalten
		const local = new Map(
			(await db.settings.toArray()).map((r) => [r.key, r as SettingRow & { t?: number }])
		);
		tables.settings = (tables.settings as (SettingRow & { t?: number })[]).filter(
			(r) => (local.get(r.key)?.t ?? -1) < (r.t ?? 0)
		);
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
		return;
	}
	await applySnapshot(mergeSnapshots(await buildSnapshot(), tables));
	// importierte Partien (Lichess/Chess.com) gleicht der Konto-Abgleich nicht ab – hier ergänzen
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
