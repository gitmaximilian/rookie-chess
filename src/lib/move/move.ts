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
import type { Snapshot } from '#lib/sync/merge.js';
import { hasLocalData, mergeIntoLocal } from '#lib/sync/mergeLocal.js';

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
export { hasLocalData };

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

/** Neue Adresse: übergebene Daten übernehmen, ohne Vorhandenes zu löschen */
export async function receive(p: MovePayload): Promise<void> {
	await mergeIntoLocal(p.tables);
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
