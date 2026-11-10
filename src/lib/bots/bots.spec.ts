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

	it('Aussetzer bevorzugt Schlagzüge', () => {
		const bruno = botById('bruno');
		// rng: 0.0 → Aussetzer, 0.1 → Schlagzug-Pool, 0.0 → erstes Element
		const m = chooseBotMove(bruno, lines, legal, new Set(['a2a3']), seq(0.0, 0.1, 0.0));
		expect(m).toBe('a2a3');
	});

	it('ohne legale Züge gibt es keinen Zug', () => {
		expect(chooseBotMove(BOTS[0], [], [], new Set())).toBeNull();
	});
});
