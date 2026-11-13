import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { judge, accuracy } from './classify';
import { explain } from './explain';
import { figurine } from '#lib/chess/notation.js';
import { setLocaleForTest } from '#lib/i18n/i18n.svelte.js';

describe('Zugbewertung', () => {
	it('erkennt Patzer, Fehler, Ungenauigkeit', () => {
		expect(judge({ cp: 50, best: 'e2e4' }, { cp: -600 }, 'white', 'a2a3').judgement).toBe(
			'blunder'
		);
		expect(judge({ cp: 50, best: 'e2e4' }, { cp: -60 }, 'white', 'a2a3').judgement).toBe('mistake');
		expect(judge({ cp: 50, best: 'e2e4' }, { cp: -10 }, 'white', 'a2a3').judgement).toBe(
			'inaccuracy'
		);
		expect(judge({ cp: 50, best: 'e2e4' }, { cp: 40 }, 'white', 'a2a3').judgement).toBe('good');
		expect(judge({ cp: 50, best: 'e2e4' }, { cp: 50 }, 'white', 'e2e4').judgement).toBe('best');
	});

	it('bewertet aus Sicht von Schwarz', () => {
		expect(judge({ cp: -50, best: 'e7e5' }, { cp: 600 }, 'black', 'a7a6').judgement).toBe(
			'blunder'
		);
	});

	it('Genauigkeit', () => {
		expect(accuracy([0, 0, 0])).toBe(100);
		expect(accuracy([0.6, 0.6])).toBeLessThan(40);
		expect(accuracy([0.02, 0.04])).toBeGreaterThan(85);
	});
});

describe('Erklärungen', () => {
	beforeAll(() => setLocaleForTest('de'));
	afterAll(() => setLocaleForTest('en'));

	it('Figur eingestellt', () => {
		// Weiß zieht Springer nach e5, wo ein Bauer d6 ihn schlägt
		const fen = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
		const e = explain(fen, 'f3g5', { cp: 30, best: 'd2d4' }, { cp: -300, best: 'd8g5' }, 'blunder');
		expect(e?.motif).toBe('hanging');
		expect(e?.title).toBe('Springer eingestellt');
		expect(e?.text).toContain('Springer');
		expect(e?.text).toContain('g5');
	});

	it('Matt in 1 übersehen', () => {
		const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
		const e = explain(fen, 'h2h3', { mate: 1, best: 'd1d8', pv: ['d1d8'] }, { cp: 500 }, 'mistake');
		expect(e?.title).toBe('Matt in 1 übersehen');
		expect(e?.text).toContain('♖d8#');
	});

	it('Matt zugelassen', () => {
		const fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/8/PPPPPP1P/RNBQKBNR w KQkq - 0 2';
		const e = explain(
			fen,
			'f2f3',
			{ cp: -100, best: 'f1g2' },
			{ mate: -1, best: 'd8h4', pv: ['d8h4'] },
			'blunder'
		);
		expect(e?.motif).toBe('mate-allowed');
		expect(e?.text).toContain('♕h4#');
	});

	it('Gabel zugelassen', () => {
		// Schwarzer Springer kann auf c2 König und Turm angreifen
		const fen = 'r1bqkbnr/pppp1ppp/8/4p3/1n2P3/8/PPPPQPPP/RNB1KBNR w KQkq - 0 4';
		const e = explain(fen, 'e2d1', { cp: 0, best: 'a2a3' }, { cp: -400, best: 'b4c2' }, 'blunder');
		expect(e?.motif).toBe('fork');
		expect(e?.text).toMatch(/König|Turm|Dame/);
	});

	it('auf Englisch', () => {
		setLocaleForTest('en');
		const fen = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
		const e = explain(fen, 'f3g5', { cp: 30, best: 'd2d4' }, { cp: -300, best: 'd8g5' }, 'blunder');
		expect(e?.title).toBe('Knight blundered');
		expect(e?.text).toContain('Your knight on g5 is unprotected');
		setLocaleForTest('de');
	});

	it('gute Züge brauchen keine Erklärung', () => {
		expect(explain('8/8/8/8/8/8/8/K6k w - - 0 1', 'a1a2', {}, {}, 'good')).toBeNull();
	});

	it('Figurennotation', () => {
		expect(figurine('Nf3')).toBe('♘f3');
		expect(figurine('exd8=Q+')).toBe('exd8=♕+');
	});
});
