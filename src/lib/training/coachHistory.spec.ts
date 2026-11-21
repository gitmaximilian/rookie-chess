import { expect, test } from 'vitest';
import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import {
	coachHistory,
	coachPeriod,
	LEVEL_MIN,
	LEVEL_NOISE,
	LEVEL_WINDOW,
	playingLevel,
	RATING_NOISE,
	ratingChange,
	type CoachHistoryPoint
} from './coachHistory';
import type { GameSkillStats } from './skills';

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

const stats = (blunders: number, opening: number, strategy: number): GameSkillStats => ({
	live: 30,
	blunders,
	chances: 4,
	taken: 2,
	opening: [opening * 10, 10],
	strategy: [strategy * 8, 8],
	endgame: [0, 0],
	blunderLoss: { opening: 0, endgame: 0 },
	cnt: { safety: 26, tactics: 4, opening: 10, strategy: 8, endgame: 0 }
});

test('Spielniveau: Elo-Entsprechung des Pentas, erst ab zehn Partien', () => {
	const g = (b: number) => ({ stats: stats(b, 0.02, 0.02), accuracy: 80 });
	expect(playingLevel(Array.from({ length: LEVEL_MIN - 1 }, () => g(1)))).toBeNull();
	const safe = playingLevel(Array.from({ length: 12 }, () => g(1)))!;
	const loose = playingLevel(Array.from({ length: 12 }, () => g(5)))!;
	expect(safe.analysed).toBe(12);
	expect(safe.blundersPer30).toBe(1);
	// weniger Patzer → höheres Spielniveau, auf derselben Elo-Skala wie die Wertung
	expect(safe.value).toBeGreaterThan(loose.value);
	expect(loose.value).toBeGreaterThanOrEqual(300);
	expect(safe.value).toBeLessThanOrEqual(2800);
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
	// nur drei analysierte Rapid-Partien: noch kein Spielniveau
	expect(result.map((point) => point.index?.value ?? null)).toEqual([null, null, null, null]);
	const week = coachPeriod(result, 7, now);
	expect(week).toMatchObject({ latestRating: 1228, ratingDelta: 20, analysed: 1, wins: 2 });
	expect(week.latestIndex).toEqual(coachPeriod(result, 'all', now).latestIndex);
	expect(week.indexDelta).toBeNull();
});

test('Kurze Partien reichen nicht für die Mindestmengen; leere Zeiträume erfinden nichts', () => {
	// 11 Züge je Partie: auch 18 Partien erreichen die Penta-Mindestmengen nicht → kein Spielniveau
	const result = coachHistory(Array.from({ length: 18 }, (_, i) => row(50 + i)));
	expect(result.every((p) => p.analysed)).toBe(true);
	expect(result.at(-1)?.index).toBeNull();
	expect(LEVEL_WINDOW).toBe(15);
	expect(coachPeriod(result, 30, now).latestRating).toBeUndefined();
});

test('Einstufung neuer Konten zählt nicht für Verlauf und Veränderung', () => {
	// Lichess beginnt bei 1500 und springt anfangs stark; danach steigt die Wertung stetig
	const ratings = [1500, 1380, 1261, 1090, 960, 830, 790, 800, 815, 830, 850, 870];
	const games = ratings.map((r, i) =>
		row(ratings.length - i, { myRating: r, pgn: '[WhiteRatingDiff "0"]' })
	);
	const history = coachHistory(games);
	expect(history.filter((p) => p.provisional)).toHaveLength(5);
	const s = coachPeriod(history, 30, now);
	expect(s.ratingDelta).toBe(870 - 830);
	expect(s.latestRating).toBe(870);
});

test('ohne Einstufung (älteres Konto) zählt jeder Punkt', () => {
	const games = [1200, 1210, 1195, 1220].map((r, i) =>
		row(4 - i, { myRating: r, pgn: '[WhiteRatingDiff "0"]' })
	);
	expect(coachHistory(games).some((p) => p.provisional)).toBe(false);
});

test('Wirkt es? Wertung über die letzten 15 Partien, Urteil nach der Schwankung, Partien pro Woche', () => {
	const pt = (days: number, rating: number, provisional = false): CoachHistoryPoint => ({
		date: now - days * DAY,
		rating,
		index: null,
		outcome: 'w',
		analysed: false,
		conversion: null,
		provisional
	});
	// Einstufung zählt nicht: 5 vorläufige + 15 eingestufte Partien reichen noch nicht
	const first = [...Array.from({ length: 5 }, (_, i) => pt(40 - i, 1500 - i * 100, true))];
	expect(
		ratingChange([...first, ...Array.from({ length: 15 }, (_, i) => pt(30 - i, 1000))])
	).toBeNull();
	const make = (after: number) => [
		...first,
		pt(30, 1000),
		...Array.from({ length: 15 }, (_, i) => pt(14 - i, after))
	];
	const up = ratingChange(make(1000 + RATING_NOISE + 1), now)!;
	expect(up).toMatchObject({ before: 1000, verdict: 'up', delta: RATING_NOISE + 1 });
	// 15 Partien in 14 Tagen → 7,5 pro Woche
	expect(up.perWeek).toBeCloseTo(7.5, 1);
	expect(ratingChange(make(1000 + RATING_NOISE), now)!.verdict).toBe('flat');
	expect(ratingChange(make(1000 - RATING_NOISE - 1), now)!.verdict).toBe('down');
	expect(LEVEL_NOISE).toBeGreaterThan(RATING_NOISE * 10);
});
