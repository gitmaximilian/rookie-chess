import { describe, expect, it } from 'vitest';
import { themeStats, weakest, strongest } from './stats';
import type { PuzzleAttemptRow } from '#lib/db/db.js';

const a = (
	themes: string[],
	solved: boolean,
	source: 'lichess' | 'mistake' = 'lichess'
): PuzzleAttemptRow => ({
	puzzleId: Math.random().toString(),
	date: 0,
	solved,
	ratingAfter: 800,
	themes,
	source
});

describe('Themen-Statistik', () => {
	const attempts = [
		a(['fork', 'short'], false),
		a(['fork'], false),
		a(['fork'], true),
		a(['pin'], true),
		a(['pin'], true),
		a(['pin'], true),
		a(['mateIn1'], true),
		a(['mateIn1'], false, 'mistake')
	];

	it('berechnet Quoten, ignoriert Meta-Themen und Fehler-Puzzles', () => {
		const s = themeStats(attempts);
		expect(s.find((x) => x.theme === 'short')).toBeUndefined();
		expect(s.find((x) => x.theme === 'fork')).toMatchObject({ n: 3, solved: 1 });
		expect(s.find((x) => x.theme === 'mateIn1')).toBeUndefined(); // nur 1 Versuch
	});

	it('schwächste und stärkste Themen', () => {
		const s = themeStats(attempts);
		expect(weakest(s, 1)[0].theme).toBe('fork');
		expect(strongest(s, 1)[0].theme).toBe('pin');
	});
});
