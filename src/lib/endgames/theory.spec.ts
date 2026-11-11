import { describe, expect, it } from 'vitest';
import { LESSONS } from './lessons';
import { Game } from '#lib/chess/game.js';

describe('Endspiel-Theorie', () => {
	for (const l of LESSONS)
		it(`${l.id}: 4 gültige Stellungen mit legalen Pfeilen der Figuren`, () => {
			expect(l.theory).toHaveLength(4);
			for (const step of l.theory) {
				const g = new Game(step.fen);
				for (const sh of step.shapes)
					expect(g.pieceAt(sh.orig), `${step.fen} ${sh.orig}`).not.toBeNull();
			}
		});
});
