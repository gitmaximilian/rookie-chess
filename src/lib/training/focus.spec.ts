import { describe, expect, it } from 'vitest';
import { pickFocus } from './focus';

describe('Schwerpunkt', () => {
	it('Fehler aus eigenen Partien gehen vor dem schwächsten Puzzle-Thema', () => {
		const f = pickFocus({
			motifs: [
				{ motif: 'positional', n: 20 },
				{ motif: 'hanging', n: 13 }
			],
			weakTheme: 'pin'
		});
		expect(f).toEqual({ theme: 'hangingPiece', source: 'games', motif: 'hanging', n: 13 });
	});

	it('ein einzelner Fehler ist noch kein Muster → Puzzle-Thema', () => {
		expect(pickFocus({ motifs: [{ motif: 'fork', n: 1 }], weakTheme: 'pin' })).toEqual({
			theme: 'pin',
			source: 'puzzles'
		});
	});

	it('ohne Daten kein Schwerpunkt', () => {
		expect(pickFocus({ motifs: [], weakTheme: null })).toBeNull();
	});
});
