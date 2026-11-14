import { describe, expect, it } from 'vitest';
import type { GameRow } from '#lib/db/db.js';
import { computeStats, insights, outcomeOf, wdl, phaseOf, phasesByMaterial } from './gamestats';
import { INITIAL_FEN } from '#lib/chess/game.js';

const MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4']; // Narrenmatt
function row(p: Partial<GameRow>): GameRow {
	return {
		date: 1,
		pgn: '',
		moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
		startFen: INITIAL_FEN,
		result: '1-0',
		myColor: 'white',
		opponent: 'x',
		source: 'lichess',
		...p
	};
}

describe('Partie-Statistik', () => {
	it('Ergebnis aus meiner Sicht', () => {
		expect(outcomeOf(row({ result: '1-0', myColor: 'white' }))).toBe('w');
		expect(outcomeOf(row({ result: '1-0', myColor: 'black' }))).toBe('l');
		expect(outcomeOf(row({ result: '1/2-1/2' }))).toBe('d');
		expect(outcomeOf(row({ result: '*' }))).toBeNull();
		expect(wdl([row({}), row({ result: '1/2-1/2' }), row({ result: '0-1' })])).toMatchObject({
			w: 1,
			d: 1,
			l: 1,
			score: 50
		});
	});

	it('Farbe, Quelle, Tempo, Stärke, Wertungsverlauf, Partieenden', () => {
		const games = [
			row({ date: 1, myRating: 1000, oppRating: 1200, speed: 'blitz' }),
			row({ date: 2, myRating: 1010, oppRating: 1000, speed: 'blitz', result: '0-1' }),
			row({ date: 3, myColor: 'black', result: '0-1', moves: MATE, source: 'bot' }),
			row({ date: 4, result: '0-1', pgn: '[Termination "Time forfeit"]', speed: 'rapid' })
		];
		const s = computeStats(games, (m) => (m[0] === 'e2e4' ? "King's Pawn Game: Something" : null));
		expect(s.total.n).toBe(4);
		expect(s.byColor.black.w).toBe(1);
		expect(s.bySource[0]).toMatchObject({ key: 'lichess' });
		expect(s.vsStrength.find((x) => x.key === 'stronger')?.wdl.w).toBe(1);
		expect(s.ratingSeries[0].points.map((p) => p.rating)).toEqual([1000, 1010]);
		expect(s.endings.mate).toBe(1);
		expect(s.lossEndings.time).toBe(1);
		expect(s.openings[0]).toMatchObject({ name: "King's Pawn Game", color: 'white', n: 3 });
	});

	it('Phasen und Erkenntnisse', () => {
		expect(phaseOf(10)).toBe('opening');
		expect(phaseOf(40)).toBe('middlegame');
		expect(phaseOf(80)).toBe('endgame');
		// 14 Weiß-Siege, 14 Schwarz-Niederlagen: deutlicher Farbunterschied
		const many = Array.from({ length: 28 }, (_, i) =>
			row({ myColor: i < 14 ? 'white' : 'black', result: '1-0' })
		);
		const ins = insights(computeStats(many, () => 'Italian Game'));
		expect(ins.some((x) => x.key === 'betterWhite')).toBe(true);
	});

	it('zu wenige Partien: keine „Erkenntnisse“ aus Zufall', () => {
		const few = Array.from({ length: 12 }, (_, i) =>
			row({ myColor: i < 6 ? 'white' : 'black', result: '1-0' })
		);
		expect(insights(computeStats(few, () => 'Italian Game'))).toEqual([]);
	});

	it('Eröffnung nur ab 8 Partien und deutlich vom Schnitt entfernt; Farbe steht dabei', () => {
		// 10 × Französisch mit Schwarz verloren, 10 × anderes gewonnen/remis
		const games = [
			...Array.from({ length: 10 }, () => row({ myColor: 'black', result: '1-0' })),
			...Array.from({ length: 10 }, (_, i) =>
				row({ myColor: 'white', result: i % 2 ? '1-0' : '1/2-1/2', moves: ['d2d4'] })
			)
		];
		const ins = insights(
			computeStats(games, (m) => (m[0] === 'd2d4' ? "Queen's Pawn Game" : 'French Defense'))
		);
		const worst = ins.find((x) => x.key === 'worstOpening');
		expect(worst?.params).toMatchObject({ name: 'French Defense', color: 'black', n: 10 });
		expect(worst?.action).toBe('course');
		// nur 3 Partien → nie eine Eröffnungs-Erkenntnis
		const three = insights(
			computeStats([...games.slice(0, 3), ...games.slice(10), ...games.slice(10)], (m) =>
				m[0] === 'd2d4' ? "Queen's Pawn Game" : 'Van’t Kruijs'
			)
		);
		expect(three.some((x) => x.params?.name === 'Van’t Kruijs')).toBe(false);
	});

	it('Phasen nach Material: Grundreihen leer → Mittelspiel, wenig Figuren → Endspiel, nur vorwärts', () => {
		const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		// beide Seiten entwickelt und rochiert: weiße Grundreihe nur noch Türme und König
		const mid = 'r4rk1/ppp2ppp/2nbbn2/3pp3/3PP3/2NBBN2/PPP2PPP/R4RK1 w - - 0 10';
		const end = '8/5k2/3r4/8/8/3R4/3K4/8 w - - 0 40';
		expect(phasesByMaterial([start, start])).toEqual(['opening', 'opening']);
		expect(phasesByMaterial([start, mid, start])).toEqual(['opening', 'middlegame', 'middlegame']);
		expect(phasesByMaterial([start, end, mid])).toEqual(['opening', 'endgame', 'endgame']);
	});

	it('Chancen: Patzer des Gegners sofort bestraft', () => {
		// 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6?? 4. Qxf7# – Weiß nutzt die Chance
		const moves = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'];
		const evals = [
			{ cp: 20, best: 'e2e4' },
			{ cp: 30, best: 'e7e5' },
			{ cp: 25, best: 'g1f3' },
			{ cp: 0, best: 'b8c6' },
			{ cp: 0, best: 'f1c4' },
			{ cp: 0, best: 'g7g6' },
			{ mate: 1, best: 'h5f7' },
			{ cp: 10000 }
		];
		const s = computeStats([
			row({ moves, myColor: 'white', result: '1-0', analysis: { evals, depth: 10, done: true } })
		]);
		expect(s.chances).toEqual({ taken: 1, total: 1 });
	});
});
