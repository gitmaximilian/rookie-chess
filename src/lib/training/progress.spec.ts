import { describe, expect, it } from 'vitest';
import { blunderTrend, successRate, type GameBlunders } from './progress';

const series = (xs: number[]): GameBlunders[] =>
	xs.map((per30, i) => ({ date: i, per30, ownMoves: 30 }));

describe('Fortschritt: Patzer je 30 Züge', () => {
	it('zu wenige Partien: kein Vergleich, sagt wie viele fehlen', () => {
		const t = blunderTrend(series([3, 2, 4]));
		expect(t.verdict).toBe('unknown');
		expect(t.recent).toBe(3);
		expect(t.missing).toBe(17);
	});

	it('deutlich weniger Patzer → besser', () => {
		const before = Array(10)
			.fill(0)
			.map((_, i) => 4 + (i % 2));
		const after = Array(10)
			.fill(0)
			.map((_, i) => 1 + (i % 2));
		const t = blunderTrend(series([...before, ...after]));
		expect(t.verdict).toBe('better');
		expect(t.diff).toBe(-3);
		expect(t.previous).toBe(4.5);
		expect(t.recent).toBe(1.5);
	});

	it('kleiner Unterschied bei großer Streuung → noch Zufall', () => {
		const before = [0, 6, 1, 5, 2, 4, 0, 7, 3, 2];
		const after = [1, 5, 0, 6, 2, 3, 1, 6, 2, 3];
		expect(blunderTrend(series([...before, ...after])).verdict).toBe('same');
	});

	it('mehr Patzer → schlechter', () => {
		const t = blunderTrend(series([...Array(10).fill(1), ...Array(10).fill(3)]));
		expect(t.verdict).toBe('worse');
	});

	it('Trefferquote erst ab Mindestmenge', () => {
		expect(successRate([true, false])).toBeNull();
		expect(successRate([...Array(8).fill(true), false, false])).toBe(80);
	});
});
