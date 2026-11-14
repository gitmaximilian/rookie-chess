import { describe, expect, it } from 'vitest';
import { capturesOf, checksOf, flipped, hangingOf, scoreScan, suitable, targetsOf } from './scan';

// Weiß: Ke1, Dd1, Lc4, Sf3; Schwarz: Ke8, Sf6, La3, Bauern e5, f7
const FEN = '4k3/5p2/5n2/4p3/2B5/b4N2/8/3QK3 w - - 0 1';

describe('Brett-Scan', () => {
	it('findet alle Schachs der Seite am Zug', () => {
		// Lb5+, Lxf7+, Da4+ (Diagonale a4–e8), Dd7+, Dd8+ – von Hand geprüft
		expect(checksOf(FEN)).toEqual(['c4b5', 'c4f7', 'd1a4', 'd1d7', 'd1d8']);
	});

	it('findet alle Schlagzüge (auch en passant)', () => {
		expect(capturesOf(FEN)).toEqual(['c4f7', 'f3e5'].sort());
		const ep = 'k7/8/8/3pP3/8/8/8/K7 w - d6 0 1';
		expect(capturesOf(ep)).toEqual(['e5d6']);
	});

	it('hängende Figuren beider Seiten (ungedeckt oder von billigerer Figur angegriffen)', () => {
		// Sc3 wird vom Läufer b4 angegriffen und von nichts gedeckt
		expect(hangingOf('4k3/8/8/8/1b6/2N5/8/4K3 w - - 0 1')).toEqual(['c3']);
		// vom König gedeckt und gleichwertig angegriffen → hängt nicht
		expect(hangingOf('4k3/8/8/8/1b6/8/3N4/4K3 w - - 0 1')).toEqual([]);
		expect(hangingOf(FEN)).toEqual([]);
		// gedeckt, aber vom Bauern angegriffen
		expect(hangingOf('4k3/8/8/2p5/1N6/8/P7/4K3 w - - 0 1')).toEqual(['b4']);
		expect(hangingOf('4k3/8/8/8/1N6/8/P7/4K3 w - - 0 1')).toEqual([]);
	});

	it('Gegner-Sicht: nur wenn die Stellung umdrehbar ist', () => {
		expect(flipped(FEN)).not.toBeNull();
		// Weiß gibt gerade Schach → Schwarz am Zug wäre ok, Weiß (wir) im Schach wäre unmöglich
		expect(flipped('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')).toBeNull();
		// Schwarz hätte nur Lb4+ – kein Schlagzug
		expect(targetsOf(FEN, 'opponent')).toEqual(['a3b4']);
	});

	it('Auswahl: nicht leer, nicht zu viele', () => {
		expect(suitable([], 'checks')).toBe(false);
		expect(suitable(['a1a2'], 'checks')).toBe(true);
		expect(suitable(Array(8).fill('x'), 'checks')).toBe(false);
		expect(suitable(null, 'opponent')).toBe(false);
	});

	it('Bewertung: Treffer, übersehen, Fehlgriffe kosten', () => {
		expect(scoreScan(['a', 'b'], ['a', 'b'], 0)).toMatchObject({ score: 1, missed: [] });
		expect(scoreScan(['a', 'b'], ['a'], 0)).toMatchObject({ score: 0.5, missed: ['b'] });
		expect(scoreScan(['a', 'b'], ['a', 'b'], 2).score).toBe(0.75);
		expect(scoreScan([], [], 0).score).toBe(1);
	});
});
