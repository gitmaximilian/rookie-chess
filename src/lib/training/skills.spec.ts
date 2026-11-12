import { describe, expect, it } from 'vitest';
import { accuracyScore, safetyScore, skillProfile, tacticsScore, weakestSkill } from './skills';

describe('Skill-Profil', () => {
	it('Skalen', () => {
		expect(accuracyScore(50)).toBe(0);
		expect(accuracyScore(75)).toBe(50);
		expect(accuracyScore(100)).toBe(100);
		expect(accuracyScore(30)).toBe(0);
		expect(safetyScore(0)).toBe(100);
		expect(safetyScore(1.5)).toBe(50);
		expect(safetyScore(5)).toBe(0);
		expect(tacticsScore(1200)).toBe(50);
	});

	it('ohne Daten: alles null, kein schwächster Bereich', () => {
		const v = skillProfile(
			{
				phaseAccuracy: { opening: null, middlegame: null, endgame: null },
				perGame: { blunders: 0, mistakes: 0, inaccuracies: 0 },
				analysed: 0
			},
			{ rating: 800, attempts: 0 }
		);
		expect(v.every((x) => x.score === null)).toBe(true);
		expect(weakestSkill(v)).toBeNull();
	});

	it('findet die schwächste Fähigkeit', () => {
		const v = skillProfile(
			{
				phaseAccuracy: { opening: 90, middlegame: 70, endgame: null },
				perGame: { blunders: 2.4, mistakes: 1, inaccuracies: 2 },
				analysed: 10
			},
			{ rating: 1000, attempts: 40 }
		);
		expect(Object.fromEntries(v.map((x) => [x.skill, x.score]))).toEqual({
			opening: 80,
			middlegame: 40,
			tactics: 38,
			endgame: null,
			safety: 20
		});
		expect(weakestSkill(v)?.skill).toBe('safety');
	});
});
