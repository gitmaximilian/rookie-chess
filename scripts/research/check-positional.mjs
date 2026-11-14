/**
 * Prüft die Aufgaben der Stellungsspiel-Lektionen mit Stockfish (Tiefe 18, MultiPV 8):
 * Für jede Aufgabe werden alle Züge, die zum Konzept passen (Filter) und höchstens 40 cp schlechter als der
 * beste Zug sind, als „richtig“ ausgegeben. Passt kein Konzeptzug, ist die Aufgabe falsch gestellt.
 *
 *   node scripts/research/check-positional.mjs
 */
import { spawn } from 'node:child_process';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeUci, parseSquare } from 'chessops/util';

const TASKS = JSON.parse(process.env.TASKS ?? '[]');

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
}

const e = new Engine();
await e.send('uci', 'uciok');
await e.send('setoption name MultiPV value 12\nsetoption name Hash value 64\nisready', 'readyok');
for (const t of TASKS) {
	let pos;
	try {
		pos = Chess.fromSetup(parseFen(t.fen).unwrap()).unwrap();
	} catch (err) {
		console.log(`✘ ${t.id}: ungültige Stellung (${err})`);
		continue;
	}
	const out = await e.send(`position fen ${t.fen}\ngo depth 18`, 'bestmove');
	const lines = new Map();
	for (const l of out.split('\n')) {
		const m = l.match(/ depth 18 .*multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/);
		if (m) lines.set(m[4], m[2] === 'mate' ? (Number(m[3]) > 0 ? 10000 : -10000) : Number(m[3]));
	}
	const sorted = [...lines.entries()].sort((a, b) => b[1] - a[1]);
	const best = sorted[0]?.[1] ?? 0;
	// Konzeptzüge: von bestimmten Feldern (from) und/oder auf bestimmte Felder (to) bzw. Rochade
	const legal = [];
	for (const [from, dests] of pos.allDests())
		for (const to of dests) legal.push(makeUci({ from, to }));
	const concept = legal.filter(
		(u) =>
			(!t.from || t.from.includes(u.slice(0, 2))) &&
			(!t.to || t.to.includes(u.slice(2, 4))) &&
			(!t.moves || t.moves.includes(u))
	);
	const ok = concept.filter((u) => lines.has(u) && best - lines.get(u) <= 40);
	console.log(
		`${ok.length ? '✔' : '✘'} ${t.id}: best ${sorted
			.slice(0, 5)
			.map(([u, cp]) => `${u} ${cp}`)
			.join(', ')} | Konzept ok: ${JSON.stringify(ok)}`
	);
	void parseSquare;
}
e.p.stdin.write('quit\n');
