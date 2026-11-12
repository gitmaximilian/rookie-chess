import { describe, expect, it } from 'vitest';
import { accuracyScore, safetyScore, skillProfile, tacticsScore, weakestSkill } from './skills';

const base = {
	phaseAccuracy: { opening: null, middlegame: null, endgame: null },
	perGame: { blunders: 0, mistakes: 0, inaccuracies: 0 },
	analysed: 0,
	motifs: []
};

describe('Skill-Profil (nur aus Partien)', () => {
	it('Skalen', () => {
		expect(accuracyScore(50)).toBe(0);
		expect(accuracyScore(75)).toBe(50);
		expect(accuracyScore(100)).toBe(100);
		expect(accuracyScore(30)).toBe(0);
		expect(safetyScore(0)).toBe(100);
		expect(safetyScore(2.5)).toBe(50);
		expect(safetyScore(3.2)).toBe(36);
		expect(safetyScore(9)).toBe(0);
		expect(tacticsScore(0)).toBe(100);
		expect(tacticsScore(2)).toBe(50);
		expect(tacticsScore(6)).toBe(0);
	});

	it('ohne analysierte Partien: alles null, kein schwächster Bereich', () => {
		const v = skillProfile(base);
		expect(v.every((x) => x.score === null)).toBe(true);
		expect(weakestSkill(v)).toBeNull();
	});

	it('zu wenige Partien: Taktik und Sicherheit bleiben leer', () => {
		const v = skillProfile({ ...base, analysed: 2, perGame: { ...base.perGame, blunders: 1 } });
		expect(v.find((x) => x.skill === 'safety')?.score).toBeNull();
	});

	it('Puzzles fließen nicht ein, positionelle Fehler zählen nicht als taktisch', () => {
		const v = skillProfile({
			phaseAccuracy: { opening: 90, middlegame: 70, endgame: null },
			perGame: { blunders: 2.4, mistakes: 1, inaccuracies: 2 },
			analysed: 10,
			motifs: [
				{ motif: 'hanging', n: 12 },
				{ motif: 'fork', n: 8 },
				{ motif: 'positional', n: 30 }
			]
		});
		expect(Object.fromEntries(v.map((x) => [x.skill, x.score]))).toEqual({
			opening: 80,
			middlegame: 40,
			tactics: 50,
			endgame: null,
			safety: 52
		});
		expect(weakestSkill(v)?.skill).toBe('middlegame');
	});
});
