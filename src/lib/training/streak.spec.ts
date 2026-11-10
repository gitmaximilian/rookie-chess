import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';

const row = (day: string, puzzles = 1) => ({ day, puzzles, games: 0, reviews: 0 });

describe('Trainingsserie', () => {
	it('zählt aufeinanderfolgende Tage bis heute', () => {
		const r = computeStreak(
			[row('2026-11-08'), row('2026-11-09'), row('2026-11-10')],
			'2026-11-10'
		);
		expect(r).toEqual({ days: 3, todayDone: true });
	});

	it('Serie bleibt bestehen, wenn heute noch nichts passiert ist', () => {
		const r = computeStreak([row('2026-11-08'), row('2026-11-09')], '2026-11-10');
		expect(r).toEqual({ days: 2, todayDone: false });
	});

	it('Lücke beendet die Serie', () => {
		const r = computeStreak(
			[row('2026-11-07'), row('2026-11-09'), row('2026-11-10')],
			'2026-11-10'
		);
		expect(r.days).toBe(2);
	});

	it('über Monatsgrenzen hinweg', () => {
		const r = computeStreak([row('2026-10-31'), row('2026-11-01')], '2026-11-01');
		expect(r.days).toBe(2);
	});

	it('leere Tage zählen nicht', () => {
		expect(computeStreak([row('2026-11-10', 0)], '2026-11-10').days).toBe(0);
	});
});
