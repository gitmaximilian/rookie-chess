/**
 * Baut static/openings.json aus lichess-org/chess-openings (CC0).
 *   node scripts/build-openings.ts
 * Format: { "<uci uci …>": [eco, englischer Name] } – Deutsch übersetzt die App (src/lib/data/openingNamesDe.ts)
 */
import { writeFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';

const out: Record<string, [string, string]> = {};
let n = 0;
for (const f of ['a', 'b', 'c', 'd', 'e']) {
	const res = await fetch(`${BASE}${f}.tsv`);
	if (!res.ok) throw new Error(`Download fehlgeschlagen: ${f}.tsv`);
	const lines = (await res.text()).trim().split('\n').slice(1);
	for (const line of lines) {
		const [eco, name, pgn] = line.split('\t');
		const pos = Chess.default();
		const ucis: string[] = [];
		let ok = true;
		for (const tok of pgn.split(/\s+/)) {
			if (/^\d+\./.test(tok) || !tok) continue;
			const m = parseSan(pos, tok);
			if (!m) {
				ok = false;
				break;
			}
			ucis.push(makeUci(m));
			pos.play(m);
		}
		if (!ok) continue;
		const key = ucis.join(' ');
		// kürzere Namen bei Duplikaten bevorzugen
		if (!out[key] || name.length < out[key][1].length) out[key] = [eco, name];
		n++;
	}
}
writeFileSync('static/openings.json', JSON.stringify(out));
console.log(`${n} Eröffnungen, ${Object.keys(out).length} eindeutige Stellungen`);
