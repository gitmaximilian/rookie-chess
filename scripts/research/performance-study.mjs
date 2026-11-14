/**
 * Eichung der Partie-Elo („Wie stark habe ich in dieser Partie gespielt?“) an echten Lichess-Partien.
 *
 *   node scripts/research/performance-study.mjs <rapid.pgn> [depth=11] [engines=10] > perf.json
 *
 * Bewertet jede Stellung wie Rookie (Stockfish, Tiefe 11 = Rookie am Handy, MultiPV 2) und rechnet je Spieler:
 * Genauigkeit (Formel aus lib/analysis/classify.ts), Patzer/Fehler/Ungenauigkeiten je 30 Züge
 * (Schwellen wie Rookie) – zusammen mit seiner Lichess-Wertung. Daraus fittet performance-fit.mjs die
 * Abbildung Genauigkeit → Wertung samt Streuung.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { makeUci } from 'chessops/util';

const [, , file, depthArg, enginesArg] = process.argv;
const DEPTH = Number(depthArg ?? 11);
const ENGINES = Number(enginesArg ?? 10);

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
		await this.send(
			'setoption name Hash value 16\nsetoption name MultiPV value 2\nisready',
			'readyok'
		);
	}
	/** Bewertung aus Sicht der Seite am Zug: beste und zweitbeste Linie */
	async eval(fen) {
		const out = await this.send(`position fen ${fen}\ngo depth ${DEPTH}`, 'bestmove');
		const lines = new Map();
		for (const l of out.split('\n')) {
			const m = l.match(/ depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+)/);
			if (!m || Number(m[1]) !== DEPTH) continue;
			lines.set(Number(m[2]), m[3] === 'mate' ? (Number(m[4]) > 0 ? 10000 : -10000) : Number(m[4]));
		}
		const best = out.match(/bestmove (\S+)/)?.[1];
		return { cp: lines.get(1) ?? 0, second: lines.get(2), best };
	}
	quit() {
		this.p.stdin.write('quit\n');
	}
}

// wie lib/engine/uci.ts winChance (Lichess)
const win = (cp) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp))));
// wie lib/analysis/classify.ts accuracy()
function accuracy(losses) {
	if (!losses.length) return 100;
	const avg = (losses.reduce((a, b) => a + b, 0) / losses.length) * 50;
	return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avg) - 3.1669));
}

async function analyse(engine, g) {
	const h = g.headers;
	const pos = startingPosition(h).unwrap();
	const fens = [];
	const ucis = [];
	for (const node of g.moves.mainline()) {
		const mv = parseSan(pos, node.san);
		if (!mv) break;
		fens.push(makeFen(pos.toSetup()));
		ucis.push(makeUci(mv));
		pos.play(mv);
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
	const side = {
		white: {
			rating: Number(h.get('WhiteElo')),
			losses: [],
			b: 0,
			m: 0,
			i: 0,
			lenientB: 0,
			lenientM: 0,
			lenientI: 0
		},
		black: {
			rating: Number(h.get('BlackElo')),
			losses: [],
			b: 0,
			m: 0,
			i: 0,
			lenientB: 0,
			lenientM: 0,
			lenientI: 0
		}
	};
	for (let i = 0; i < ucis.length; i++) {
		const s = side[i % 2 === 0 ? 'white' : 'black'];
		const before = evals[i];
		const after = evals[i + 1];
		const wBest = win(before.cp);
		const wAfter = 1 - win(after.cp);
		const loss = ucis[i] === before.best ? 0 : Math.max(0, wBest - wAfter) * 2;
		s.losses.push(loss);
		const j = loss >= 0.3 ? 'b' : loss >= 0.2 ? 'm' : loss >= 0.1 ? 'i' : null;
		if (j) s[j]++;
		// nachsichtig: mindestens so gut wie die zweitbeste Linie, und die lag nah an der besten → kein Fehler
		const wSecond = before.second === undefined ? null : win(before.second);
		const fine = wSecond !== null && wBest - wSecond <= 0.05 && wAfter >= wSecond - 0.01;
		if (j && !fine) s[j === 'b' ? 'lenientB' : j === 'm' ? 'lenientM' : 'lenientI']++;
	}
	return ['white', 'black'].map((c) => {
		const s = side[c];
		const n = s.losses.length;
		return {
			rating: s.rating,
			moves: n,
			accuracy: Math.round(accuracy(s.losses) * 10) / 10,
			per30: { b: (s.b / n) * 30, m: (s.m / n) * 30, i: (s.i / n) * 30 },
			lenient30: { b: (s.lenientB / n) * 30, m: (s.lenientM / n) * 30, i: (s.lenientI / n) * 30 }
		};
	});
}

const games = parsePgn(readFileSync(file, 'utf8'));
const engines = await Promise.all(
	Array.from({ length: ENGINES }, async () => {
		const e = new Engine();
		await e.init();
		return e;
	})
);
const players = [];
let next = 0;
let done = 0;
const t0 = Date.now();
await Promise.all(
	engines.map(async (e) => {
		while (next < games.length) {
			const g = games[next++];
			try {
				const r = await analyse(e, g);
				players.push(...r.filter((p) => p.moves >= 10));
			} catch (err) {
				process.stderr.write(`skip: ${err}\n`);
			}
			if (++done % 50 === 0)
				process.stderr.write(
					`${done}/${games.length} (${Math.round((Date.now() - t0) / 1000)} s)\n`
				);
		}
	})
);
engines.forEach((e) => e.quit());
process.stdout.write(JSON.stringify({ depth: DEPTH, players }));
