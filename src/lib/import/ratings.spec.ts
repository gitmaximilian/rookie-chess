import { describe, expect, it } from 'vitest';
import type { GameRow } from '#lib/db/db.js';
import { ratingsFrom, ratingAfter, isRated, ratingSeriesFrom, summarise, byMonth } from './ratings';

const g = (p: Partial<GameRow>): GameRow => ({
	date: 0,
	pgn: '',
	moves: [],
	startFen: '',
	result: '1-0',
	myColor: 'white',
	opponent: 'x',
	source: 'lichess',
	...p
});

describe('Online-Wertungen', () => {
	it('neueste Wertung je Plattform und Tempo, mit Veränderung über 30 Tage', () => {
		const day = 86_400_000;
		const now = 100 * day;
		const r = ratingsFrom(
			[
				g({ date: 50 * day, myRating: 1400, speed: 'blitz' }),
				g({ date: 99 * day, myRating: 1460, speed: 'blitz' }),
				g({ date: 98 * day, myRating: 1300, speed: 'rapid' }),
				g({ date: 97 * day, myRating: 900, speed: 'rapid', source: 'chesscom' }),
				g({ date: 97 * day, source: 'bot' })
			],
			now
		);
		expect(r).toEqual([
			{ source: 'chesscom', speed: 'rapid', rating: 900, delta: null, games: 1 },
			{ source: 'lichess', speed: 'blitz', rating: 1460, delta: 60, games: 2 },
			{ source: 'lichess', speed: 'rapid', rating: 1300, delta: null, games: 1 }
		]);
	});
});

describe('Wertung korrekt aus den Daten', () => {
	it('Lichess: Zahl nach der Partie = vorher + RatingDiff', () => {
		const pgn =
			'[Event "Rated Blitz game"]\n[WhiteRatingDiff "+7"]\n[BlackRatingDiff "-6"]\n\n1. e4 *';
		expect(ratingAfter(g({ pgn, myRating: 1500 }))).toBe(1507);
		expect(ratingAfter(g({ pgn, myRating: 1500, myColor: 'black' }))).toBe(1494);
		// Chess.com liefert schon die Zahl danach
		expect(ratingAfter(g({ source: 'chesscom', myRating: 900 }))).toBe(900);
	});

	it('ungewertete Partien zählen nicht', () => {
		const casual = '[Event "Casual Blitz game"]\n\n1. e4 *';
		expect(isRated(g({ pgn: casual, myRating: 1500, speed: 'blitz' }))).toBe(false);
		expect(isRated(g({ myRating: 1500, speed: 'blitz', rated: false }))).toBe(false);
		expect(isRated(g({ source: 'chesscom', myRating: 900, speed: 'rapid' }))).toBe(true);
		expect(isRated(g({ source: 'bot', myRating: 900, speed: 'rapid' }))).toBe(false);
		const s = ratingSeriesFrom([
			g({ date: 1, myRating: 1500, speed: 'blitz', rated: true }),
			g({ date: 2, myRating: 1200, speed: 'blitz', rated: false }),
			g({ date: 3, myRating: 1510, speed: 'blitz', rated: true })
		]);
		expect(s[0].points.map((p) => p.rating)).toEqual([1500, 1510]);
	});

	it('Kennzahlen: Höchstwert, Bilanz, Leistung, Monate', () => {
		const pts = [
			{
				date: Date.UTC(2026, 0, 5),
				rating: 1500,
				result: 'w' as const,
				opponent: 'a',
				oppRating: 1500
			},
			{
				date: Date.UTC(2026, 0, 9),
				rating: 1520,
				result: 'w' as const,
				opponent: 'b',
				oppRating: 1600
			},
			{
				date: Date.UTC(2026, 1, 2),
				rating: 1490,
				result: 'l' as const,
				opponent: 'c',
				oppRating: 1400
			}
		];
		const s = summarise(pts)!;
		expect(s.peak.rating).toBe(1520);
		expect(s.low.rating).toBe(1490);
		expect([s.w, s.d, s.l]).toEqual([2, 0, 1]);
		expect(s.winStreak).toBe(2);
		expect(s.bestWin?.opponent).toBe('b');
		expect(s.performance).toBe(1500 + Math.round(400 / 3));
		const m = byMonth(pts);
		expect(m.map((r) => [r.month, r.change, r.games])).toEqual([
			['2026-02', -30, 1],
			['2026-01', 20, 2]
		]);
	});
});
