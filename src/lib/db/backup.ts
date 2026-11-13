import { db, TABLES, setSetting } from './db.js';
import { t } from '#lib/i18n/i18n.svelte.js';
import { mergeIntoLocal } from '#lib/sync/mergeLocal.js';

export const BACKUP_FORMAT = 'rookie-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
	format: typeof BACKUP_FORMAT;
	version: number;
	exportedAt: string;
	tables: Record<string, unknown[]>;
}

export async function exportAll(): Promise<Backup> {
	const tables: Record<string, unknown[]> = {};
	for (const t of TABLES) tables[t] = await db.table(t).toArray();
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		tables
	};
}

export function parseBackup(text: string): Backup {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error(t('settings.badJson'));
	}
	const b = data as Partial<Backup>;
	if (b?.format !== BACKUP_FORMAT || typeof b.version !== 'number' || !b.tables) {
		throw new Error(t('settings.notBackup'));
	}
	if (b.version > BACKUP_VERSION) {
		throw new Error(t('settings.newer'));
	}
	return b as Backup;
}

/** Führt die Sicherung mit den vorhandenen Daten zusammen – nichts geht verloren (Standard) */
export async function mergeBackup(backup: Backup): Promise<void> {
	await mergeIntoLocal(backup.tables);
	await setSetting('lastBackupAt', Date.now());
}

/** Ersetzt alle Daten durch die Sicherung (nur auf ausdrücklichen Wunsch) */
export async function importAll(backup: Backup): Promise<void> {
	await db.transaction(
		'rw',
		TABLES.map((t) => db.table(t)),
		async () => {
			for (const t of TABLES) {
				await db.table(t).clear();
				const rows = backup.tables[t];
				if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
			}
		}
	);
	await setSetting('lastBackupAt', Date.now());
}

export async function downloadBackup(): Promise<void> {
	const data = await exportAll();
	const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `rookie-backup-${new Date().toISOString().slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	await setSetting('lastBackupAt', Date.now());
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen */
export async function requestPersistence(): Promise<boolean> {
	try {
		if (!navigator.storage?.persist) return false;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
