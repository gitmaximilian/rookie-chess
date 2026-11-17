import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Game } from '#lib/chess/game.js';
import { DECISION_PRACTICE, DECISION_TRANSFER } from './decision';

test('all decision positions are playable and the transfer form has its own positions', () => {
	const boardKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
	const all = [...DECISION_PRACTICE, ...DECISION_TRANSFER];
	expect(new Set(all.map(({ fen }) => boardKey(fen))).size).toBe(all.length);
	const safety: [string, string][] = JSON.parse(readFileSync('static/safety/items.json', 'utf8'));
	const safetyKeys = new Set(safety.map(([, fen]) => boardKey(fen)));
	for (const { fen } of DECISION_TRANSFER) expect(safetyKeys.has(boardKey(fen))).toBe(false);
	for (const { fen } of all) {
		const game = new Game(fen);
		expect(game.end()).toBeNull();
		expect(game.legalUcis().length).toBeGreaterThan(1);
	}
});
