import { describe, expect, it } from 'vitest';
import { COURSES, lineUcis, isOwnPly } from './courses';

describe('Eröffnungskurse', () => {
	for (const c of COURSES)
		for (const line of c.lines)
			it(`${c.id}/${line.id}: alle Züge legal, Notizen passen`, () => {
				const ucis = lineUcis(line);
				expect(ucis.length).toBeGreaterThan(5);
				// Linie endet mit einem eigenen Zug
				expect(isOwnPly(c, ucis.length - 1)).toBe(true);
				for (const k of Object.keys(line.notes)) {
					expect(Number(k)).toBeLessThan(ucis.length);
					expect(line.notes[+k].en.length).toBeGreaterThan(2);
					expect(line.notes[+k].de.length).toBeGreaterThan(2);
				}
			});

	it('IDs eindeutig', () => {
		expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
		for (const c of COURSES) expect(new Set(c.lines.map((l) => l.id)).size).toBe(c.lines.length);
	});
});
