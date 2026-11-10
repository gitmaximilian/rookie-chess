import { describe, expect, it } from 'vitest';
import { parseInfo, toWhite, scoreToCp, winChance, formatScore } from './uci';

describe('UCI', () => {
	it('liest info-Zeilen mit cp und mate', () => {
		const a = parseInfo(
			'info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1000 nps 1 time 5 pv e7e5 g1f3 b8c6'
		);
		expect(a).toEqual({ depth: 12, multipv: 2, cp: -35, pv: ['e7e5', 'g1f3', 'b8c6'] });
		const m = parseInfo('info depth 5 multipv 1 score mate 2 pv d1h5 g7g6');
		expect(m?.mate).toBe(2);
	});

	it('ignoriert Zeilen ohne pv oder mit Schranke', () => {
		expect(parseInfo('info string NNUE evaluation')).toBeNull();
		expect(parseInfo('info depth 3 multipv 1 score cp 20 lowerbound pv e2e4')).toBeNull();
	});

	it('rechnet in Sicht von Weiß um', () => {
		expect(toWhite({ cp: 50 }, 'black')).toEqual({ cp: -50, mate: undefined });
		expect(toWhite({ mate: 3 }, 'white')).toEqual({ mate: 3 });
	});

	it('Matt schlägt jeden Centipawn-Wert', () => {
		expect(scoreToCp({ mate: 5 })).toBeGreaterThan(scoreToCp({ cp: 2000 }));
		expect(scoreToCp({ mate: -1 })).toBeLessThan(scoreToCp({ cp: -2000 }));
		expect(scoreToCp({ mate: 1 })).toBeGreaterThan(scoreToCp({ mate: 4 }));
	});

	it('Gewinnchance und Formatierung', () => {
		expect(winChance(0)).toBeCloseTo(0.5);
		expect(winChance(500)).toBeGreaterThan(0.85);
		expect(formatScore({ cp: 123 })).toBe('+1.2');
		expect(formatScore({ mate: -2 })).toBe('#-2');
	});
});
