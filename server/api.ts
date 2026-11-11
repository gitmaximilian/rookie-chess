/**
 * Rookie-API (Cloudflare Pages Functions, D1).
 *
 * Grundsätze:
 * - Anmeldung nur mit Passkeys: keine E-Mail, kein Passwort, kein Name.
 * - Es werden keine IP-Adressen oder Gerätedaten gespeichert und nichts geloggt.
 * - Der Trainingsstand ist ein gzip-Blob, den der Server nicht auswertet.
 * - Sitzungs-Token werden nur als SHA-256-Hash gespeichert.
 * - Inaktive Konten (2 Jahre) werden automatisch gelöscht.
 */
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type AuthenticatorTransport,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { SCHEMA } from './schema';

export interface Env {
	DB: D1Database;
}

const DAY = 86_400_000;
const SESSION_DAYS = 180;
const CHALLENGE_MS = 5 * 60_000;
const INACTIVE_DAYS = 730;
/** D1 erlaubt bis ~2 MB pro Wert; der Blob ist gzip-komprimiert */
const MAX_BLOB = 1_900_000;
const SESSION_COOKIE = 'rk_session';
const CHALLENGE_COOKIE = 'rk_challenge';

const ALLOWED_HOSTS = new Set(['chess.maximilianauer.at', 'localhost', '127.0.0.1']);

// ───────────────────────────── Hilfen ─────────────────────────────

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			...headers
		}
	});
}

function fail(status: number, code: string): Response {
	return json({ error: code }, status);
}

function randomId(bytes = 16): string {
	return isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return isoBase64URL.fromBuffer(new Uint8Array(digest));
}

function readCookie(req: Request, name: string): string | null {
	const header = req.headers.get('cookie') ?? '';
	for (const part of header.split(';')) {
		const [k, ...v] = part.trim().split('=');
		if (k === name) return v.join('=');
	}
	return null;
}

function cookie(req: Request, name: string, value: string, maxAgeSec: number): string {
	const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
	return `${name}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}

interface Rp {
	rpID: string;
	origin: string;
}

/** Relying Party aus der Anfrage; nur bekannte Hosts (und *.pages.dev-Vorschauen) */
function relyingParty(req: Request): Rp | null {
	const url = new URL(req.url);
	if (!ALLOWED_HOSTS.has(url.hostname) && !url.hostname.endsWith('.pages.dev')) return null;
	return { rpID: url.hostname, origin: url.origin };
}

/** Schutz vor Cross-Site-Anfragen: nur gleiche Herkunft, nur JSON/Binär */
function sameOrigin(req: Request): boolean {
	const origin = req.headers.get('origin');
	if (!origin) return req.method === 'GET';
	return origin === new URL(req.url).origin;
}

// ───────────────────────────── Sitzungen ─────────────────────────────

async function createSession(env: Env, req: Request, userId: string): Promise<string> {
	const token = randomId(32);
	const now = Date.now();
	await env.DB.prepare(
		'INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)'
	)
		.bind(await sha256(token), userId, now, now + SESSION_DAYS * DAY)
		.run();
	return cookie(req, SESSION_COOKIE, token, SESSION_DAYS * 86_400);
}

async function currentUser(env: Env, req: Request): Promise<string | null> {
	const token = readCookie(req, SESSION_COOKIE);
	if (!token) return null;
	const hash = await sha256(token);
	const row = await env.DB.prepare('SELECT user_id, expires FROM sessions WHERE token_hash = ?')
		.bind(hash)
		.first<{ user_id: string; expires: number }>();
	const now = Date.now();
	if (!row || row.expires < now) return null;
	// gleitende Verlängerung und „zuletzt aktiv“ (für die Löschfrist), höchstens einmal pro Tag
	if (row.expires - now < (SESSION_DAYS - 1) * DAY) {
		await env.DB.batch([
			env.DB.prepare('UPDATE sessions SET expires = ? WHERE token_hash = ?').bind(
				now + SESSION_DAYS * DAY,
				hash
			),
			env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, row.user_id)
		]);
	}
	return row.user_id;
}

/** Aufräumen: abgelaufene Challenges/Sitzungen, inaktive Konten (Speicherbegrenzung) */
async function housekeeping(env: Env): Promise<void> {
	const now = Date.now();
	const inactive = now - INACTIVE_DAYS * DAY;
	await env.DB.batch([
		env.DB.prepare('DELETE FROM challenges WHERE expires < ?').bind(now),
		env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now),
		env.DB.prepare(
			'DELETE FROM sync_data WHERE user_id IN (SELECT id FROM users WHERE last_seen < ?)'
		).bind(inactive),
		env.DB.prepare(
			'DELETE FROM credentials WHERE user_id IN (SELECT id FROM users WHERE last_seen < ?)'
		).bind(inactive),
		env.DB.prepare(
			'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE last_seen < ?)'
		).bind(inactive),
		env.DB.prepare('DELETE FROM users WHERE last_seen < ?').bind(inactive)
	]);
}

async function saveChallenge(env: Env, req: Request, challenge: string, userId: string | null) {
	const id = randomId();
	await env.DB.prepare(
		'INSERT INTO challenges (id, challenge, user_id, expires) VALUES (?, ?, ?, ?)'
	)
		.bind(id, challenge, userId, Date.now() + CHALLENGE_MS)
		.run();
	return cookie(req, CHALLENGE_COOKIE, id, CHALLENGE_MS / 1000);
}

async function takeChallenge(env: Env, req: Request) {
	const id = readCookie(req, CHALLENGE_COOKIE);
	if (!id) return null;
	const row = await env.DB.prepare(
		'SELECT challenge, user_id, expires FROM challenges WHERE id = ?'
	)
		.bind(id)
		.first<{ challenge: string; user_id: string | null; expires: number }>();
	// Einmalverwendung
	await env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(id).run();
	if (!row || row.expires < Date.now()) return null;
	return row;
}

const clearChallenge = (req: Request) => cookie(req, CHALLENGE_COOKIE, '', 0);

// ───────────────────────────── Passkeys ─────────────────────────────

async function registerOptions(env: Env, req: Request, rp: Rp): Promise<Response> {
	await housekeeping(env);
	const userId = randomId();
	const options = await generateRegistrationOptions({
		rpName: 'Rookie',
		rpID: rp.rpID,
		userID: isoBase64URL.toBuffer(userId),
		// erscheint im Schlüsselbund – bewusst ohne persönliche Angaben
		userName: `Rookie ${userId.slice(0, 6)}`,
		userDisplayName: 'Rookie',
		attestationType: 'none',
		authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' }
	});
	const set = await saveChallenge(env, req, options.challenge, userId);
	return json(options, 200, { 'set-cookie': set });
}

async function registerVerify(env: Env, req: Request, rp: Rp): Promise<Response> {
	const chal = await takeChallenge(env, req);
	if (!chal?.user_id) return fail(400, 'challenge');
	const body = (await req.json()) as RegistrationResponseJSON;
	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: body,
			expectedChallenge: chal.challenge,
			expectedOrigin: rp.origin,
			expectedRPID: rp.rpID,
			requireUserVerification: false
		});
	} catch {
		return fail(400, 'verify');
	}
	if (!verification.verified || !verification.registrationInfo) return fail(400, 'verify');
	const { credential } = verification.registrationInfo;
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare('INSERT INTO users (id, created, last_seen) VALUES (?, ?, ?)').bind(
			chal.user_id,
			now,
			now
		),
		env.DB.prepare(
			'INSERT INTO credentials (id, user_id, public_key, counter, transports, created, last_used) VALUES (?, ?, ?, ?, ?, ?, ?)'
		).bind(
			credential.id,
			chal.user_id,
			isoBase64URL.fromBuffer(credential.publicKey),
			credential.counter,
			JSON.stringify(credential.transports ?? []),
			now,
			now
		)
	]);
	const headers = new Headers({ 'content-type': 'application/json' });
	headers.append('set-cookie', await createSession(env, req, chal.user_id));
	headers.append('set-cookie', clearChallenge(req));
	return new Response(JSON.stringify({ ok: true }), { headers });
}

async function loginOptions(env: Env, req: Request, rp: Rp): Promise<Response> {
	await housekeeping(env);
	// leere allowCredentials: der Browser bietet die gespeicherten Passkeys an (kein Benutzername nötig)
	const options = await generateAuthenticationOptions({
		rpID: rp.rpID,
		userVerification: 'preferred',
		allowCredentials: []
	});
	const set = await saveChallenge(env, req, options.challenge, null);
	return json(options, 200, { 'set-cookie': set });
}

async function loginVerify(env: Env, req: Request, rp: Rp): Promise<Response> {
	const chal = await takeChallenge(env, req);
	if (!chal) return fail(400, 'challenge');
	const body = (await req.json()) as AuthenticationResponseJSON;
	const cred = await env.DB.prepare(
		'SELECT id, user_id, public_key, counter, transports FROM credentials WHERE id = ?'
	)
		.bind(body.id)
		.first<{
			id: string;
			user_id: string;
			public_key: string;
			counter: number;
			transports: string;
		}>();
	if (!cred) return fail(404, 'unknown');
	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response: body,
			expectedChallenge: chal.challenge,
			expectedOrigin: rp.origin,
			expectedRPID: rp.rpID,
			requireUserVerification: false,
			credential: {
				id: cred.id,
				publicKey: isoBase64URL.toBuffer(cred.public_key),
				counter: cred.counter,
				transports: JSON.parse(cred.transports || '[]') as AuthenticatorTransport[]
			}
		});
	} catch {
		return fail(400, 'verify');
	}
	if (!verification.verified) return fail(400, 'verify');
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare('UPDATE credentials SET counter = ?, last_used = ? WHERE id = ?').bind(
			verification.authenticationInfo.newCounter,
			now,
			cred.id
		),
		env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, cred.user_id)
	]);
	const headers = new Headers({ 'content-type': 'application/json' });
	headers.append('set-cookie', await createSession(env, req, cred.user_id));
	headers.append('set-cookie', clearChallenge(req));
	return new Response(JSON.stringify({ ok: true }), { headers });
}

// ───────────────────────────── Konto & Daten ─────────────────────────────

async function me(env: Env, userId: string): Promise<Response> {
	const [user, data, creds] = await Promise.all([
		env.DB.prepare('SELECT created, last_seen FROM users WHERE id = ?')
			.bind(userId)
			.first<{ created: number; last_seen: number }>(),
		env.DB.prepare('SELECT version, updated, size FROM sync_data WHERE user_id = ?')
			.bind(userId)
			.first<{ version: number; updated: number; size: number }>(),
		env.DB.prepare('SELECT COUNT(*) AS n FROM credentials WHERE user_id = ?')
			.bind(userId)
			.first<{ n: number }>()
	]);
	if (!user) return fail(401, 'auth');
	return json({
		signedIn: true,
		created: user.created,
		passkeys: creds?.n ?? 0,
		sync: data ?? null
	});
}

async function getSync(env: Env, userId: string): Promise<Response> {
	const row = await env.DB.prepare('SELECT version, updated, blob FROM sync_data WHERE user_id = ?')
		.bind(userId)
		.first<{ version: number; updated: number; blob: ArrayBuffer | number[] }>();
	if (!row) return new Response(null, { status: 204, headers: { 'x-sync-version': '0' } });
	// D1 liefert BLOBs je nach Laufzeit als ArrayBuffer oder Zahlen-Array
	return new Response(new Uint8Array(row.blob), {
		headers: {
			'content-type': 'application/octet-stream',
			'cache-control': 'no-store',
			'x-sync-version': String(row.version),
			'x-sync-updated': String(row.updated)
		}
	});
}

async function putSync(env: Env, req: Request, userId: string): Promise<Response> {
	const base = Number(req.headers.get('x-sync-base') ?? 'NaN');
	if (!Number.isInteger(base) || base < 0) return fail(400, 'base');
	const len = Number(req.headers.get('content-length') ?? '0');
	if (len > MAX_BLOB) return fail(413, 'too-large');
	const blob = await req.arrayBuffer();
	if (blob.byteLength > MAX_BLOB) return fail(413, 'too-large');
	// gzip-Magie prüfen – der Server speichert nur komprimierte Snapshots
	const head = new Uint8Array(blob.slice(0, 2));
	if (head[0] !== 0x1f || head[1] !== 0x8b) return fail(400, 'format');
	const now = Date.now();
	const next = base + 1;
	const res =
		base === 0
			? await env.DB.prepare(
					'INSERT OR IGNORE INTO sync_data (user_id, version, updated, size, blob) VALUES (?, ?, ?, ?, ?)'
				)
					.bind(userId, next, now, blob.byteLength, blob)
					.run()
			: await env.DB.prepare(
					'UPDATE sync_data SET version = ?, updated = ?, size = ?, blob = ? WHERE user_id = ? AND version = ?'
				)
					.bind(next, now, blob.byteLength, blob, userId, base)
					.run();
	// jemand anderes (anderes Gerät) war schneller → erst neu abgleichen
	if (!res.meta.changes) return fail(409, 'conflict');
	return json({ version: next, updated: now });
}

/** Auskunft (Art. 15 DSGVO): alles, was über dieses Konto gespeichert ist */
async function exportAccount(env: Env, userId: string): Promise<Response> {
	const [user, creds, sessions, data] = await Promise.all([
		env.DB.prepare('SELECT id, created, last_seen FROM users WHERE id = ?').bind(userId).first(),
		env.DB.prepare(
			'SELECT id, public_key, counter, transports, created, last_used FROM credentials WHERE user_id = ?'
		)
			.bind(userId)
			.all(),
		env.DB.prepare('SELECT created, expires FROM sessions WHERE user_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT version, updated, size, blob FROM sync_data WHERE user_id = ?')
			.bind(userId)
			.first<{ version: number; updated: number; size: number; blob: ArrayBuffer | number[] }>()
	]);
	return json({
		account: user,
		passkeys: creds.results,
		sessions: sessions.results,
		sync: data
			? {
					version: data.version,
					updated: data.updated,
					size: data.size,
					gzipBase64: isoBase64URL.fromBuffer(new Uint8Array(data.blob))
				}
			: null
	});
}

/** Löschung (Art. 17 DSGVO): Konto und alle Daten sofort und endgültig */
async function deleteAccount(env: Env, req: Request, userId: string): Promise<Response> {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM sync_data WHERE user_id = ?').bind(userId),
		env.DB.prepare('DELETE FROM credentials WHERE user_id = ?').bind(userId),
		env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
		env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId)
	]);
	return json({ ok: true }, 200, { 'set-cookie': cookie(req, SESSION_COOKIE, '', 0) });
}

async function logout(env: Env, req: Request): Promise<Response> {
	const token = readCookie(req, SESSION_COOKIE);
	if (token)
		await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
			.bind(await sha256(token))
			.run();
	return json({ ok: true }, 200, { 'set-cookie': cookie(req, SESSION_COOKIE, '', 0) });
}

// ───────────────────────────── Router ─────────────────────────────

let schemaReady: Promise<unknown> | null = null;

/** Tabellen anlegen, falls es sie noch nicht gibt (einmal pro Instanz) */
function ensureSchema(env: Env): Promise<unknown> {
	schemaReady ??= env.DB.batch(
		SCHEMA.replace(/--[^\n]*/g, '')
			.split(';')
			.map((s) => s.trim())
			.filter(Boolean)
			.map((s) => env.DB.prepare(s))
	).catch((e) => {
		schemaReady = null;
		throw e;
	});
	return schemaReady;
}

export async function handle(req: Request, env: Env): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '');
	const rp = relyingParty(req);
	if (!rp) return fail(403, 'host');
	if (req.method !== 'GET' && !sameOrigin(req)) return fail(403, 'origin');
	if (!env.DB) return fail(503, 'unavailable');

	try {
		await ensureSchema(env);
		switch (`${req.method} ${path}`) {
			case 'POST /auth/register/options':
				return registerOptions(env, req, rp);
			case 'POST /auth/register/verify':
				return registerVerify(env, req, rp);
			case 'POST /auth/login/options':
				return loginOptions(env, req, rp);
			case 'POST /auth/login/verify':
				return loginVerify(env, req, rp);
			case 'POST /auth/logout':
				return logout(env, req);
		}
		const userId = await currentUser(env, req);
		// Statusabfrage beim App-Start: „nicht angemeldet“ ist kein Fehler
		if (!userId && `${req.method} ${path}` === 'GET /me') return json({ signedIn: false });
		if (!userId) return fail(401, 'auth');
		switch (`${req.method} ${path}`) {
			case 'GET /me':
				return me(env, userId);
			case 'GET /sync':
				return getSync(env, userId);
			case 'PUT /sync':
				return putSync(env, req, userId);
			case 'GET /account/export':
				return exportAccount(env, userId);
			case 'DELETE /account':
				return deleteAccount(env, req, userId);
		}
		return fail(404, 'not-found');
	} catch {
		// bewusst ohne Details/Logging: keine personenbezogenen Daten in Logs
		return fail(500, 'server');
	}
}
