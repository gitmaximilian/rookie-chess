/**
 * Auf welchem menschlichen Niveau patzen Rookies Bots? Bewertet die Partien aus bot-ladder.mjs
 * (… <partien> <engines> <dump.json>) mit Stockfish Tiefe 11 – wie die Lichess-Eichung
 * (performance-study.mjs) – und ordnet jeden Bot nach Patzern je 30 Zügen und Genauigkeit
 * den Lichess-Rapid-Bändern zu.
 *
 *   node scripts/research/bot-human.mjs dump.json [engines=10]
 *
 * Grenze: Bots patzen anders als Menschen (zufällige Aussetzer statt übersehener Drohungen);
 * gleiche Patzerrate heißt nicht gleiche Spielstärke. Es ist eine Einordnung, keine Eichung.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import { parseUci } from 'chessops/util';

const [, , file, enginesArg] = process.argv;
const ENGINES = Number(enginesArg ?? 10);
const games = JSON.parse(readFileSync(file, 'utf8'));

/** Lichess Rapid, Oktober 2026, Tiefe 11 (docs/research-2026-11-13.md, Frage 8) */
const HUMAN = [
	{ r: 500, b30: 4.2, acc: 74.4 },
	{ r: 700, b30: 4.0, acc: 74.8 },
	{ r: 900, b30: 3.3, acc: 78.0 },
	{ r: 1100, b30: 2.9, acc: 80.2 },
	{ r: 1300, b30: 2.7, acc: 81.1 },
	{ r: 1500, b30: 2.4, acc: 82.2 },
	{ r: 1700, b30: 2.2, acc: 83.4 },
	{ r: 1900, b30: 2.0, acc: 84.7 },
	{ r: 2100, b30: 1.6, acc: 86.3 }
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
		await this.send('setoption name Hash value 16\nisready', 'readyok');
	}
	async eval(fen) {
		const out = await this.send(`position fen ${fen}\ngo depth 11`, 'bestmove');
		let cp = 0;
		for (const l of out.split('\n')) {
			const m = l.match(/ depth 11 .*score (cp|mate) (-?\d+)/);
			if (m) cp = m[1] === 'mate' ? (Number(m[2]) > 0 ? 10000 : -10000) : Number(m[2]);
		}
		return { cp, best: out.match(/bestmove (\S+)/)?.[1] };
	}
	quit() {
		this.p.stdin.write('quit\n');
	}
}

const win = (cp) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp))));
const accuracy = (losses) => {
	const avg = (losses.reduce((a, b) => a + b, 0) / losses.length) * 50;
	return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avg) - 3.1669));
};

/** Wertung, bei der Menschen im Schnitt diesen Wert haben (linear zwischen den Bändern) */
function levelBy(key, v) {
	const t = HUMAN;
	const desc = t[0][key] > t.at(-1)[key];
	if (desc ? v > t[0][key] : v < t[0][key]) return `< ${t[0].r}`;
	if (desc ? v < t.at(-1)[key] : v > t.at(-1)[key]) return `> ${t.at(-1).r}`;
	for (let i = 1; i < t.length; i++) {
		const a = t[i - 1][key];
		const b = t[i][key];
		if ((v - a) * (v - b) <= 0) {
			const f = a === b ? 0 : (v - a) / (b - a);
			return String(Math.round((t[i - 1].r + f * (t[i].r - t[i - 1].r)) / 50) * 50);
		}
	}
	return '?';
}

const per = new Map();
async function analyse(engine, g) {
	const pos = Chess.fromSetup(parseFen(INITIAL_FEN).unwrap()).unwrap();
	const fens = [];
	for (const u of g.moves) {
		fens.push(makeFen(pos.toSetup()));
		pos.play(parseUci(u));
	}
	const evals = [];
	for (const f of fens) evals.push(await engine.eval(f));
	evals.push(
		pos.isCheckmate()
			? { cp: -10000 }
			: pos.isEnd()
				? { cp: 0 }
				: await engine.eval(makeFen(pos.toSetup()))
	);
	g.moves.forEach((u, i) => {
		const id = i % 2 === 0 ? g.white : g.black;
		const s = per.get(id) ?? { losses: [], b: 0 };
		const loss =
			u === evals[i].best ? 0 : Math.max(0, win(evals[i].cp) - (1 - win(evals[i + 1].cp))) * 2;
		s.losses.push(loss);
		if (loss >= 0.3) s.b++;
		per.set(id, s);
	});
}

const engines = await Promise.all(
	Array.from({ length: ENGINES }, async () => {
		const e = new Engine();
		await e.init();
		return e;
	})
);
let next = 0;
await Promise.all(
	engines.map(async (e) => {
		while (next < games.length) await analyse(e, games[next++]);
	})
);
engines.forEach((e) => e.quit());

const order = ['bruno', 'pia', 'leo', 'tina', 'kai', 'rita', 'sven', 'doris'];
console.log('| Bot | Züge | Patzer je 30 | wie Menschen um | Genauigkeit | wie Menschen um |');
console.log('|---|---|---|---|---|---|');
for (const id of order) {
	const s = per.get(id);
	if (!s) continue;
	const b30 = (s.b / s.losses.length) * 30;
	const acc = accuracy(s.losses);
	console.log(
		`| ${id} | ${s.losses.length} | ${b30.toFixed(1)} | ${levelBy('b30', b30)} | ${acc.toFixed(1)} | ${levelBy('acc', acc)} |`
	);
}
