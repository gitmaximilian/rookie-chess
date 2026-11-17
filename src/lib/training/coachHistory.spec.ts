import { expect, test } from 'vitest';
import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { coachHistory, coachPeriod, trainingIndex } from './coachHistory';

const DAY = 86_400_000;
const now = new Date('2026-11-17T12:00:00Z').getTime();
const game = Game.fromPgn(
	'1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 d6 5. O-O Be7 6. Nc3 O-O 7. Be3 Be6 8. Bxe6 fxe6 9. Qd2 Qd7 10. Rad1 Rad8 11. h3 h6'
);
const row = (days: number, overrides: Partial<GameRow> = {}): GameRow => ({
	date: now - days * DAY,
	source: 'lichess',
	speed: 'rapid',
	rated: true,
	myColor: 'white',
	myRating: 1200,
	opponent: 'Fixture',
	result: '1-0',
	pgn: '[WhiteRatingDiff "8"]',
	moves: game.moves.map(({ uci }) => uci),
	startFen: game.startFen,
	analysis: {
		depth: 11,
		done: true,
		evals: Array.from({ length: game.ply + 1 }, () => ({ cp: 0 }))
	},
	...overrides
});

test('Index uses the published weights and waits for enough games and moves', () => {
	const sample = { blunders: 2, moves: 30, accuracy: 80 };
	expect(trainingIndex([sample, sample])).toBeNull();
	expect(trainingIndex(Array.from({ length: 3 }, () => ({ ...sample, moves: 9 })))).toBeNull();
	expect(trainingIndex([sample, sample, sample])).toMatchObject({ value: 80, blundersPer30: 2 });
	expect(
		trainingIndex(Array.from({ length: 3 }, () => ({ ...sample, blunders: 30 })))
	).toMatchObject({ value: 32 });
});

test('Both series use rated Rapid against humans; the index skips missing analyses', () => {
	const result = coachHistory([
		row(1, { analysis: undefined, myRating: 1220 }),
		row(25),
		row(10),
		row(5),
		row(4, { speed: 'blitz' }),
		row(3, { opponentIsBot: true }),
		row(2, { source: 'chesscom' }),
		row(0, { rated: false })
	]);
	expect(result.map((point) => point.rating)).toEqual([1208, 1208, 1208, 1228]);
	expect(result.map((point) => point.index?.value ?? null)).toEqual([null, null, 100, null]);
	const week = coachPeriod(result, 7, now);
	expect(week).toMatchObject({ latestRating: 1228, ratingDelta: 20, analysed: 1, wins: 2 });
	expect(week.latestIndex).toEqual(coachPeriod(result, 'all', now).latestIndex);
	expect(week.indexDelta).toBeNull();
});

test('Index uses at most ten analysed games and empty periods do not invent values', () => {
	const result = coachHistory(Array.from({ length: 13 }, (_, i) => row(50 + i)));
	expect(result.at(-1)?.index?.analysed).toBe(10);
	expect(coachPeriod(result, 30, now).latestRating).toBeUndefined();
});
