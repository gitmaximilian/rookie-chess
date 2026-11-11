import { describe, expect, it } from 'vitest';
import { COURSES, lineUcis, isOwnPly } from './courses';
import { Game } from '#lib/chess/game.js';

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

describe('Vertiefung: Fallen und Pläne', async () => {
	const { DEPTH } = await import('./depth');
	it('jeder Kurs hat Pläne und typische Fehler', () => {
		for (const c of COURSES) {
			expect(DEPTH[c.id]?.plans.length, c.id).toBeGreaterThanOrEqual(2);
			expect(DEPTH[c.id]?.pitfalls.length, c.id).toBeGreaterThanOrEqual(2);
		}
	});
	for (const [id, d] of Object.entries(DEPTH))
		for (const trap of d.traps)
			it(`${id}/${trap.id}: Falle ist legal`, () => {
				const ucis = lineUcis({
					id: trap.id,
					name: trap.name,
					moves: trap.moves,
					notes: trap.notes
				});
				expect(trap.mistake).toBeLessThan(ucis.length);
				for (const k of Object.keys(trap.notes)) expect(Number(k)).toBeLessThan(ucis.length);
				if (trap.moves.endsWith('#')) {
					const g = Game.fromUciMoves(ucis);
					expect(g.end()?.kind).toBe('checkmate');
				}
			});
});
