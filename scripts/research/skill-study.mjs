/**
 * Eichung des Skill-Pentas (lib/training/skills.ts): misst die fünf Fähigkeiten je Spieler und Partie
 * an echten Lichess-Partien (Rapid/Classical, 400–3200), mit Stockfish Tiefe 11 wie Rookie am Handy.
 *
 *   node scripts/research/skill-study.mjs <skills.pgn> [engines=10] > skills.json
 *
 * Je Spieler und Partie (Rohsummen, damit sich Partien später zusammenfassen lassen):
 * - safety:   Züge in offener Stellung (vorher ≥ 20 % Gewinnchance) und Patzer darunter (≥ 30 Prozentpunkte)
 * - tactics:  Fehler des Gegners (≥ 20 Prozentpunkte) und wie viele davon sofort bestraft (Antwort < 10)
 * - opening / strategy / endgame: Summe und Anzahl der Verluste je Phase (Phase nach Material wie
 *   lib/training/gamestats.ts); Strategie = Mittelspielzüge ohne Patzer
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { makeUci } from 'chessops/util';

const [, , file, enginesArg] = process.argv;
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

/** Phase der Stellung (wie phasesByMaterial in lib/training/gamestats.ts) */
function phaseTracker() {
	let phase = 'opening';
	return (pos, i) => {
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
		return phase;
	};
}

const empty = (rating) => ({
	rating,
	moves: 0,
	live: 0,
	blunders: 0,
	chances: 0,
	taken: 0,
	opening: [0, 0],
	strategy: [0, 0],
	endgame: [0, 0],
	// verlorene Gewinnchance (0..1-Skala) je Kategorie, überschneidungsfrei – für die Elo-Wirkung
	lost: { safety: 0, tactics: 0, opening: 0, strategy: 0, endgame: 0 },
	// Züge je Kategorie (Nenner für den Verlust pro Zug): Taktik = Chancen, Sicherheit = Züge in
	// offener Stellung ohne Chance, Phasen = Züge ohne Chance und ohne Patzer
	cnt: { safety: 0, tactics: 0, opening: 0, strategy: 0, endgame: 0 }
});

async function analyse(engine, g) {
	const h = g.headers;
	const pos = startingPosition(h).unwrap();
	const plies = [];
	const phaseOf = phaseTracker();
	let i = 0;
	for (const node of g.moves.mainline()) {
		const mv = parseSan(pos, node.san);
		if (!mv) break;
		plies.push({ fen: makeFen(pos.toSetup()), uci: makeUci(mv), phase: phaseOf(pos, i) });
		pos.play(mv);
		i++;
	}
	const evals = [];
	for (const p of plies) evals.push(await engine.eval(p.fen));
	evals.push(
		pos.isCheckmate()
			? { cp: -10000 }
			: pos.isEnd()
				? { cp: 0 }
				: await engine.eval(makeFen(pos.toSetup()))
	);
	const side = {
		white: empty(Number(h.get('WhiteElo'))),
		black: empty(Number(h.get('BlackElo')))
	};
	const losses = plies.map((p, k) => {
		const wBefore = win(evals[k].cp);
		const wAfter = 1 - win(evals[k + 1].cp);
		return { loss: p.uci === evals[k].best ? 0 : Math.max(0, wBefore - wAfter) * 2, wBefore };
	});
	plies.forEach((p, k) => {
		const me = k % 2 === 0 ? 'white' : 'black';
		const s = side[me];
		const { loss, wBefore } = losses[k];
		s.moves++;
		if (wBefore >= 0.2) {
			s.live++;
			if (loss >= 0.3) s.blunders++;
		}
		// Genauigkeit nur in offenen Stellungen (15–85 % Gewinnchance): in entschiedenen Stellungen
		// kosten auch schlechte Züge kaum Gewinnchance – dort misst Genauigkeit nichts
		const open = wBefore >= 0.15 && wBefore <= 0.85;
		if (open && p.phase === 'opening') {
			s.opening[0] += loss;
			s.opening[1]++;
		} else if (open && p.phase === 'middlegame') {
			if (loss < 0.3) {
				s.strategy[0] += loss;
				s.strategy[1]++;
			}
		} else if (open && p.phase === 'endgame') {
			s.endgame[0] += loss;
			s.endgame[1]++;
		}
		// Chance: der Gegner hat gerade einen Fehler (≥ 20) gemacht – nutze ich ihn sofort?
		const chance = k > 0 && losses[k - 1].loss >= 0.2;
		if (chance) {
			s.chances++;
			if (loss < 0.1) s.taken++;
		}
		// Aufteilung des Verlusts: Antwort auf Gegnerfehler → Taktik; sonst Patzer in offener
		// Stellung → Sicherheit; sonst nach Phase
		const lost = loss / 2;
		const ph =
			p.phase === 'opening' ? 'opening' : p.phase === 'middlegame' ? 'strategy' : 'endgame';
		if (chance) {
			s.lost.tactics += lost;
			s.cnt.tactics++;
		} else {
			if (wBefore >= 0.2) s.cnt.safety++;
			if (wBefore >= 0.2 && loss >= 0.3) s.lost.safety += lost;
			else if (open) {
				// Phasen wie ihre Ecke: nur offene Stellungen
				s.lost[ph] += lost;
				s.cnt[ph]++;
			}
		}
	});
	return [side.white, side.black];
}

const games = parsePgn(readFileSync(file, 'utf8'));
const engines = await Promise.all(
	Array.from({ length: ENGINES }, async () => {
		const e = new Engine();
		await e.init();
		return e;
	})
);
const out = [];
let next = 0;
let done = 0;
const t0 = Date.now();
await Promise.all(
	engines.map(async (e) => {
		while (next < games.length) {
			const g = games[next++];
			try {
				out.push(...(await analyse(e, g)).filter((p) => p.moves >= 10));
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
process.stdout.write(JSON.stringify({ depth: 11, players: out }));
