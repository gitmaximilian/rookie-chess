import { describe, expect, it } from 'vitest';
import { update, updateForPuzzle, BEGINNER_RATING } from './glicko2';

describe('Glicko-2', () => {
	it('stimmt mit dem Beispiel aus Glickmans Paper überein', () => {
		const r = update({ rating: 1500, rd: 200, vol: 0.06 }, [
			{ rating: 1400, rd: 30, score: 1 },
			{ rating: 1550, rd: 100, score: 0 },
			{ rating: 1700, rd: 300, score: 0 }
		]);
		expect(r.rating).toBeCloseTo(1464.06, 1);
		expect(r.rd).toBeCloseTo(151.52, 1);
		expect(r.vol).toBeCloseTo(0.05999, 4);
	});

	it('steigt nach gelöstem und fällt nach verfehltem Puzzle', () => {
		const up = updateForPuzzle(BEGINNER_RATING, 900, true);
		const down = updateForPuzzle(BEGINNER_RATING, 700, false);
		expect(up.rating).toBeGreaterThan(BEGINNER_RATING.rating);
		expect(down.rating).toBeLessThan(BEGINNER_RATING.rating);
		expect(up.rd).toBeLessThan(BEGINNER_RATING.rd);
	});

	it('Unsicherheit wächst ohne Spiele, bleibt aber begrenzt', () => {
		const r = update({ rating: 1200, rd: 340, vol: 0.06 }, []);
		expect(r.rd).toBeLessThanOrEqual(350);
	});
});
