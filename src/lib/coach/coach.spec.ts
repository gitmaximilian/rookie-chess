import { describe, expect, it } from 'vitest';
import { threats } from './coach';

describe('Coach: Bedrohungen', () => {
	it('findet eine ungedeckte, angegriffene Figur', () => {
		// Weiß am Zug, Springer e5 wird von Dame e7 angegriffen und ist ungedeckt
		expect(threats('4k3/4q3/8/4N3/8/8/8/4K3 w - - 0 1')).toEqual([
			{ role: 'knight', square: 'e5' }
		]);
	});
	it('gedeckt und nicht von billigerer Figur angegriffen → keine Warnung', () => {
		expect(threats('4k3/4q3/8/4N3/3P4/8/8/4K3 w - - 0 1')).toEqual([]);
	});
	it('Dame von Bauer angegriffen → Warnung, obwohl gedeckt', () => {
		expect(threats('k7/8/3p4/4Q3/3P4/8/8/4K3 w - - 0 1')).toEqual([
			{ role: 'queen', square: 'e5' }
		]);
	});
});

describe('Eröffnungsprinzipien', () => {
	const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	it('warnt vor früher Dame, Randspringer und f-Bauer', async () => {
		const { principleTip } = await import('./coach');
		const afterE4E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
		expect(principleTip(afterE4E5, 'd1h5', ['e2e4', 'e7e5'])).toMatch(/queen|Dame/i);
		expect(principleTip(START, 'g1h3', [])).toMatch(/rim|Rand/i);
		expect(principleTip(START, 'f2f3', [])).toMatch(/f-pawn|f-Bauer/i);
		expect(principleTip(START, 'e2e4', [])).toBe('');
		expect(principleTip(START, 'g1f3', [])).toBe('');
	});
});
