import { describe, expect, it } from 'vitest';
import { accuracyScore, safetyScore, skillProfile, tacticsScore, weakestSkill } from './skills';

const base = {
	phaseAccuracy: { opening: null, middlegame: null, endgame: null },
	analysed: 0,
	blundersPer30: null,
	chances: { taken: 0, total: 0 }
};

describe('Skill-Profil (nur aus Partien)', () => {
	it('Skalen', () => {
		expect(accuracyScore(50)).toBe(0);
		expect(accuracyScore(75)).toBe(50);
		expect(accuracyScore(100)).toBe(100);
		expect(accuracyScore(30)).toBe(0);
		// Patzer je 30 eigene Züge
		expect(safetyScore(0)).toBe(100);
		expect(safetyScore(2.5)).toBe(50);
		expect(safetyScore(3.2)).toBe(36);
		expect(safetyScore(9)).toBe(0);
		// Anteil genutzter Chancen in Prozent
		expect(tacticsScore(0)).toBe(0);
		expect(tacticsScore(60)).toBe(60);
		expect(tacticsScore(100)).toBe(100);
	});

	it('ohne analysierte Partien: alles null, kein schwächster Bereich', () => {
		const v = skillProfile(base);
		expect(v.every((x) => x.score === null)).toBe(true);
		expect(weakestSkill(v)).toBeNull();
	});

	it('zu wenig Daten: Sicherheit erst ab 3 Partien, Taktik erst ab 5 Gelegenheiten', () => {
		const v = skillProfile({
			...base,
			analysed: 2,
			blundersPer30: 1,
			chances: { taken: 3, total: 4 }
		});
		expect(v.find((x) => x.skill === 'safety')?.score).toBeNull();
		expect(v.find((x) => x.skill === 'tactics')?.score).toBeNull();
	});

	it('jede Ecke misst etwas Eigenes', () => {
		const v = skillProfile({
			phaseAccuracy: { opening: 90, middlegame: 70, endgame: null },
			analysed: 10,
			blundersPer30: 2.4,
			chances: { taken: 6, total: 10 }
		});
		expect(Object.fromEntries(v.map((x) => [x.skill, x.score]))).toEqual({
			opening: 80,
			middlegame: 40,
			tactics: 60,
			endgame: null,
			safety: 52
		});
		expect(v.find((x) => x.skill === 'tactics')?.raw).toBe(60);
		expect(weakestSkill(v)?.skill).toBe('middlegame');
	});
});
