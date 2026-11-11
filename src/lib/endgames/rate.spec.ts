import { describe, expect, it } from 'vitest';
import { rateMove, type TbResult } from './tablebase';

const before: TbResult = {
	category: 'win',
	dtm: 19,
	best: 'd1d4',
	source: 'tablebase',
	moves: [
		{ uci: 'd1d4', san: 'Qd4+', category: 'loss', dtm: -18, dtz: -2 },
		{ uci: 'd1d3', san: 'Qd3', category: 'loss', dtm: -20, dtz: -2 },
		{ uci: 'd1a4', san: 'Qa4', category: 'loss', dtm: -30, dtz: -2 },
		{ uci: 'd1d8', san: 'Qd8', category: 'draw', dtm: null, dtz: 0 }
	]
};

describe('rateMove', () => {
	it('bester, guter, langsamer Zug', () => {
		expect(rateMove(before, 'd1d4', true)).toMatchObject({ kind: 'best', mine: 9 });
		expect(rateMove(before, 'd1d3', true)).toMatchObject({ kind: 'good' });
		expect(rateMove(before, 'd1a4', true)).toMatchObject({
			kind: 'slow',
			better: 'Qd4+',
			mine: 15,
			best: 9
		});
		expect(rateMove(before, 'd1d8', true)).toBeNull();
	});
	it('Verteidigung: Remis gehalten', () => {
		expect(rateMove(before, 'd1d8', false)).toEqual({ kind: 'holds' });
	});
	it('offline ohne Zugliste: keine Aussage', () => {
		expect(rateMove({ ...before, moves: undefined }, 'd1d4', true)).toBeNull();
	});
});
