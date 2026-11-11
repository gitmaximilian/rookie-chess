import { describe, expect, it } from 'vitest';
import { Game } from '#lib/chess/game.js';
import { lessonById, LESSONS } from './lessons';
import { afterPlayerMove, afterOpponentMove, stars } from './judge';

const kqk = lessonById('kqk')!;
const square = lessonById('square')!;
const opp = lessonById('opposition')!;

describe('Endspiel-Bewertung', () => {
	it('alle Lektionen haben gültige Startstellungen', () => {
		for (const l of LESSONS)
			for (const fen of l.positions) {
				const g = new Game(fen);
				expect(g.turn).toBe(l.player);
				expect(g.legalUcis().length).toBeGreaterThan(0);
			}
	});

	it('Matt ist Erfolg', () => {
		const g = new Game('k7/8/1K6/8/8/8/7Q/8 w - - 0 1');
		expect(g.play('h2h8')).not.toBeNull();
		expect(afterPlayerMove(kqk, g, 5, null).status).toBe('success');
	});

	it('Patt ist bei Gewinnaufgaben ein Fehlschlag', () => {
		const p = new Game('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1');
		p.play('g1g6');
		const v = afterPlayerMove(kqk, p, 5, null);
		expect(v.status).toBe('fail');
		expect(v.status === 'fail' && v.message).toBe('endgame.msg.stalemateFail');
	});

	it('Tablebase „remis“ nach eigenem Zug verschenkt den Sieg', () => {
		const g = new Game(kqk.positions[0]);
		g.play('d1d2');
		const v = afterPlayerMove(kqk, g, 1, {
			category: 'draw',
			dtm: 0,
			best: null,
			source: 'tablebase'
		});
		expect(v.status).toBe('fail');
	});

	it('Umwandlung erfüllt das Bauernziel', () => {
		const g = new Game('8/4P3/4K3/8/8/8/8/2k5 w - - 0 1');
		g.play('e7e8q');
		expect(
			afterPlayerMove(opp, g, 6, { category: 'loss', dtm: -9, best: null, source: 'tablebase' })
				.status
		).toBe('success');
	});

	it('Quadratregel: Bauer geschlagen ist Erfolg', () => {
		const g = new Game('8/8/8/8/k7/P7/8/7K b - - 0 1');
		g.play('a4a3');
		expect(afterOpponentMove(square, g).status).toBe('success');
	});

	it('Sterne', () => {
		expect(stars(kqk, 8, 0, 13)).toBe(3);
		expect(stars(kqk, 15, 0, 13)).toBe(2);
		expect(stars(kqk, 8, 3, 13)).toBe(1);
	});
});
