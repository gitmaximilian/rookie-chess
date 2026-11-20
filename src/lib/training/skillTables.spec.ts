import { describe, expect, it } from 'vitest';
import { BLITZ_TABLE, BULLET_TABLE, tableFor } from './skillTables';
import {
	eloPerPointOf,
	meanCountOf,
	SKILL_TABLE,
	SKILLS,
	skillMirror,
	overallLevel
} from './skills';
import { adviceFor, collectSkills } from './skills';

describe('Eichung je Tempo', () => {
	it('Rapid und Klassisch teilen die Rapid/Classical-Tabelle, Blitz und Bullet haben eigene', () => {
		expect(tableFor('rapid')).toBe(SKILL_TABLE);
		expect(tableFor('classical')).toBe(SKILL_TABLE);
		expect(tableFor('blitz')).toBe(BLITZ_TABLE);
		expect(tableFor('bullet')).toBe(BULLET_TABLE);
	});

	it.each([
		['blitz', BLITZ_TABLE],
		['bullet', BULLET_TABLE]
	] as const)(
		'%s: Bänder aufsteigend, Werte monoton (Sicherheit fallend, sonst steigend)',
		(_, t) => {
			expect(t.length).toBeGreaterThanOrEqual(10);
			for (let i = 1; i < t.length; i++) {
				expect(t[i].r).toBeGreaterThan(t[i - 1].r);
				expect(t[i].safety).toBeLessThanOrEqual(t[i - 1].safety);
				for (const k of ['tactics', 'opening', 'strategy', 'endgame'] as const)
					expect(t[i][k]).toBeGreaterThanOrEqual(t[i - 1][k]);
			}
		}
	);

	it('jede Tabelle bringt eigene Zugzahlen und Elo-Wirkung mit', () => {
		expect(meanCountOf(BLITZ_TABLE)).not.toEqual(meanCountOf(SKILL_TABLE));
		expect(eloPerPointOf(BULLET_TABLE)).not.toBe(eloPerPointOf(SKILL_TABLE));
		for (const k of SKILLS) expect(meanCountOf(BULLET_TABLE)[k]).toBeGreaterThan(0);
	});

	it('dieselben Messwerte ergeben je Tempo eine andere Elo-Entsprechung', () => {
		const raw = collectSkills([]);
		const fake = {
			...raw,
			games: 20,
			safety: { value: 3, n: 600, perGame: [] },
			tactics: { value: 50, n: 80, perGame: [] },
			opening: { value: 82, n: 200, perGame: [] }
		};
		const rapid = overallLevel(skillMirror(fake, SKILL_TABLE), SKILL_TABLE)!;
		const bullet = overallLevel(skillMirror(fake, BULLET_TABLE), BULLET_TABLE)!;
		expect(rapid.elo).not.toBe(bullet.elo);
	});

	it('Blitz: Taktik zählt im Gesamtniveau, wird aber nicht gezeigt und nicht empfohlen', () => {
		const raw = collectSkills([]);
		const fake = {
			...raw,
			games: 20,
			safety: { value: 3, n: 600, perGame: [] },
			tactics: { value: 40, n: 80, perGame: [] },
			opening: { value: 82, n: 200, perGame: [] }
		};
		const m = skillMirror(fake, BLITZ_TABLE);
		const tac = m.find((v) => v.skill === 'tactics')!;
		expect(tac.hidden).toBe(true);
		expect(tac.elo).not.toBeNull();
		expect(adviceFor(m, fake, BLITZ_TABLE).some((a) => a.skill === 'tactics')).toBe(false);
		expect(skillMirror(fake, SKILL_TABLE).some((v) => v.hidden)).toBe(false);
	});
});
