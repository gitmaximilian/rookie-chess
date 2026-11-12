import { describe, expect, it } from 'vitest';
import { computeStars, lineStars, totalStars } from './stars';
import { BASICS, TACTICS } from '#lib/basics/lessons.js';
import { LESSONS } from '#lib/endgames/lessons.js';
import { COURSES } from '#lib/openings/courses.js';

const empty = { basicsDone: [], tacticsDone: [], courseProgress: {}, endgameStars: {} };

describe('Sterne', () => {
	it('Variante: Sterne nach Trefferquote beim ersten Versuch', () => {
		expect(lineStars(undefined)).toBe(0);
		expect(lineStars({ firstTry: 10, total: 10, date: 0 })).toBe(3);
		expect(lineStars({ firstTry: 7, total: 10, date: 0 })).toBe(2);
		expect(lineStars({ firstTry: 2, total: 10, date: 0 })).toBe(1);
	});

	it('neu: alles 0, Maximum stimmt', () => {
		const a = computeStars(empty);
		expect(a.every((x) => x.earned === 0)).toBe(true);
		const lines = COURSES.reduce((s, c) => s + c.lines.length, 0);
		expect(totalStars(a).max).toBe((BASICS.length + TACTICS.length + lines + LESSONS.length) * 3);
	});

	it('zählt Lektionen, Varianten und Endspiele', () => {
		const c = COURSES[0];
		const a = computeStars({
			basicsDone: [BASICS[0].id, BASICS[1].id, 'unbekannt'],
			tacticsDone: [TACTICS[0].id],
			courseProgress: { [c.id]: { [c.lines[0].id]: { firstTry: 9, total: 10, date: 0 } } },
			endgameStars: { [LESSONS[0].id]: 2, [LESSONS[1].id]: 5 }
		});
		const by = Object.fromEntries(a.map((x) => [x.area, x.earned]));
		expect(by).toEqual({ basics: 6, tactics: 3, openings: 3, endgames: 5 });
	});
});
