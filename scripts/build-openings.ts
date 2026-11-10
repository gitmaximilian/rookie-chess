/**
 * Baut static/openings.json aus lichess-org/chess-openings (CC0).
 *   node scripts/build-openings.ts
 * Format: { "<uci uci …>": [eco, name] }
 */
import { writeFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';

/** Deutsche Namen der wichtigsten Eröffnungsfamilien */
const DE: Record<string, string> = {
	'Italian Game': 'Italienische Partie',
	'Ruy Lopez': 'Spanische Partie',
	'Sicilian Defense': 'Sizilianische Verteidigung',
	'French Defense': 'Französische Verteidigung',
	'Caro-Kann Defense': 'Caro-Kann-Verteidigung',
	"Queen's Gambit Declined": 'Abgelehntes Damengambit',
	"Queen's Gambit Accepted": 'Angenommenes Damengambit',
	"Queen's Gambit": 'Damengambit',
	"King's Gambit Accepted": 'Angenommenes Königsgambit',
	"King's Gambit Declined": 'Abgelehntes Königsgambit',
	"King's Gambit": 'Königsgambit',
	"King's Indian Defense": 'Königsindische Verteidigung',
	"King's Indian Attack": 'Königsindischer Angriff',
	"Queen's Indian Defense": 'Damenindische Verteidigung',
	'Nimzo-Indian Defense': 'Nimzoindische Verteidigung',
	'Grünfeld Defense': 'Grünfeld-Indische Verteidigung',
	'Slav Defense': 'Slawische Verteidigung',
	'Semi-Slav Defense': 'Halbslawische Verteidigung',
	'Scotch Game': 'Schottische Partie',
	'Four Knights Game': 'Vierspringerspiel',
	'Three Knights Opening': 'Dreispringerspiel',
	'Petrov’s Defense': 'Russische Verteidigung',
	"Petrov's Defense": 'Russische Verteidigung',
	'Philidor Defense': 'Philidor-Verteidigung',
	'Pirc Defense': 'Pirc-Verteidigung',
	'Modern Defense': 'Moderne Verteidigung',
	'Alekhine Defense': 'Aljechin-Verteidigung',
	'Scandinavian Defense': 'Skandinavische Verteidigung',
	'Dutch Defense': 'Holländische Verteidigung',
	'English Opening': 'Englische Eröffnung',
	'Réti Opening': 'Réti-Eröffnung',
	'London System': 'Londoner System',
	'Vienna Game': 'Wiener Partie',
	'Bishop’s Opening': 'Läuferspiel',
	"Bishop's Opening": 'Läuferspiel',
	'Two Knights Defense': 'Zweispringerspiel im Nachzuge',
	'Evans Gambit': 'Evans-Gambit',
	'Danish Gambit': 'Nordisches Gambit',
	'Center Game': 'Mittelgambit',
	'Benoni Defense': 'Benoni-Verteidigung',
	'Benko Gambit': 'Wolga-Gambit',
	'Catalan Opening': 'Katalanische Eröffnung',
	'Bird Opening': 'Bird-Eröffnung',
	'Owen Defense': 'Owen-Verteidigung',
	'Elephant Gambit': 'Elefantengambit',
	'Latvian Gambit': 'Lettisches Gambit',
	'Ponziani Opening': 'Ponziani-Eröffnung',
	'Hungarian Opening': 'Ungarische Eröffnung',
	'Van Geet Opening': 'Dunst-Eröffnung',
	'Polish Opening': 'Polnische Eröffnung (Sokolski)',
	'Nimzowitsch Defense': 'Nimzowitsch-Verteidigung',
	'Indian Defense': 'Indische Verteidigung',
	"Queen's Pawn Game": 'Damenbauernspiel',
	"King's Pawn Game": 'Königsbauernspiel',
	'Zukertort Opening': 'Zukertort-Eröffnung',
	'Bogo-Indian Defense': 'Bogoljubow-Indische Verteidigung',
	'Old Indian Defense': 'Altindische Verteidigung',
	'Trompowsky Attack': 'Trompowsky-Angriff',
	'Colle System': 'Colle-System',
	'Stonewall Attack': 'Stonewall-Angriff',
	'Smith-Morra Gambit': 'Morra-Gambit',
	'Englund Gambit': 'Englund-Gambit',
	'Budapest Defense': 'Budapester Gambit',
	'Blackmar-Diemer Gambit': 'Blackmar-Diemer-Gambit',
	'Giuoco Piano': 'Giuoco Piano',
	'Rat Defense': 'Rattenverteidigung',
	'St. George Defense': 'St.-Georgs-Verteidigung',
	'Mieses Opening': 'Mieses-Eröffnung',
	'Grob Opening': 'Grob-Eröffnung',
	'Amar Opening': 'Amar-Eröffnung',
	'Saragossa Opening': 'Saragossa-Eröffnung',
	'Ware Opening': 'Ware-Eröffnung',
	'Clemenz Opening': 'Clemenz-Eröffnung',
	'Kadas Opening': 'Kadas-Eröffnung',
	'Durkin Opening': 'Durkin-Eröffnung',
	'Barnes Opening': 'Barnes-Eröffnung',
	'Anderssen Opening': 'Anderssen-Eröffnung'
};

function translate(name: string): string {
	const [family, ...rest] = name.split(':');
	const de = DE[family.trim()];
	return de ? [de, ...rest].join(':') : name;
}

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
		if (!out[key] || name.length < out[key][1].length) out[key] = [eco, translate(name)];
		n++;
	}
}
writeFileSync('static/openings.json', JSON.stringify(out));
console.log(`${n} Eröffnungen, ${Object.keys(out).length} eindeutige Stellungen`);
