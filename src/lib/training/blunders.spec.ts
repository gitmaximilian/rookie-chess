import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { blundersPer30, conversion, gameSafety } from './blunders';
import { collectSkills } from './skills';
import { blunderSeries } from './progress';
import { computeStats } from './gamestats';

/** Narrenmatt: Weiß patzt mit g4 (Matt in 1 zugelassen) */
const fools = (date: number): GameRow => ({
	date,
	pgn: '',
	moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
	startFen: INITIAL_FEN,
	result: '0-1',
	myColor: 'white',
	opponent: 'x',
	source: 'pgn',
	analysis: {
		done: true,
		depth: 11,
		evals: [
			{ cp: 20, best: 'e2e4' },
			{ cp: -40, best: 'e7e5' },
			{ cp: -50, best: 'b1c3' },
			{ mate: -1, best: 'd8h4' },
			{ cp: -10000 }
		]
	}
});

/** Weiß steht ab Halbzug 10 klar auf Gewinn (+6) – Ergebnis wählbar */
const winning = (result: GameRow['result'], date = 1): GameRow => {
	const moves = [
		'e2e4',
		'e7e5',
		'g1f3',
		'b8c6',
		'f1c4',
		'g8f6',
		'd2d3',
		'f8c5',
		'e1g1',
		'e8g8',
		'c2c3',
		'd7d6'
	];
	return {
		...fools(date),
		moves,
		result,
		analysis: {
			done: true,
			depth: 11,
			evals: moves
				.map((m, i) => ({ cp: i < 10 ? 20 : 600, best: m }))
				.concat([{ cp: 600, best: 'a2a3' }])
		}
	};
};

describe('Eine Patzer-Zahl', () => {
	it('zählt wie die Penta-Ecke Sicherheit: nur offene Stellungen', () => {
		const g = fools(1);
		expect(gameSafety(g)).toEqual({ live: 2, blunders: 1, wonAt: null });
		// gleiche Zahl wie collectSkills
		const games = Array.from({ length: 20 }, (_, i) => fools(i));
		expect(blundersPer30(games)).toBe(collectSkills(games).safety.value);
		expect(blundersPer30(games)).toBe(15);
	});

	it('Fortschrittskarte, Profil und Penta liefern für dieselben Partien dieselbe Rate', () => {
		const games = Array.from({ length: 12 }, (_, i) => ({
			...winning('1-0', i),
			// ein Patzer in offener Stellung je Partie: Halbzug 2 kostet viel
			analysis: {
				done: true,
				depth: 11,
				evals: [
					{ cp: 20, best: 'd2d4' },
					{ cp: 20, best: 'e7e5' },
					{ cp: -500, best: 'b1c3' },
					...Array.from({ length: 10 }, () => ({ cp: -500, best: 'a2a3' }))
				]
			}
		}));
		const pooled = blundersPer30(games)!;
		expect(computeStats(games).blundersPer30).toBe(pooled);
		expect(collectSkills(games).safety.value).toBeCloseTo(pooled, 1);
		// Fortschritt je Partie: hier zu wenige Züge in offener Stellung (< 10) → keine Partie in der Reihe
		expect(blunderSeries(games)).toEqual([]);
	});

	it('Verwerten: Punkte aus klaren Gewinnstellungen, erst ab drei solchen Partien', () => {
		expect(gameSafety(winning('1-0'))!.wonAt).toBe(10);
		expect(conversion([winning('1-0'), winning('0-1')])).toBeNull();
		const c = conversion([winning('1-0', 1), winning('0-1', 2), winning('1/2-1/2', 3), fools(4)])!;
		expect(c).toEqual({ won: 1.5, of: 3, pct: 50 });
	});
});
