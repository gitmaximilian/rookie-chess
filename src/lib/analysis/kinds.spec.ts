import { describe, expect, it } from 'vitest';
import { judge } from './classify';
import { explain } from './explain';
import { isSacrifice, moveKind, commentFor, verdict, sanMoves } from './kinds';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Opfer', () => {
	it('Läufer schlägt auf f7 mit Schach und kann vom König genommen werden', () => {
		// Italienisch: Lxf7+ – der Läufer (3) nimmt einen Bauern (1) und hängt
		const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';
		expect(isSacrifice(fen, 'c4f7')).toBe(true);
	});

	it('gedeckter Springerzug ist kein Opfer', () => {
		expect(isSacrifice(START, 'g1f3')).toBe(false);
	});

	it('Bauernzüge sind nie Opfer', () => {
		expect(isSacrifice(START, 'e2e4')).toBe(false);
	});
});

describe('Zugarten', () => {
	const base = {
		loss: 0,
		mover: 'white' as const,
		fenBefore: START,
		book: false,
		explanation: null
	};

	it('Buchzug schlägt „bester Zug“', () => {
		expect(
			moveKind({
				...base,
				judgement: 'best',
				played: 'e2e4',
				before: { cp: 20, best: 'e2e4' },
				after: { cp: 20 },
				book: true
			})
		).toBe('book');
	});

	it('einziger guter Zug → stark', () => {
		expect(
			moveKind({
				...base,
				judgement: 'best',
				played: 'e2e4',
				before: { cp: 50, best: 'e2e4', second: { cp: -250 } },
				after: { cp: 50 }
			})
		).toBe('great');
	});

	it('ohne zweite Variante bleibt es „bester Zug“', () => {
		expect(
			moveKind({
				...base,
				judgement: 'best',
				played: 'e2e4',
				before: { cp: 50, best: 'e2e4' },
				after: { cp: 50 }
			})
		).toBe('best');
	});

	it('fast verlustfrei → exzellent, sonst gut', () => {
		const k = (loss: number) =>
			moveKind({
				...base,
				judgement: 'good',
				loss,
				played: 'd2d4',
				before: { cp: 30, best: 'e2e4' },
				after: { cp: 25 }
			});
		expect(k(0.01)).toBe('excellent');
		expect(k(0.08)).toBe('good');
	});

	it('Matt zulassen ist immer ein Patzer, auch in verlorener Stellung', () => {
		expect(judge({ cp: -900, best: 'd1e2' }, { mate: -1 }, 'white', 'f1e2').judgement).toBe(
			'blunder'
		);
	});
});

describe('Kommentar', () => {
	it('beschreibt gute Züge statt nur „gut“', () => {
		const c = commentFor({
			fenBefore: START,
			played: 'g1f3',
			kind: 'excellent',
			ply: 1,
			before: { cp: 30, best: 'e2e4' },
			explanation: null,
			mine: true
		});
		expect(c.headline).toContain('f3');
		expect(c.text).toMatch(/Develops the knight/);
		expect(c.text).toMatch(/Just as strong: e4/);
	});

	it('gegnerischer Fehler: zeigt, wie man ihn bestraft', () => {
		const fen = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
		const before = { cp: 30, best: 'd2d4' };
		const after = { cp: -300, best: 'd8g5' };
		const c = commentFor({
			fenBefore: fen,
			played: 'f3g5',
			kind: 'blunder',
			ply: 5,
			before,
			after,
			explanation: explain(fen, 'f3g5', before, after, 'blunder'),
			mine: false
		});
		expect(c.text).toMatch(/punish it with ♕xg5/);
		expect(c.text).not.toMatch(/[Yy]our knight/);
	});

	it('Einordnung der Stellung', () => {
		expect(verdict({ cp: 10 })).toBe('Equal position');
		expect(verdict({ cp: 450 })).toBe('White is winning');
		expect(verdict({ cp: -150 })).toBe('Black is better');
		expect(verdict({ mate: 3 })).toBe('White mates in 3');
	});

	it('SAN-Variante bricht bei ungültigen Zügen ab', () => {
		expect(sanMoves(START, ['e2e4', 'e7e5', 'e1e8'])).toEqual(['e4', 'e5']);
	});
});

describe('Nachsicht: nicht nur der Top-Zug ist gut', () => {
	it('gleichwertige Alternative ist kein Fehler (zweitbeste Linie fast gleichauf)', () => {
		// bester Zug +0,6, zweitbester +0,5; gespielt wurde ein Zug, der +0,5 hält – nach der
		// Bewertung nach dem Zug (Rauschen) wirkt er aber wie −1,0
		const before = { cp: 60, best: 'g1f3', second: { cp: 50 } };
		expect(judge(before, { cp: 50 }, 'white', 'b1c3').judgement).toBe('good');
		// ohne zweite Linie (alte Analysen) bleibt es bei den Lichess-Schwellen
		expect(judge({ cp: 60, best: 'g1f3' }, { cp: -150 }, 'white', 'b1c3').judgement).not.toBe(
			'good'
		);
	});

	it('nur ein guter Zug (zweitbeste Linie viel schlechter) → Fehler zählt', () => {
		const before = { cp: 60, best: 'g1f3', second: { cp: -300 } };
		expect(judge(before, { cp: -300 }, 'white', 'b1c3').judgement).toBe('blunder');
	});

	it('Matt in 7 ausgelassen, aber klar gewonnen → kein Fehler', () => {
		const before = { mate: 7, best: 'd1d8' };
		expect(judge(before, { cp: 1500 }, 'white', 'd1d7').judgement).toBe('good');
	});

	it('Matt in 2 ausgelassen und nur noch leicht besser → mindestens Fehler', () => {
		const before = { mate: 2, best: 'd1d8' };
		expect(['mistake', 'blunder']).toContain(judge(before, { cp: 250 }, 'white', 'd1d7').judgement);
		// Matt in 2 verpasst, aber weiter klar gewonnen (+6): nur eine Ungenauigkeit
		expect(judge(before, { cp: 600 }, 'white', 'd1d7').judgement).toBe('inaccuracy');
	});

	it('entschiedene Stellung: kleine Abweichung ist kein Fehler', () => {
		// +9 → +5: weiter klar gewonnen
		expect(judge({ cp: 900, best: 'a1a8' }, { cp: 500 }, 'white', 'a1a7').judgement).toBe('good');
		// −9 → −14: ohnehin verloren
		expect(judge({ cp: -900, best: 'a1a8' }, { cp: -1400 }, 'white', 'a1a7').judgement).toBe(
			'good'
		);
		// aber: aus klar gewonnen wird ausgeglichen → Patzer bleibt Patzer
		expect(judge({ cp: 900, best: 'a1a8' }, { cp: 0 }, 'white', 'a1a7').judgement).toBe('blunder');
	});
});
