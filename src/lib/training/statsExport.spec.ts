import { describe, expect, it } from 'vitest';
import type { GameRow } from '#lib/db/db.js';
import { gamesCsv } from './statsExport';

const g = (p: Partial<GameRow>): GameRow => ({
	date: Date.UTC(2026, 10, 1, 12, 0),
	pgn: '',
	moves: ['e2e4', 'e7e5'],
	startFen: '',
	result: '1-0',
	myColor: 'white',
	opponent: 'x',
	source: 'bot',
	...p
});

describe('Statistik-Export', () => {
	it('CSV mit Kopfzeile, Wertung nach der Partie und maskierten Feldern', () => {
		const csv = gamesCsv(
			[
				g({
					source: 'lichess',
					speed: 'blitz',
					myRating: 1500,
					oppRating: 1550,
					opponent: '=cmd, "evil"',
					pgn: '[WhiteRatingDiff "+8"]\n\n1. e4 e5 *'
				})
			],
			() => 'Open Game'
		);
		const [head, row] = csv.split('\n');
		expect(head.split(',')).toContain('my_rating_after');
		expect(row).toContain(',1500,1508,8,1-0,1,1,Open Game');
		expect(row).toContain(`"'=cmd, ""evil"""`);
	});
});
