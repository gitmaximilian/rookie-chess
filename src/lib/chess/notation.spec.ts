import { describe, expect, it } from 'vitest';
import { figurineText } from './notation.js';

describe('figurineText', () => {
	it('stellt deutsche und englische Figurenbuchstaben auf Symbole um', () => {
		expect(figurineText('1.e4 e5 2.Sf3 Sc6 3.Lc4 – schnelle Entwicklung')).toBe(
			'1.e4 e5 2.♘f3 ♘c6 3.♗c4 – schnelle Entwicklung'
		);
		expect(figurineText('1.e4 e5 2.Nf3 Nc6 3.Bc4')).toBe('1.e4 e5 2.♘f3 ♘c6 3.♗c4');
		expect(figurineText('dann Sbd2–f1–g3, Te1, Dxd5, O-O')).toBe('dann ♘bd2–f1–g3, ♖e1, ♕xd5, O-O');
		expect(figurineText('(Lb3/La2)')).toBe('(♗b3/♗a2)');
	});

	it('lässt Wörter und Felder in Ruhe', () => {
		const s = 'Der Läufer auf c4 zielt auf f7. Damengambit, Bauer b5, Turm a1, Spanisch, Le Havre';
		expect(figurineText(s)).toBe(s);
	});
});
