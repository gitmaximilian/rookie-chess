import { expect, it } from 'vitest';
import { Game } from './game';
it('Rochade als e1g1', () => {
	const g = Game.fromUciMoves(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']);
	expect(g.play('e1g1')?.san).toBe('O-O');
	expect(g.lastMove).toEqual(['e1', 'g1']);
});
