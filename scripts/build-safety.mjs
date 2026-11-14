/**
 * Baut die Blunder-Check-Aufgaben (static/safety/items.json) aus den Lichess-Puzzle-Paketen (CC0).
 *
 *   node scripts/build-safety.mjs [proBand=110] [engines=8]
 *
 * Ein Lichess-Puzzle beginnt mit dem Zug, mit dem ein Mensch gepatzt hat (moves[0]); die Stellung davor
 * ist ein echter Moment „Ist mein Zug sicher?“. Für jede ausgewählte Stellung prüft Stockfish:
 * - der Patzer kostet wirklich viel (≥ 30 Prozentpunkte Gewinnchance),
 * - die Seite stand vorher nicht schon verloren (sonst gibt es keinen „sicheren“ Zug),
 * - der beste Zug ist sicher (verliert höchstens 5 Prozentpunkte) und ist nicht der Patzer.
 * Jede Stellung ergibt genau eine Aufgabe: abwechselnd der echte Patzer („nicht sicher“, mit Widerlegung)
 * oder der sichere Zug. Zwei feste Kontrolltest-Fassungen (A/B, je 12 Aufgaben, 600–1100) werden
 * markiert und kommen im Training nicht vor.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseFen, makeFen } from 'chessops/fen';
import { Chess } from 'chessops/chess';
import { parseUci } from 'chessops/util';

const PER_BAND = Number(process.argv[2] ?? 110);
const ENGINES = Number(process.argv[3] ?? 8);
const NODES = 300_000;
const OUT = new URL('../static/safety/items.json', import.meta.url);

/** Motive, die Einsteiger-Partien entscheiden (in dieser Reihenfolge als Hauptmotiv) */
const MOTIFS = [
	'hangingPiece',
	'mateIn1',
	'backRankMate',
	'fork',
	'pin',
	'skewer',
	'discoveredAttack',
	'mateIn2',
	'trappedPiece',
	'capturingDefender'
];

class Engine {
	constructor() {
		this.p = spawn('node', ['node_modules/stockfish/scripts/cli.js']);
		this.buf = '';
		this.wait = null;
		this.p.stdout.on('data', (d) => {
			this.buf += d;
			if (this.wait && this.buf.includes(this.wait.token)) {
				const out = this.buf;
				this.buf = '';
				const w = this.wait;
				this.wait = null;
				w.res(out);
			}
		});
	}
	send(cmd, token) {
		return new Promise((res) => {
			this.wait = { token, res };
			this.p.stdin.write(cmd + '\n');
		});
	}
	async init() {
		await this.send('uci', 'uciok');
		await this.send('setoption name Hash value 32\nisready', 'readyok');
	}
	/** Bewertung (cp aus Sicht der Seite am Zug) und bester Zug */
	async eval(fen) {
		const out = await this.send(`position fen ${fen}\ngo nodes ${NODES}`, 'bestmove');
		let cp = 0;
		for (const l of out.split('\n')) {
			const m = l.match(/ score (cp|mate) (-?\d+)/);
			if (m) cp = m[1] === 'mate' ? (Number(m[2]) > 0 ? 10000 : -10000) : Number(m[2]);
		}
		const best = out.match(/bestmove (\S+)/)?.[1];
		return { cp, best: best && best !== '(none)' ? best : null };
	}
	quit() {
		this.p.stdin.write('quit\n');
	}
}

const win = (cp) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp))));

function play(fen, uci) {
	const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
	const mv = parseUci(uci);
	if (!mv || !pos.isLegal(mv)) return null;
	pos.play(mv);
	if (pos.isEnd()) return { fen: makeFen(pos.toSetup()), end: pos.isCheckmate() ? 'mate' : 'draw' };
	return { fen: makeFen(pos.toSetup()), end: null };
}

// deterministischer Zufall: gleiche Auswahl bei jedem Lauf
let seed = 20261113;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const idx = JSON.parse(readFileSync(new URL('../static/puzzles/index.json', import.meta.url)));
const candidates = [];
for (const pack of idx.packs.filter((p) => p.min >= 400 && p.max < 1400)) {
	const raw = JSON.parse(readFileSync(new URL(`../static/puzzles/${pack.file}`, import.meta.url)));
	const pool = raw
		.map(([id, fen, moves, rating, t]) => ({
			id,
			fen,
			moves: moves.split(' '),
			rating,
			themes: t.map((i) => idx.themes[i])
		}))
		// kurze, klare Widerlegungen: Patzer + Antwort (+ höchstens ein weiteres Paar)
		.filter((p) => p.moves.length <= 4 && p.themes.some((t) => MOTIFS.includes(t)));
	// gemischt ziehen; hängende Figuren sind in den Paketen seltener als Matt-Aufgaben → zuerst
	pool.sort(() => rnd() - 0.5);
	pool.sort(
		(a, b) => Number(b.themes.includes('hangingPiece')) - Number(a.themes.includes('hangingPiece'))
	);
	candidates.push(...pool.slice(0, PER_BAND * 4).map((p) => ({ ...p, band: pack.min })));
}

const engines = await Promise.all(
	Array.from({ length: ENGINES }, async () => {
		const e = new Engine();
		await e.init();
		return e;
	})
);
const accepted = [];
const perBand = new Map();
const perGroup = new Map();
/** Anteil je Motivgruppe pro Band (Summe > 1, damit Bänder auch bei knappen Gruppen voll werden) */
const QUOTA = { hanging: 0.4, tactic: 0.4, mate: 0.3, other: 0.15 };
const GROUP = {
	hangingPiece: 'hanging',
	trappedPiece: 'hanging',
	capturingDefender: 'hanging',
	fork: 'tactic',
	pin: 'tactic',
	skewer: 'tactic',
	discoveredAttack: 'tactic',
	mateIn1: 'mate',
	mateIn2: 'mate',
	backRankMate: 'mate'
};
let next = 0;
let checked = 0;
await Promise.all(
	engines.map(async (e) => {
		while (next < candidates.length) {
			const c = candidates[next++];
			if ((perBand.get(c.band) ?? 0) >= PER_BAND) continue;
			// Motive wie in echten Einsteiger-Partien (docs/research: hängende Figuren sind der häufigste
			// Patzer, Matt-Fehler seltener, aber entscheidend): Quoten je Band
			const motif = MOTIFS.find((t) => c.themes.includes(t));
			const group = GROUP[motif] ?? 'other';
			const key = `${c.band}:${group}`;
			if ((perGroup.get(key) ?? 0) >= Math.round(PER_BAND * QUOTA[group])) continue;
			checked++;
			const before = await e.eval(c.fen);
			if (!before.best || before.best === c.moves[0]) continue;
			// stand die Seite schon verloren? Dann gibt es keinen sinnvollen „sicheren“ Zug
			if (before.cp < -150) continue;
			const blunder = play(c.fen, c.moves[0]);
			const safe = play(c.fen, before.best);
			if (!blunder || !safe) continue;
			const afterBlunder = blunder.end ? null : await e.eval(blunder.fen);
			const afterSafe =
				safe.end === 'mate' ? { cp: -10000 } : safe.end ? { cp: 0 } : await e.eval(safe.fen);
			if (!afterBlunder) continue;
			const wBefore = win(before.cp);
			const lossBlunder = wBefore - (1 - win(afterBlunder.cp));
			const lossSafe = wBefore - (1 - win(afterSafe.cp));
			if (lossBlunder < 0.3 || lossSafe > 0.05) continue;
			// Widerlegung = erster Zug der Lichess-Lösung; muss auch Stockfishs Wahl sein (eindeutig)
			if (afterBlunder.best !== c.moves[1]) continue;
			const theme = motif;
			// parallel geprüft: Quoten erst hier verbindlich zählen
			if ((perBand.get(c.band) ?? 0) >= PER_BAND) continue;
			if ((perGroup.get(key) ?? 0) >= Math.round(PER_BAND * QUOTA[group])) continue;
			perBand.set(c.band, (perBand.get(c.band) ?? 0) + 1);
			perGroup.set(key, (perGroup.get(key) ?? 0) + 1);
			accepted.push({ ...c, safeMove: before.best, theme });
			if (accepted.length % 50 === 0)
				process.stderr.write(`${accepted.length} Aufgaben (${checked} geprüft)\n`);
		}
	})
);
engines.forEach((e) => e.quit());

// Reihenfolge stabil (nach Puzzle-ID), dann sicher/unsicher abwechselnd
accepted.sort((a, b) => a.id.localeCompare(b.id));
const items = accepted.map((c, i) => {
	const safe = i % 2 === 0;
	return {
		id: c.id,
		fen: c.fen,
		move: safe ? c.safeMove : c.moves[0],
		safe: safe ? 1 : 0,
		reply: safe ? '' : c.moves[1],
		rating: c.rating,
		theme: c.theme,
		form: ''
	};
});

// Kontrolltest: je Fassung 6 sichere + 6 unsichere aus 600–1100, gleiche Wertungsverteilung
const testPool = items.filter((x) => x.rating >= 600 && x.rating < 1100);
for (const form of ['A', 'B'])
	for (const safe of [1, 0]) {
		const pick = testPool
			.filter((x) => x.safe === safe && !x.form)
			.sort((a, b) => a.rating - b.rating)
			.filter((_, i, arr) => i % Math.floor(arr.length / 7) === 0)
			.slice(0, 6);
		for (const x of pick) x.form = form;
	}

writeFileSync(
	OUT,
	JSON.stringify(
		items.map((x) => [x.id, x.fen, x.move, x.safe, x.reply, x.rating, x.theme, x.form])
	)
);
const count = (f) => items.filter(f).length;
console.log(
	`${items.length} Aufgaben (${count((x) => x.safe)} sicher, ${count((x) => !x.safe)} nicht sicher), ` +
		`Kontrolltest A: ${count((x) => x.form === 'A')}, B: ${count((x) => x.form === 'B')}; ${checked} Stellungen geprüft`
);
