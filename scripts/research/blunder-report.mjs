/**
 * Fasst die Ergebnisse von blunder-study.mjs zusammen (Markdown-Tabellen für docs/research-*.md).
 *
 *   node scripts/research/blunder-report.mjs <result.json> <sample.pgn>
 *
 * Die Spielphase eines Patzers (nach Material wie in lib/training/gamestats.ts) wird aus dem PGN
 * nachgerechnet; Partien werden über Band, Tempo, Ergebnis und Länge zugeordnet (mehrdeutige ausgelassen).
 */
import { readFileSync } from 'node:fs';
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';

const [, , resFile, pgnFile] = process.argv;
const { games, nodes } = JSON.parse(readFileSync(resFile, 'utf8'));

// ── Phasen aus dem PGN ──
const RAPID = ['600+0', '600+5', '900+10', '900+0', '1200+0', '600+2', '480+3'];
const bandOf = (e) =>
	[
		[400, 800],
		[800, 1000],
		[1000, 1200],
		[1200, 1400],
		[1600, 1800]
	]
		.filter(([a, z]) => e >= a && e < z)
		.map(([a, z]) => `${a}-${z}`)[0] ?? null;
const phasesByKey = new Map();
for (const g of parsePgn(readFileSync(pgnFile, 'utf8'))) {
	const h = g.headers;
	const band = bandOf(Math.round((Number(h.get('WhiteElo')) + Number(h.get('BlackElo'))) / 2));
	const speed = RAPID.includes(h.get('TimeControl')) ? 'rapid' : 'blitz';
	const pos = startingPosition(h).unwrap();
	const phases = [];
	let phase = 'opening';
	let i = 0;
	for (const node of g.moves.mainline()) {
		const mv = parseSan(pos, node.san);
		if (!mv) break;
		// Phase der Stellung vor dem Zug
		let pieces = 0;
		let backW = 0;
		let backB = 0;
		for (const sq of pos.board.occupied) {
			const p = pos.board.get(sq);
			if (p.role !== 'pawn' && p.role !== 'king') pieces++;
			if (p.role !== 'pawn' && sq < 8 && p.color === 'white') backW++;
			if (p.role !== 'pawn' && sq >= 56 && p.color === 'black') backB++;
		}
		if (pieces <= 6) phase = 'endgame';
		else if (phase === 'opening' && (i > 30 || pieces <= 10 || backW < 4 || backB < 4))
			phase = 'middlegame';
		phases.push(phase);
		pos.play(mv);
		i++;
	}
	const key = `${band}|${speed}|${h.get('Result')}|${phases.length}`;
	phasesByKey.set(key, phasesByKey.has(key) ? null : phases);
}

const valid = games.filter((g) => g.plies >= 10);
const bands = [...new Set(valid.map((g) => g.band))].sort(
	(a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0])
);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const r1 = (x) => Math.round(x * 10) / 10;

const motifs = [
	'hanging-moved',
	'hanging-left',
	'mate-allowed-backrank',
	'mate-allowed',
	'tactic-1',
	'fork',
	'tactic-2',
	'missed-win',
	'pawn-lost',
	'missed-pawn',
	'mate-missed',
	'other'
];
const LABEL = {
	'hanging-moved': 'Figur auf ungedecktes/angegriffenes Feld gezogen',
	'hanging-left': 'Figur stehen gelassen (hing schon/wurde angegriffen)',
	'mate-allowed-backrank': 'Grundreihenmatt zugelassen',
	'mate-allowed': 'anderes Matt zugelassen',
	'tactic-1': 'anderer Einzüger (z. B. Abzug, Fesselung)',
	fork: 'Gabel zugelassen',
	'tactic-2': 'Material weg nach 2 Gegnerzügen',
	'missed-win': 'Figurengewinn verpasst (≤ 2 eigene Züge)',
	'pawn-lost': 'Bauer eingestellt',
	'missed-pawn': 'Bauerngewinn verpasst',
	'mate-missed': 'eigenes Matt verpasst',
	other: 'Sonstiges (tiefere Taktik, Stellung)'
};

const out = [];
out.push(
	`Stichprobe: ${valid.length} Partien (≥ 10 Halbzüge), Lichess-Datenbank Oktober 2026, Stockfish 19 mit ${nodes} Knoten je Stellung.`,
	''
);

// Tabelle 1: Patzer je 30 Züge, Anteil Ein-Zug-Patzer, Entscheidung
out.push(
	'| Band | Tempo | Partien | Patzer je 30 eigene Züge | Patzer „live“ (Stellung noch offen) je 30 | davon in Zeitnot | Partien mit ≥ 1 Patzer | Gegnerpatzer sofort bestraft | Verluste durch Zeit | Matt als Ende |',
	'|---|---|---|---|---|---|---|---|---|---|'
);
const summary = {};
for (const band of bands)
	for (const speed of ['rapid', 'blitz', 'all']) {
		const gs = valid.filter((g) => g.band === band && (speed === 'all' || g.speed === speed));
		if (!gs.length) continue;
		const moves = gs.reduce((s, g) => s + g.moves.white + g.moves.black, 0);
		const bl = gs.flatMap((g) => g.blunders);
		const live = bl.filter((b) => b.live);
		const decisive = gs.filter((g) => g.result !== '1/2-1/2');
		const chances = gs.reduce((s, g) => ({ t: s.t + g.chances.total, k: s.k + g.chances.taken }), {
			t: 0,
			k: 0
		});
		const row = {
			n: gs.length,
			per30: r1((bl.length / moves) * 30),
			live30: r1((live.length / moves) * 30),
			lowTime: pct(live.filter((b) => b.lowTime).length, live.length),
			anyBlunder: pct(gs.filter((g) => g.blunders.length).length, gs.length),
			punished: pct(chances.k, chances.t),
			timeLoss: pct(decisive.filter((g) => g.ending === 'time').length, decisive.length),
			mate: pct(gs.filter((g) => g.ending === 'mate').length, gs.length)
		};
		summary[`${band}|${speed}`] = { ...row, live };
		if (speed === 'all') continue;
		out.push(
			`| ${band} | ${speed} | ${row.n} | ${row.per30} | ${row.live30} | ${row.lowTime} % | ${row.anyBlunder} % | ${row.punished} % | ${row.timeLoss} % | ${row.mate} % |`
		);
	}

// Tabelle 2: Arten der Patzer (live)
out.push(
	'',
	'Arten der Patzer (nur „live“, beide Tempi), Anteil in %:',
	'',
	`| Art | ${bands.join(' | ')} |`,
	`|---|${bands.map(() => '---').join('|')}|`
);
for (const m of motifs)
	out.push(
		`| ${LABEL[m]} | ${bands
			.map((b) => {
				const l = summary[`${b}|all`].live;
				return pct(l.filter((x) => x.motif === m).length, l.length) + ' %';
			})
			.join(' | ')} |`
	);
// sichtbare Einzüger: Figur hängt/Matt in 1/Gabel
out.push(
	`| **Einzüger zusammen (Figur hängt, anderer Einzüger, Matt in 1 zugelassen/verpasst)** | ${bands
		.map((b) => {
			const l = summary[`${b}|all`].live;
			return (
				pct(
					l.filter(
						(x) =>
							x.motif.startsWith('hanging') ||
							x.motif === 'tactic-1' ||
							((x.motif === 'mate-allowed' || x.motif === 'mate-allowed-backrank') &&
								x.depth === 1) ||
							(x.motif === 'mate-missed' && x.depth === 1)
					).length,
					l.length
				) + ' %'
			);
		})
		.join(' | ')} |`
);

// Tabelle 3: Phase der Patzer
const phaseCount = {};
let matched = 0;
for (const g of valid) {
	const ph = phasesByKey.get(`${g.band}|${g.speed}|${g.result}|${g.plies}`);
	if (!ph) continue;
	matched++;
	for (const b of g.blunders) {
		if (!b.live) continue;
		const p = ph[b.ply - 1] ?? 'endgame';
		const k = `${g.band}|${p}`;
		phaseCount[k] = (phaseCount[k] ?? 0) + 1;
	}
	const reached = ph.includes('endgame');
	const k2 = `${g.band}|reachedEndgame`;
	phaseCount[k2] = (phaseCount[k2] ?? 0) + (reached ? 1 : 0);
	phaseCount[`${g.band}|games`] = (phaseCount[`${g.band}|games`] ?? 0) + 1;
}
out.push(
	'',
	`Phase der Patzer („live“, ${matched} zugeordnete Partien), Anteil in %, und Partien, die ein Endspiel erreichen:`,
	'',
	`| | ${bands.join(' | ')} |`,
	`|---|${bands.map(() => '---').join('|')}|`
);
for (const p of ['opening', 'middlegame', 'endgame']) {
	out.push(
		`| ${p} | ${bands
			.map((b) => {
				const tot = ['opening', 'middlegame', 'endgame'].reduce(
					(s, x) => s + (phaseCount[`${b}|${x}`] ?? 0),
					0
				);
				return pct(phaseCount[`${b}|${p}`] ?? 0, tot) + ' %';
			})
			.join(' | ')} |`
	);
}
out.push(
	`| Partien mit Endspiel (≤ 6 Figuren) | ${bands
		.map((b) => pct(phaseCount[`${b}|reachedEndgame`] ?? 0, phaseCount[`${b}|games`] ?? 0) + ' %')
		.join(' | ')} |`
);

// Streuung: Patzer je 30 Züge pro Partie (für Messbarkeit)
out.push(
	'',
	'Streuung (für die Fortschrittsmessung): Patzer je 30 eigene Züge pro Spieler und Partie',
	''
);
out.push(
	'| Band | Mittel | Standardabw. je Partie | 95-%-Band für Mittel aus 10 Partien | aus 20 Partien |',
	'|---|---|---|---|---|'
);
for (const band of bands) {
	const xs = [];
	for (const g of valid.filter((x) => x.band === band))
		for (const c of ['white', 'black']) {
			if (g.moves[c] < 10) continue;
			xs.push((g.blunders.filter((b) => b.color === c && b.live).length / g.moves[c]) * 30);
		}
	const m = xs.reduce((a, b) => a + b, 0) / xs.length;
	const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
	out.push(
		`| ${band} | ${r1(m)} | ${r1(sd)} | ± ${r1((1.96 * sd) / Math.sqrt(10))} | ± ${r1((1.96 * sd) / Math.sqrt(20))} |`
	);
}
console.log(out.join('\n'));
