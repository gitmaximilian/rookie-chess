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
