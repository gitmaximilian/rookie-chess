/**
 * Stimmen die Abstände zwischen Rookies Bots? Benachbarte Bots spielen gegeneinander –
 * mit genau Rookies Zugwahl (lib/bots/bots.ts: Stockfish mit Knoten-Limit, Skill Level, MultiPV,
 * Softmax über den Verlust, zufällige „Aussetzer“). Aus dem Ergebnis folgt der Elo-Abstand
 * (Elo-Formel), verglichen mit dem Abstand der Beschriftung.
 *
 *   node scripts/research/bot-ladder.mjs [partien=40] [engines=10]
 *
 * Grenze: Das misst nur die Abstände untereinander, nicht die absolute Höhe. Unter ~1320 gibt es in
 * Stockfish keine Referenz (UCI_Elo), und die ist an Engine-Listen geeicht, nicht an Menschen.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import { parseUci, makeUci } from 'chessops/util';

const GAMES = Number(process.argv[2] ?? 40);
const ENGINES = Number(process.argv[3] ?? 10);
/** optional: Partien als JSON speichern (für bot-human.mjs) */
const DUMP = process.argv[4];
const dumped = [];

// Bot-Einstellungen direkt aus der Quelle lesen (keine Kopie, die veraltet)
const src = readFileSync(new URL('../../src/lib/bots/bots.ts', import.meta.url), 'utf8');
const BOTS = [
	...src.matchAll(
		/id: '(\w+)'[\s\S]*?elo: (\d+)[\s\S]*?nodes: (\d+),\s*multipv: (\d+),\s*skill: (\d+),\s*temperature: (\d+),\s*blunder: ([\d.]+)/g
	)
].map((m) => ({
	id: m[1],
	elo: Number(m[2]),
	nodes: Number(m[3]),
	multipv: Number(m[4]),
	skill: Number(m[5]),
	temperature: Number(m[6]),
	blunder: Number(m[7])
}));

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
	async lines(fen, bot) {
		const out = await this.send(
			`setoption name MultiPV value ${bot.multipv}\nsetoption name Skill Level value ${bot.skill}\nucinewgame\nposition fen ${fen}\ngo nodes ${bot.nodes}`,
			'bestmove'
		);
		const map = new Map();
		for (const l of out.split('\n')) {
			const m = l.match(/ multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
			if (m) map.set(Number(m[1]), { [m[2]]: Number(m[3]), pv: m[4].trim().split(' ') });
		}
		return [...map.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
	}
	quit() {
		this.p.stdin.write('quit\n');
	}
}

// wie lib/engine/uci.ts scoreToCp
const cpOf = (s) =>
	s.mate !== undefined
		? s.mate === 0
			? -10000
			: Math.sign(s.mate) * (10000 - Math.abs(s.mate) * 10)
		: (s.cp ?? 0);

// wie lib/bots/bots.ts chooseBotMove
function choose(bot, lines, legal, captures, rng) {
	const cand = lines.filter((l) => l.pv.length > 0);
	if (!legal.length) return null;
	if (!cand.length || rng() < bot.blunder) {
		const pool = captures.length && rng() < 0.6 ? captures : legal;
		return pool[Math.floor(rng() * pool.length)];
	}
	const best = cpOf(cand[0]);
	if (cand[0].mate === 1 && rng() > bot.blunder * 2) return cand[0].pv[0];
	const w = cand.map((l) => Math.exp(-(best - cpOf(l)) / bot.temperature));
	let r = rng() * w.reduce((a, b) => a + b, 0);
	for (let i = 0; i < cand.length; i++) {
		r -= w[i];
		if (r <= 0) return cand[i].pv[0];
	}
	return cand[0].pv[0];
}

let seed = 1613;
const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

async function play(engine, white, black) {
	const moves = [];
	const r = await playInner(engine, white, black, moves);
	if (DUMP) dumped.push({ white: white.id, black: black.id, moves, result: r });
	return r;
}

async function playInner(engine, white, black, moves) {
	const pos = Chess.fromSetup(parseFen(INITIAL_FEN).unwrap()).unwrap();
	const seen = new Map();
	for (let ply = 0; ply < 300; ply++) {
		if (pos.isEnd()) break;
		const key = makeFen(pos.toSetup()).split(' ').slice(0, 4).join(' ');
		seen.set(key, (seen.get(key) ?? 0) + 1);
		if (seen.get(key) >= 3 || pos.halfmoves >= 100) return 0.5;
		const bot = pos.turn === 'white' ? white : black;
		const legal = [];
		const captures = [];
		for (const [from, dests] of pos.allDests())
			for (const to of dests) {
				const u = makeUci({ from, to });
				const piece = pos.board.get(from);
				const promo = piece?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0);
				const uci = promo ? u + 'q' : u;
				legal.push(uci);
				if (pos.board.get(to)) captures.push(uci);
			}
		const lines = await engine.lines(makeFen(pos.toSetup()), bot);
		const uci = choose(bot, lines, legal, captures, rng);
		const mv = uci && parseUci(uci);
		if (!mv || !pos.isLegal(mv)) break;
		pos.play(mv);
		moves.push(uci);
	}
	const o = pos.outcome();
	if (!o) {
		// Abbruch nach 300 Halbzügen: nach Material werten
		let m = 0;
		const v = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
		for (const sq of pos.board.occupied) {
			const p = pos.board.get(sq);
			m += (p.color === 'white' ? 1 : -1) * v[p.role];
		}
		return m > 2 ? 1 : m < -2 ? 0 : 0.5;
	}
	return o.winner === 'white' ? 1 : o.winner === 'black' ? 0 : 0.5;
}

const engines = await Promise.all(
	Array.from({ length: ENGINES }, async () => {
		const e = new Engine();
		await e.init();
		return e;
	})
);
const jobs = [];
for (let i = 0; i + 1 < BOTS.length; i++)
	for (let g = 0; g < GAMES; g++) {
		// abwechselnd Farben
		const [a, b] = [BOTS[i], BOTS[i + 1]];
		jobs.push({ pair: i, weakerWhite: g % 2 === 0, a, b });
	}
const score = BOTS.slice(0, -1).map(() => ({ weaker: 0, n: 0 }));
let next = 0;
await Promise.all(
	engines.map(async (e) => {
		while (next < jobs.length) {
			const j = jobs[next++];
			const r = j.weakerWhite ? await play(e, j.a, j.b) : 1 - (await play(e, j.b, j.a));
			score[j.pair].weaker += r;
			score[j.pair].n++;
		}
	})
);
engines.forEach((e) => e.quit());
if (DUMP) (await import('node:fs')).writeFileSync(DUMP, JSON.stringify(dumped));

console.log(
	'| Paar | Beschriftung (Abstand) | Ergebnis des schwächeren | gemessener Abstand | 95-%-Bereich |'
);
console.log('|---|---|---|---|---|');
const elo = (p) => -400 * Math.log10(1 / Math.min(0.99, Math.max(0.01, p)) - 1);
for (let i = 0; i + 1 < BOTS.length; i++) {
	const s = score[i];
	const p = s.weaker / s.n;
	const se = Math.sqrt((p * (1 - p)) / s.n);
	const lo = elo(Math.max(0.01, p - 1.96 * se));
	const hi = elo(Math.min(0.99, p + 1.96 * se));
	console.log(
		`| ${BOTS[i].id} – ${BOTS[i + 1].id} | ${BOTS[i].elo} – ${BOTS[i + 1].elo} (${BOTS[i + 1].elo - BOTS[i].elo}) | ${s.weaker}/${s.n} | ${Math.round(-elo(p))} | ${Math.round(-hi)} … ${Math.round(-lo)} |`
	);
}
