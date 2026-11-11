import { describe, expect, it } from 'vitest';
import type { GameRow } from '#lib/db/db.js';
import { ratingsFrom } from './ratings';

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
