/* eslint-disable svelte/prefer-svelte-reactivity -- Map/Set/Date hier nur lokal in Funktionen, nicht als UI-Zustand */
import {
	startAuthentication,
	startRegistration,
	browserSupportsWebAuthn
} from '@simplewebauthn/browser';
import { db, TABLES, type GameRow, type SettingRow } from '#lib/db/db.js';
import {
	gameKey,
	isSyncedGame,
	mergeSnapshots,
	KEYS,
	LOCAL_ONLY_SETTINGS,
	SYNC_FORMAT,
	SYNC_VERSION,
	TOMBSTONE_KEY,
	type Snapshot,
	type Tombstones
} from './merge.js';
import type { PuzzleAttemptRow, RatingRow } from '#lib/db/db.js';

/** Konto- und Abgleichstatus für die Oberfläche */
export const account = $state({
	status: 'unknown' as 'unknown' | 'out' | 'in' | 'offline',
	created: 0,
	lastSync: 0,
	syncing: false,
	error: '' as
		'' | 'cancelled' | 'unsupported' | 'network' | 'tooLarge' | 'server' | 'unknownPasskey'
});

const LAST_SYNC_KEY = 'rookie:lastSync';

// ───────────────────────────── Komprimierung ─────────────────────────────

async function gzip(text: string): Promise<Blob> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Response(stream).blob();
}

async function gunzip(buf: ArrayBuffer): Promise<string> {
	const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).text();
}

// ───────────────────────────── Lokaler Stand ─────────────────────────────

export async function buildSnapshot(): Promise<Snapshot> {
	const out: Snapshot = {};
	for (const t of TABLES) out[t] = await db.table(t).toArray();
	out.games = (out.games as GameRow[]).filter(isSyncedGame);
	out.settings = (out.settings as SettingRow[]).filter((s) => !LOCAL_ONLY_SETTINGS.has(s.key));
	return out;
}

/** Schreibt den gemeinsamen Stand in die lokale Datenbank, ohne lokale IDs zu zerstören */
export async function applySnapshot(merged: Snapshot): Promise<void> {
	await db.transaction(
		'rw',
		TABLES.map((t) => db.table(t)),
		async () => {
			await db.settings.bulkPut(merged.settings as SettingRow[]);
			const tomb =
				((merged.settings as SettingRow[]).find((s) => s.key === TOMBSTONE_KEY)
					?.value as Tombstones) ?? {};

			// Partien: vorhandene behalten (IDs bleiben gültig), bessere Analyse übernehmen, neue hinzufügen
			const local = new Map(
				(await db.games.toArray()).filter(isSyncedGame).map((g) => [gameKey(g), g])
			);
			for (const g of merged.games as GameRow[]) {
				const mine = local.get(gameKey(g));
				if (!mine) await db.games.add({ ...g });
				else if ((g.analysis?.evals.length ?? 0) > (mine.analysis?.evals.length ?? 0))
					await db.games.update(mine.id!, { analysis: g.analysis });
			}
			for (const [k, g] of local) if (tomb.games?.[k]) await db.games.delete(g.id!);

			// Versuche und Wertungen: nur fehlende ergänzen
			const haveA = new Set((await db.puzzleAttempts.toArray()).map(KEYS.attemptKey));
			const newA = (merged.puzzleAttempts as PuzzleAttemptRow[]).filter(
				(a) => !haveA.has(KEYS.attemptKey(a))
			);
			if (newA.length) await db.puzzleAttempts.bulkAdd(newA);
			const haveR = new Set((await db.ratings.toArray()).map(KEYS.ratingKey));
			const newR = (merged.ratings as RatingRow[]).filter((r) => !haveR.has(KEYS.ratingKey(r)));
			if (newR.length) await db.ratings.bulkAdd(newR);

			for (const t of ['reviewCards', 'mistakes', 'repertoire', 'endgames', 'activity'] as const)
				await db.table(t).bulkPut(merged[t] ?? []);
			const repDel = Object.keys(tomb.repertoire ?? {});
			if (repDel.length) await db.repertoire.bulkDelete(repDel);
		}
	);
}

// ───────────────────────────── Server ─────────────────────────────

async function api(path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`/api${path}`, {
		credentials: 'same-origin',
		...init,
		headers: {
			...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
			...init.headers
		}
	});
}

export async function refreshAccount(): Promise<void> {
	try {
		const res = await api('/me');
		if (res.status === 401) {
			account.status = 'out';
			return;
		}
		if (!res.ok) throw new Error();
		const me = (await res.json()) as { created: number };
		account.status = 'in';
		account.created = me.created;
		account.lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
	} catch {
		account.status = 'offline';
	}
}

export function passkeysSupported(): boolean {
	return typeof window !== 'undefined' && browserSupportsWebAuthn();
}

function authError(e: unknown): typeof account.error {
	const name = (e as { name?: string })?.name;
	if (name === 'NotAllowedError' || name === 'AbortError') return 'cancelled';
	return 'server';
}

/** Neues Konto mit Passkey (Face ID / Touch ID) – keine E-Mail, kein Passwort */
export async function createAccount(): Promise<boolean> {
	account.error = '';
	if (!passkeysSupported()) return !!(account.error = 'unsupported');
	try {
		const options = await (
			await api('/auth/register/options', { method: 'POST', body: '{}' })
		).json();
		const response = await startRegistration({ optionsJSON: options });
		const res = await api('/auth/register/verify', {
			method: 'POST',
			body: JSON.stringify(response)
		});
		if (!res.ok) throw new Error('verify');
	} catch (e) {
		account.error = authError(e);
		return false;
	}
	await refreshAccount();
	await syncNow();
	return true;
}

export async function signIn(): Promise<boolean> {
	account.error = '';
	if (!passkeysSupported()) return !!(account.error = 'unsupported');
	try {
		const options = await (await api('/auth/login/options', { method: 'POST', body: '{}' })).json();
		const response = await startAuthentication({ optionsJSON: options });
		const res = await api('/auth/login/verify', { method: 'POST', body: JSON.stringify(response) });
		if (res.status === 404) {
			account.error = 'unknownPasskey';
			return false;
		}
		if (!res.ok) throw new Error('verify');
	} catch (e) {
		account.error = authError(e);
		return false;
	}
	await refreshAccount();
	await syncNow();
	return true;
}

export async function signOut(): Promise<void> {
	await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
	account.status = 'out';
	localStorage.removeItem(LAST_SYNC_KEY);
}

/** Löscht Konto und alle Daten auf dem Server. Die Daten auf diesem Gerät bleiben. */
export async function deleteAccount(): Promise<boolean> {
	const res = await api('/account', { method: 'DELETE' }).catch(() => null);
	if (!res?.ok) {
		account.error = 'network';
		return false;
	}
	account.status = 'out';
	localStorage.removeItem(LAST_SYNC_KEY);
	return true;
}

/** Auskunft: alles, was auf dem Server gespeichert ist, als lesbare JSON-Datei */
export async function downloadServerData(): Promise<boolean> {
	const res = await api('/account/export').catch(() => null);
	if (!res?.ok) {
		account.error = 'network';
		return false;
	}
	const data = (await res.json()) as {
		sync: { gzipBase64: string } | null;
		[k: string]: unknown;
	};
	let training: unknown = null;
	if (data.sync?.gzipBase64) {
		const b64 = data.sync.gzipBase64.replace(/-/g, '+').replace(/_/g, '/');
		const bin = Uint8Array.from(atob(b64 + '==='.slice((b64.length + 3) % 4)), (c) =>
			c.charCodeAt(0)
		);
		training = JSON.parse(await gunzip(bin.buffer));
	}
	const out = {
		...data,
		sync: data.sync ? { ...data.sync, gzipBase64: undefined, training } : null
	};
	const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `rookie-account-${new Date().toISOString().slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return true;
}

let running: Promise<void> | null = null;

/** Abgleich: Serverstand holen, zusammenführen, lokal anwenden, zurückschreiben */
export function syncNow(): Promise<void> {
	if (account.status !== 'in') return Promise.resolve();
	running ??= doSync().finally(() => (running = null));
	return running;
}

async function doSync(attempt = 0): Promise<void> {
	account.syncing = true;
	account.error = '';
	try {
		const res = await api('/sync');
		if (res.status === 401) {
			account.status = 'out';
			return;
		}
		if (!res.ok && res.status !== 204) throw new Error('server');
		const version = Number(res.headers.get('x-sync-version') ?? '0');
		let remote: Snapshot | null = null;
		if (res.status !== 204) {
			const parsed = JSON.parse(await gunzip(await res.arrayBuffer())) as {
				format: string;
				version: number;
				tables: Snapshot;
			};
			if (parsed.format === SYNC_FORMAT && parsed.version <= SYNC_VERSION) remote = parsed.tables;
		}
		const local = await buildSnapshot();
		const merged = mergeSnapshots(local, remote ?? {});
		await applySnapshot(merged);
		const body = JSON.stringify({ format: SYNC_FORMAT, version: SYNC_VERSION, tables: merged });
		if (
			!remote ||
			body !== JSON.stringify({ format: SYNC_FORMAT, version: SYNC_VERSION, tables: remote })
		) {
			const put = await api('/sync', {
				method: 'PUT',
				body: await gzip(body),
				headers: { 'content-type': 'application/octet-stream', 'x-sync-base': String(version) }
			});
			if (put.status === 409 && attempt < 2) return doSync(attempt + 1);
			if (put.status === 413) throw new Error('tooLarge');
			if (!put.ok) throw new Error('server');
		}
		account.lastSync = Date.now();
		localStorage.setItem(LAST_SYNC_KEY, String(account.lastSync));
	} catch (e) {
		const m = (e as Error).message;
		account.error = m === 'tooLarge' ? 'tooLarge' : m === 'server' ? 'server' : 'network';
	} finally {
		account.syncing = false;
	}
}
