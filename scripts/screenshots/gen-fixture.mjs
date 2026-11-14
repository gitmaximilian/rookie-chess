/**
 * Erzeugt plausible Testdaten für Screenshots (docs/screenshots):
 * 32 Anfänger-Partien (Stockfish mit gewichteter Zugwahl), fertig analysiert,
 * dazu Puzzle-Versuche, Wertungsverlauf, Aktivität, Sterne-Fortschritt.
 *
 *   node scripts/screenshots/gen-fixture.mjs   → scripts/screenshots/fixture.json
 *
 * Keine echten Personen: Gegnernamen sind erfunden.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import { makeUci, parseUci, squareRank } from 'chessops/util';
import { makeSan } from 'chessops/san';

const OUT = new URL('./fixture.json', import.meta.url);
const DAY = 86400000;
const NOW = Date.now();

// deterministischer Zufall, damit die Bilder reproduzierbar sind
let seed = 20261113;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

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
		await this.send('setoption name MultiPV value 4\nisready', 'readyok');
	}
	async analyse(fen, depth) {
		const out = await this.send(`position fen ${fen}\ngo depth ${depth}`, 'bestmove');
		const lines = new Map();
		for (const l of out.split('\n')) {
			const m = l.match(/ depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
			if (!m || Number(m[1]) !== depth) continue;
			lines.set(Number(m[2]), { [m[3]]: Number(m[4]), pv: m[5].trim().split(' ') });
		}
		return [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
	}
	quit() {
		this.p.stdin.write('quit\n');
	}
}

const toWhite = (s, turn) => {
	const k = turn === 'white' ? 1 : -1;
	return s.mate !== undefined ? { mate: s.mate * k } : { cp: s.cp * k };
};

const NAMES = [
	'knightowl42',
	'pawnstorm_7',
	'Pia',
	'quietbishop',
	'Leo',
	'castle_early',
	'forkyou_not',
	'Tina',
	'endgame_eli',
	'rooklift99'
];

async function playGame(eng, i) {
	const pos = Chess.fromSetup(parseFen(INITIAL_FEN).unwrap()).unwrap();
	const myColor = i % 2 === 0 ? 'white' : 'black';
	// späte Partien etwas sauberer: Fortschritt sichtbar
	const skill = 0.55 + (i / 32) * 0.25;
	const moves = [];
	const sans = [];
	const evals = [];
	for (let ply = 0; ply < 90; ply++) {
		const fen = makeFen(pos.toSetup());
		const turn = pos.turn;
		if (pos.isEnd()) {
			evals.push(pos.isCheckmate() ? { cp: turn === 'white' ? -10000 : 10000 } : { cp: 0 });
			break;
		}
		const lines = await eng.analyse(fen, 8);
		const top = lines[0];
		const e = { ...toWhite(top, turn), best: top.pv[0], pv: top.pv.slice(0, 8) };
		if (lines[1]) e.second = toWhite(lines[1], turn);
		evals.push(e);
		// Anfänger-Zugwahl: meist gut, manchmal ungenau, selten ein Patzer
		const r = rnd();
		const s = turn === myColor ? skill : 0.6;
		let pick = r < s ? 0 : r < s + 0.22 ? 1 : r < 0.96 ? 2 : 3;
		pick = Math.min(pick, lines.length - 1);
		let uci = lines[pick].pv[0];
		// Echte Patzer wie bei ~900 (Lichess-Studie: ~3–4 Blunder je 30 Züge): manchmal ein beliebiger
		// legaler Zug statt einer Engine-Wahl; späte Partien etwas seltener (Fortschritt)
		const pBlunder = turn === myColor ? 0.22 - (i / 32) * 0.06 : 0.2;
		if (ply > 4 && rnd() < pBlunder) {
			const legal = [];
			for (const [from, dests] of pos.allDests())
				for (const to of dests) {
					const pawn = pos.board.get(from)?.role === 'pawn';
					const last = squareRank(to) === 0 || squareRank(to) === 7;
					legal.push(makeUci({ from, to, promotion: pawn && last ? 'queen' : undefined }));
				}
			uci = legal[Math.floor(rnd() * legal.length)];
		}
		const move = parseUci(uci);
		sans.push(makeSan(pos, move));
		pos.play(move);
		moves.push(uci);
	}
	if (!pos.isEnd() && evals.length === moves.length) {
		const lines = await eng.analyse(makeFen(pos.toSetup()), 8);
		evals.push({ ...toWhite(lines[0], pos.turn), best: lines[0].pv[0] });
	}
	// Ergebnis: Matt/Patt oder nach Bewertung (Aufgabe)
	const last = evals[evals.length - 1];
	let result;
	if (pos.isCheckmate()) result = pos.turn === 'white' ? '0-1' : '1-0';
	else if (pos.isEnd()) result = '1/2-1/2';
	else {
		const v = last.mate !== undefined ? Math.sign(last.mate) * 9999 : last.cp;
		result = v > 250 ? '1-0' : v < -250 ? '0-1' : '1/2-1/2';
	}
	const opponent = NAMES[i % NAMES.length];
	const isBot = ['Pia', 'Leo', 'Tina'].includes(opponent);
	const date = NOW - (31 - i) * DAY * 0.9 - 3600000 * (i % 5);
	let pgn = `[Event "Rookie"]\n[White "${myColor === 'white' ? 'You' : opponent}"]\n[Black "${myColor === 'black' ? 'You' : opponent}"]\n[Result "${result}"]\n\n`;
	pgn += sans.map((s, k) => (k % 2 === 0 ? `${k / 2 + 1}. ${s}` : s)).join(' ') + ` ${result}`;
	const myRating = 930 + Math.round(i * 4.2 + (rnd() - 0.5) * 30);
	return {
		date: Math.round(date),
		pgn,
		moves,
		startFen: INITIAL_FEN,
		result,
		myColor,
		opponent,
		source: isBot ? 'bot' : 'lichess',
		externalId: isBot ? undefined : `demo-${i}`,
		analysis: { evals, depth: 8, done: true },
		...(isBot
			? {}
			: {
					myRating,
					oppRating: myRating + Math.round((rnd() - 0.5) * 120),
					speed: i % 3 ? 'rapid' : 'blitz',
					rated: true
				})
	};
}

const eng = new Engine();
await eng.init();
const games = [];
for (let i = 0; i < 32; i++) {
	games.push(await playGame(eng, i));
	process.stdout.write(`\rPartie ${i + 1}/32`);
}
eng.quit();
console.log();

const THEMES = ['fork', 'pin', 'hangingPiece', 'mateIn1', 'mateIn2', 'skewer', 'discoveredAttack'];
const attempts = [];
const ratings = [];
let rating = 820;
for (let k = 0; k < 140; k++) {
	const date = NOW - (140 - k) * DAY * 0.2;
	const th = THEMES[k % THEMES.length];
	const solved = rnd() < (th === 'pin' ? 0.45 : 0.72);
	rating += solved ? 4 + rnd() * 6 : -(3 + rnd() * 5);
	attempts.push({
		puzzleId: `demo${k}`,
		date: Math.round(date),
		solved,
		ratingAfter: Math.round(rating),
		themes: [th],
		source: 'lichess'
	});
	ratings.push({ area: 'puzzle', date: Math.round(date), rating: Math.round(rating) });
}

const dayKey = (t) => {
	const d = new Date(t);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const activity = [];
for (let k = 0; k < 28; k++) {
	if (k > 9 && rnd() < 0.3) continue;
	activity.push({
		day: dayKey(NOW - k * DAY),
		puzzles: k === 0 ? 3 : 4 + Math.floor(rnd() * 8),
		games: k % 3 === 0 ? 1 : 0,
		reviews: Math.floor(rnd() * 4)
	});
}

writeFileSync(
	OUT,
	JSON.stringify({
		createdAt: NOW,
		games,
		puzzleAttempts: attempts,
		ratings,
		activity,
		settings: {
			puzzleRating: { rating: Math.round(rating), rd: 72, vol: 0.06 },
			dailyGoal: 5,
			basicsDone: ['board', 'rook', 'bishop', 'queen', 'king', 'knight'],
			tacticsDone: [],
			botsBeaten: ['bruno', 'pia'],
			lastBackupAt: NOW,
			learnerProfile: { rules: 'yes', level: 'casual', focus: 'tactics', date: NOW - 30 * DAY }
		},
		endgames: [
			{ id: 'kqk', stars: 3, date: NOW - 5 * DAY },
			{ id: 'krk', stars: 2, date: NOW - 3 * DAY }
		]
	})
);
console.log('geschrieben:', OUT.pathname, `(${games.length} Partien)`);
