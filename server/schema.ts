/** D1-Schema – wird beim ersten Aufruf je Worker-Instanz angelegt (idempotent). */
export const SCHEMA = `-- Rookie: Konten & Synchronisation (Cloudflare D1)
-- Datensparsam: keine E-Mail, kein Name, kein Passwort, keine IP-Adressen.

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,            -- zufällige ID (128 Bit), kein Bezug zur Person
	created INTEGER NOT NULL,
	last_seen INTEGER NOT NULL      -- für die automatische Löschung inaktiver Konten
);

CREATE TABLE IF NOT EXISTS credentials (
	id TEXT PRIMARY KEY,            -- Passkey-ID (base64url)
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	public_key TEXT NOT NULL,       -- öffentlicher Schlüssel (base64url), kein Geheimnis
	counter INTEGER NOT NULL DEFAULT 0,
	transports TEXT,
	created INTEGER NOT NULL,
	last_used INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS credentials_user ON credentials(user_id);

CREATE TABLE IF NOT EXISTS sessions (
	token_hash TEXT PRIMARY KEY,    -- SHA-256 des Sitzungs-Tokens; das Token selbst wird nie gespeichert
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created INTEGER NOT NULL,
	expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS challenges (
	id TEXT PRIMARY KEY,
	challenge TEXT NOT NULL,
	user_id TEXT,                   -- nur bei Registrierung: die neu vergebene Konto-ID
	expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_data (
	user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	updated INTEGER NOT NULL,
	size INTEGER NOT NULL,
	blob BLOB NOT NULL              -- gzip-komprimierter Trainingsstand, vom Server nicht ausgewertet
);
`;
