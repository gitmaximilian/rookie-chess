/**
 * Was entscheidet Partien bei Einsteigern? Auswertung echter Lichess-Partien (CC0-Datenbank).
 *
 *   node scripts/research/blunder-study.mjs <sample.pgn> [nodes] [engines] > result.json
 *
 * Jede Stellung wird mit Stockfish (fester Knotenzahl) bewertet. Ein Zug ist ein Patzer, wenn er
 * mindestens 30 Prozentpunkte Gewinnchance kostet – dieselbe Schwelle wie Rookie (lib/analysis/classify.ts).
 * Die Einordnung folgt Rookies Erklärungslogik (lib/analysis/explain.ts), hier ohne Übersetzungen:
 * Matt verpasst, Matt zugelassen (Grundreihe ja/nein), Figur eingestellt (gerade gezogen / stehen gelassen),
 * Gabel zugelassen, Gewinn verpasst, Sonstiges. Dazu: Zeitnot, Endart, verpasste Chancen.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { parseUci, makeUci } from 'chessops/util';
import { attacks } from 'chessops/attacks';

const [, , file, nodesArg, enginesArg] = process.argv;
const NODES = Number(nodesArg ?? 30000);
const ENGINES = Number(enginesArg ?? 8);
const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

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
	/** Bewertung aus Sicht der Seite am Zug */
	async eval(fen) {
		const out = await this.send(`position fen ${fen}\ngo nodes ${NODES}`, 'bestmove');
		let last = null;
		for (const l of out.split('\n')) {
			const m = l.match(/ score (cp|mate) (-?\d+).* pv (.+)$/);
			if (m) last = { [m[1]]: Number(m[2]), pv: m[3].trim().split(' ') };
		}
		const best = out.match(/bestmove (\S+)/)?.[1];
		return { ...(last ?? { cp: 0, pv: [] }), best: best && best !== '(none)' ? best : undefined };
	}
	quit() {
		this.p.stdin.write('quit\n');
	}
}

const cpOf = (e) => (e.mate !== undefined ? (e.mate > 0 ? 10000 : -10000) : e.cp);
const win = (cp) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp))));

function speedOf(tc) {
	return ['600+0', '600+5', '900+10', '900+0', '1200+0', '600+2', '480+3'].includes(tc)
		? 'rapid'
		: 'blitz';
}
function bandOf(elo) {
	const b = [
		[400, 800],
		[800, 1000],
		[1000, 1200],
		[1200, 1400],
		[1600, 1800]
	].find(([a, z]) => elo >= a && elo < z);
	return b ? `${b[0]}-${b[1]}` : null;
}

/** Einordnung eines Patzers, wie Rookies explain() */
function classify(posBefore, mv, before, after) {
	const me = posBefore.turn;
	// before/after aus Sicht der Seite am Zug in der jeweiligen Stellung
	if (before.mate !== undefined && before.mate > 0 && !(after.mate !== undefined && after.mate < 0))
		return { motif: 'mate-missed', depth: before.mate };
	const posAfter = posBefore.clone();
	posAfter.play(mv);
	if (after.mate !== undefined && after.mate > 0) {
		// Grundreihe: Matt durch Turm/Dame auf der Grundreihe des eigenen Königs
		let backRank = false;
		if (after.mate === 1 && after.best) {
			const r = parseUci(after.best);
			const p = posAfter.board.get(r.from);
			const rank = Math.floor(r.to / 8);
			backRank =
				!!p && (p.role === 'rook' || p.role === 'queen') && rank === (me === 'white' ? 0 : 7);
		}
		return { motif: backRank ? 'mate-allowed-backrank' : 'mate-allowed', depth: after.mate };
	}
	// Materialverlust entlang der Engine-Variante: nach Antwort + eigener Antwort (1 Gegnerzug)
	// bzw. nach 2 Gegnerzügen – so werden Abtausche nicht als „hängende Figur“ gezählt
	const lossAt = linearLoss(posAfter, after.pv ?? [], me);
	const reply = after.best ? parseUci(after.best) : null;
	let forkPattern = false;
	if (reply && 'from' in reply) {
		const rp = posAfter.clone();
		const piece = rp.board.get(reply.from);
		if (piece && rp.isLegal(reply)) {
			rp.play(reply);
			let n = 0;
			for (const sq of attacks(piece, reply.to, rp.board.occupied)) {
				const p = rp.board.get(sq);
				if (
					p &&
					p.color === me &&
					(p.role === 'king' || VALUE[p.role] > VALUE[piece.role] || VALUE[p.role] >= 3)
				)
					n++;
			}
			forkPattern = n >= 2;
		}
	}
	if (lossAt[1] >= 2 && reply && 'from' in reply) {
		const victim = posAfter.board.get(reply.to);
		if (victim && victim.color === me)
			return { motif: reply.to === mv.to ? 'hanging-moved' : 'hanging-left', depth: 1 };
		return { motif: forkPattern ? 'fork' : 'tactic-1', depth: 1 };
	}
	if (lossAt[2] >= 2) return { motif: forkPattern ? 'fork' : 'tactic-2', depth: 2 };
	// Gewinn verpasst: die beste eigene Fortsetzung hätte Material gewonnen
	const gainAt = linearLoss(posBefore, before.pv ?? [], me === 'white' ? 'black' : 'white', true);
	if (gainAt[2] >= 2) return { motif: 'missed-win', depth: gainAt[1] >= 2 ? 1 : 2 };
	if (lossAt[2] >= 1) return { motif: 'pawn-lost', depth: lossAt[1] >= 1 ? 1 : 2 };
	if (gainAt[2] >= 1) return { motif: 'missed-pawn', depth: gainAt[1] >= 1 ? 1 : 2 };
	return { motif: 'other', depth: null };
}

/** Material aus Sicht von `me` */
function material(pos, me) {
	let s = 0;
	for (const sq of pos.board.occupied) {
		const p = pos.board.get(sq);
		s += (p.color === me ? 1 : -1) * VALUE[p.role];
	}
	return s;
}

/**
 * Verlust an Material nach k Gegnerzügen (jeweils inkl. der eigenen Antwort danach),
 * entlang der Hauptvariante. Index 1 = nach 1 Gegnerzug, 2 = nach 2 Gegnerzügen.
 */
function linearLoss(posAfter, pv, me, ownLine = false) {
	// ownLine: Variante beginnt mit einem Zug der Gegenseite von `me` (also dem eigenen Zug des Ziehenden)
	void ownLine;
	const p = posAfter.clone();
	const m0 = material(p, me);
	const res = [0, 0, 0];
	let worst = 0;
	for (let i = 0; i < Math.min(4, pv.length); i++) {
		const mv = parseUci(pv[i]);
		if (!mv || !p.isLegal(mv)) break;
		p.play(mv);
		// nach dem eigenen Antwortzug (ungerade i) bzw. am Ende der Variante werten
		if (i % 2 === 1 || i === pv.length - 1) {
			worst = Math.max(worst, m0 - material(p, me));
			res[Math.ceil((i + 1) / 2)] = worst;
		}
	}
	res[2] = Math.max(res[2], res[1]);
	return res;
}

function clockSeconds(comment) {
	const m = comment?.match(/\[%clk (\d+):(\d+):(\d+)\]/);
	return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

async function analyseGame(engine, g) {
	const h = g.headers;
	const band = bandOf(Math.round((Number(h.get('WhiteElo')) + Number(h.get('BlackElo'))) / 2));
	const tc = h.get('TimeControl');
	const base = Number(tc.split('+')[0]);
	const pos = startingPosition(g.headers).unwrap();
	const plies = [];
	for (const node of g.moves.mainline()) {
		const mv = parseSan(pos, node.san);
		if (!mv) break;
		plies.push({
			fen: makeFen(pos.toSetup()),
			pos: pos.clone(),
			mv,
			uci: makeUci(mv),
			clock: clockSeconds(node.comments?.join(' '))
		});
		pos.play(mv);
	}
	const finalFen = makeFen(pos.toSetup());
	const evals = [];
	for (const p of plies) evals.push(await engine.eval(p.fen));
	const end = pos.isEnd();
	evals.push(
		end
			? pos.isCheckmate()
				? { mate: -0, cp: -10000, mated: true }
				: { cp: 0 }
			: await engine.eval(finalFen)
	);

	const result = h.get('Result');
	const term = h.get('Termination');
	const out = {
		band,
		speed: speedOf(tc),
		result,
		ending: term === 'Time forfeit' ? 'time' : pos.isCheckmate() ? 'mate' : end ? 'draw' : 'resign',
		plies: plies.length,
		moves: { white: 0, black: 0 },
		blunders: [],
		chances: { total: 0, taken: 0 }
	};
	for (let i = 0; i < plies.length; i++) {
		const p = plies[i];
		const me = p.pos.turn;
		out.moves[me]++;
		const before = evals[i];
		const afterRaw = evals[i + 1];
		const after = afterRaw.mated ? { mate: -1, cp: -10000 } : afterRaw; // Matt auf dem Brett
		// Gewinnchance aus Sicht des Ziehenden
		const wB = win(cpOf(before));
		const wA = afterRaw.mated ? 0 : 1 - win(cpOf(after));
		const loss = Math.max(0, wB - wA) * 2;
		const isBlunder =
			p.uci !== before.best && (loss >= 0.3 || (after.mate > 0 && !(before.mate < 0)));
		const prev = out.blunders.at(-1);
		if (isBlunder && !afterRaw.mated) {
			const c = classify(p.pos, p.mv, before, after);
			const timeLeft = p.clock;
			out.blunders.push({
				ply: i + 1,
				color: me,
				loss: Math.round(loss * 100) / 100,
				...c,
				fen: p.fen,
				uci: p.uci,
				best: before.best,
				pvAfter: (after.pv ?? []).slice(0, 4).join(' '),
				ev: [cpOf(before), cpOf(after)],
				lowTime: timeLeft !== null && (timeLeft < 30 || timeLeft < base * 0.1),
				// stand der Ziehende vorher nicht schon klar verloren? (≥ 20 % Gewinnchance)
				live: wB >= 0.2
			});
		}
		// Chance: Gegner hat gerade gepatzt – nutzt der Ziehende es sofort?
		if (prev && prev.ply === i && prev.color !== me) {
			out.chances.total++;
			if (loss < 0.1) out.chances.taken++;
		}
	}
	return out;
}

const pgn = readFileSync(file, 'utf8');
const games = parsePgn(pgn);
const engines = await Promise.all(
	Array.from({ length: ENGINES }, async () => {
		const e = new Engine();
		await e.init();
		return e;
	})
);
const results = [];
let next = 0;
const t0 = Date.now();
await Promise.all(
	engines.map(async (e) => {
		while (next < games.length) {
			const g = games[next++];
			try {
				results.push(await analyseGame(e, g));
			} catch (err) {
				process.stderr.write(`skip: ${err}\n`);
			}
			if (results.length % 50 === 0)
				process.stderr.write(
					`${results.length}/${games.length} (${Math.round((Date.now() - t0) / 1000)} s)\n`
				);
		}
	})
);
engines.forEach((e) => e.quit());
process.stdout.write(JSON.stringify({ nodes: NODES, games: results }));
