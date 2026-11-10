// Kopiert die Stockfish-Lite-Builds (WASM, ca. 1,8 MB) nach static/engine/.
// Läuft automatisch nach `npm install` (postinstall) – auch auf Cloudflare.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = 'node_modules/stockfish/bin';
const dest = 'static/engine';
const files = [
	'stockfish-19-lite.js',
	'stockfish-19-lite.wasm',
	'stockfish-19-lite-single.js',
	'stockfish-19-lite-single.wasm'
];

if (!existsSync(src)) {
	console.warn('[copy-engine] stockfish nicht installiert – übersprungen');
	process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const f of files) copyFileSync(join(src, f), join(dest, f));
console.log(`[copy-engine] ${files.length} Dateien nach ${dest} kopiert`);
