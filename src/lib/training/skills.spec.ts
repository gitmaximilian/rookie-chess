import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import {
	adviceFor,
	collectSkills,
	eloFor,
	lossPerMoveAt,
	MEAN_COUNT,
	overallLevel,
	scoreFor,
	shareAt,
	SKILL_TABLE,
	SKILLS,
	skillMirror,
	valueAt,
	type SkillRaw
} from './skills';

const sample = (value: number | null, n: number, perGame: number[] = []) => ({ value, n, perGame });
/** Rohdaten, die genau dem typischen Spieler einer Wertung entsprechen */
const rawAt = (elo: number, p: Partial<SkillRaw> = {}): SkillRaw => ({
	games: 20,
	perGameCount: { ...MEAN_COUNT },
	safety: sample(valueAt('safety', elo), 600, [2, 3, 4]),
	tactics: sample(valueAt('tactics', elo), 60, [40, 60, 50]),
	opening: sample(valueAt('opening', elo), 200, [70, 80, 75]),
	strategy: sample(valueAt('strategy', elo), 120, [80, 85, 90]),
	endgame: sample(valueAt('endgame', elo), 120, [70, 80, 75]),
	...p
});

describe('Skill-Penta: Eichung', () => {
	it('alle fünf Werte und Verluste sind monoton in der Wertung', () => {
		for (let i = 1; i < SKILL_TABLE.length; i++) {
			const a = SKILL_TABLE[i - 1];
			const b = SKILL_TABLE[i];
			expect(b.safety).toBeLessThanOrEqual(a.safety);
			for (const k of ['tactics', 'opening', 'strategy', 'endgame'] as const)
				expect(b[k]).toBeGreaterThanOrEqual(a[k]);
			for (const k of SKILLS) expect(b.lpm[k]).toBeLessThanOrEqual(a.lpm[k]);
		}
	});

	it('Elo-Entsprechung und Umkehrung passen zusammen; außen begrenzt', () => {
		expect(eloFor('safety', valueAt('safety', 1200))).toBeCloseTo(1200, -1);
		expect(eloFor('opening', valueAt('opening', 1800))).toBeCloseTo(1800, -1);
		expect(eloFor('safety', 20)).toBe(SKILL_TABLE[0].r);
		expect(eloFor('safety', 0)).toBe(SKILL_TABLE.at(-1)!.r);
	});

	it('100 Punkte = Weltspitze (2800)', () => {
		expect(scoreFor(2800)).toBe(100);
		expect(scoreFor(1400)).toBe(50);
	});

	it('unter 1300 erklären Sicherheit und Taktik den Großteil des Abstands zum nächsten Band', () => {
		const s = shareAt(1000);
		expect(s.safety + s.tactics).toBeGreaterThan(0.6);
		expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
	});
});

describe('Skill-Penta: Spiegel', () => {
	it('typischer 1100er: alle Ecken ≈ 1100, Gesamtniveau ≈ 1100', () => {
		const v = skillMirror(rawAt(1100));
		for (const x of v) expect(Math.abs(x.elo! - 1100)).toBeLessThanOrEqual(50);
		expect(Math.abs(overallLevel(v)!.elo - 1100)).toBeLessThanOrEqual(50);
	});

	it('zu wenig Daten: Ecke leer, sagt was fehlt', () => {
		const v = skillMirror(rawAt(1100, { endgame: sample(80, 25) }));
		const eg = v.find((x) => x.skill === 'endgame')!;
		expect(eg.score).toBeNull();
		expect(eg.missing).toBe(15);
		const s = v.find((x) => x.skill === 'safety')!;
		expect(s.low! <= s.elo! && s.high! >= s.elo!).toBe(true);
	});

	it('schwache Sicherheit senkt das Gesamtniveau und wird zum größten Hebel', () => {
		const raw = rawAt(1300, { safety: sample(valueAt('safety', 700), 600, [4, 5, 6]) });
		const v = skillMirror(raw);
		const all = overallLevel(v)!;
		expect(all.elo).toBeLessThan(1300);
		expect(all.elo).toBeGreaterThan(700);
		const a = adviceFor(v, raw);
		expect(a[0].skill).toBe('safety');
		expect(a[0].gain).toBeGreaterThan(30);
		// Gewinn folgt aus weniger verlorener Gewinnchance × eigener Zugzahl
		const pts =
			(lossPerMoveAt('safety', 700) - lossPerMoveAt('safety', a[0].target)) * MEAN_COUNT.safety;
		expect(a[0].points).toBeCloseTo(pts, 0);
	});

	it('wer kaum Endspiele spielt, gewinnt durch Endspieltraining wenig', () => {
		const base = rawAt(1100, { endgame: sample(valueAt('endgame', 700), 200) });
		const few = { ...base, perGameCount: { ...base.perGameCount, endgame: 1 } };
		const many = { ...base, perGameCount: { ...base.perGameCount, endgame: 15 } };
		const g = (r: SkillRaw) =>
			adviceFor(skillMirror(r), r).find((x) => x.skill === 'endgame')!.gain;
		expect(g(many)).toBeGreaterThan(g(few));
	});

	it('weniger als drei Ecken mit Daten: kein Gesamtniveau, keine Empfehlung', () => {
		const raw = rawAt(1100, {
			opening: sample(80, 1),
			strategy: sample(80, 1),
			endgame: sample(80, 1)
		});
		const v = skillMirror(raw);
		expect(overallLevel(v)).toBeNull();
		expect(adviceFor(v, raw)).toEqual([]);
	});

	it('sammelt Messwerte aus einer analysierten Partie (Narrenmatt, Weiß patzt mit g4)', () => {
		const g: GameRow = {
			date: 1,
			pgn: '',
			moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
			startFen: INITIAL_FEN,
			result: '0-1',
			myColor: 'white',
			opponent: 'x',
			source: 'pgn',
			analysis: {
				done: true,
				depth: 11,
				evals: [
					{ cp: 20, best: 'e2e4' },
					{ cp: -40, best: 'e7e5' },
					{ cp: -50, best: 'b1c3' },
					{ mate: -1, best: 'd8h4' },
					{ cp: -10000 }
				]
			}
		};
		const r = collectSkills([g]);
		expect(r.games).toBe(1);
		expect(r.safety.n).toBe(2);
		expect(r.safety.value).toBe(15);
		expect(r.perGameCount.safety).toBe(2);
	});
});
