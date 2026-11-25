import { describe, expect, it } from 'vitest';
import { BOTS, chooseBotMove, botById } from './bots';
import type { PvLine } from '#lib/engine/uci.js';

const lines: PvLine[] = [
	{ multipv: 1, depth: 8, cp: 120, pv: ['e2e4'] },
	{ multipv: 2, depth: 8, cp: 40, pv: ['d2d4'] },
	{ multipv: 3, depth: 8, cp: -300, pv: ['g2g4'] }
];
const legal = ['e2e4', 'd2d4', 'g2g4', 'a2a3'];

function seq(...xs: number[]) {
	let i = 0;
	return () => xs[i++ % xs.length];
}

describe('Bots', () => {
	it('sind nach Stärke sortiert und haben eindeutige IDs', () => {
		const elos = BOTS.map((b) => b.elo);
		expect([...elos].sort((a, b) => a - b)).toEqual(elos);
		expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
		expect(BOTS).toHaveLength(8);
	});

	it('starker Bot spielt fast immer den besten Zug', () => {
		const doris = botById('doris');
		let best = 0;
		for (let i = 0; i < 200; i++) {
			if (chooseBotMove(doris, lines, legal, new Set()) === 'e2e4') best++;
		}
		expect(best).toBeGreaterThan(190);
	});

	it('schwacher Bot spielt auch schlechtere Züge', () => {
		const bruno = botById('bruno');
		const picks = new Set<string>();
		for (let i = 0; i < 300; i++) picks.add(chooseBotMove(bruno, lines, legal, new Set()) ?? '');
		expect(picks.size).toBeGreaterThanOrEqual(3);
	});

	it('Aussetzer ist ein plausibler schwächerer Kandidat, gierige Schlagzüge bevorzugt', () => {
		const bruno = botById('bruno');
		// rng: 0.0 → Aussetzer, 0.5 → Gewichtung (d2d4: 1, Schlagzug g2g4: 3)
		const m = chooseBotMove(bruno, lines, legal, new Set(['g2g4']), seq(0.0, 0.5));
		expect(m).toBe('g2g4');
	});

	it('ohne Engine-Kandidaten bleibt nur ein zufälliger legaler Zug', () => {
		const m = chooseBotMove(botById('bruno'), [], legal, new Set(), seq(0.9, 0.0));
		expect(legal).toContain(m);
	});

	it('spielt in der Eröffnung Buchzüge, gängige häufiger', () => {
		const book = new Map([
			['d2d4', 50],
			['a2a3', 1]
		]);
		let d4 = 0;
		for (let i = 0; i < 200; i++) {
			if (
				chooseBotMove(botById('bruno'), lines, legal, new Set(), Math.random, { book, ply: 0 }) ===
				'd2d4'
			)
				d4++;
		}
		expect(d4).toBeGreaterThan(150);
	});

	it('Buch endet nach der Buch-Tiefe', () => {
		const book = new Map([['a2a3', 10]]);
		const m = chooseBotMove(botById('doris'), lines, legal, new Set(), () => 0.99, {
			book,
			ply: 40
		});
		expect(m).not.toBe('a2a3');
	});

	it('schlägt zurück, wenn es nicht klar schlecht ist', () => {
		const recap: PvLine[] = [
			{ multipv: 1, depth: 8, cp: 50, pv: ['g1f3'] },
			{ multipv: 2, depth: 8, cp: 20, pv: ['d1d5'] }
		];
		const m = chooseBotMove(
			botById('bruno'),
			recap,
			['g1f3', 'd1d5'],
			new Set(['d1d5']),
			() => 0.5,
			{
				recaptureOn: 'd5'
			}
		);
		expect(m).toBe('d1d5');
	});

	it('ohne legale Züge gibt es keinen Zug', () => {
		expect(chooseBotMove(BOTS[0], [], [], new Set())).toBeNull();
	});
});
