import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/db/db.js';
import { Game } from '#lib/chess/game.js';
import {
	STARTERS,
	addLine,
	addStarter,
	hasStarter,
	movesAt,
	removeNode,
	repertoireStats,
	afterFen
} from './repertoire';

beforeEach(async () => {
	await db.repertoire.clear();
	await db.reviewCards.clear();
});

describe('Repertoire', () => {
	it('alle Start-Repertoires sind legal', () => {
		for (const s of STARTERS)
			for (const line of s.lines) expect(() => Game.fromUciMoves(line)).not.toThrow();
	});

	it('legt Züge an, eigene bekommen fällige Karten', async () => {
		const n = await addLine('white', ['e2e4', 'e7e5', 'g1f3']);
		expect(n).toBe(2);
		const at = await movesAt('white', new Game().fen);
		expect(at).toHaveLength(1);
		expect(at[0]).toMatchObject({ san: 'e4', mine: true });
		expect((await repertoireStats('white')).due).toBe(2);
	});

	it('doppelte Züge werden nicht doppelt angelegt', async () => {
		await addLine('white', ['e2e4', 'e7e5']);
		expect(await addLine('white', ['e2e4', 'c7c5'])).toBe(0);
		expect(await db.repertoire.count()).toBe(3);
	});

	it('Start-Repertoire hinzufügen und erkennen', async () => {
		const italian = STARTERS.find((s) => s.id === 'italian')!;
		expect(await hasStarter(italian)).toBe(false);
		await addStarter(italian);
		expect(await hasStarter(italian)).toBe(true);
	});

	it('Zug entfernen entfernt die Fortsetzung', async () => {
		await addLine('black', ['e2e4', 'c7c6', 'd2d4', 'd7d5']);
		await addLine('black', ['d2d4', 'd7d5']);
		const [e4] = await movesAt('black', new Game().fen).then((r) =>
			r.filter((x) => x.uci === 'e2e4')
		);
		await removeNode(e4);
		const left = await db.repertoire.toArray();
		expect(left.map((r) => r.san).sort()).toEqual(['d4', 'd5']);
		expect(afterFen(left.find((r) => r.san === 'd4')!)).toContain(' b ');
	});
});

describe('Eröffnungsnamen', () => {
	it('englisch gespeichert, deutsch übersetzt', async () => {
		const { translateOpening } = await import('#lib/data/openingNamesDe.js');
		expect(translateOpening('Sicilian Defense: Najdorf Variation')).toBe(
			'Sizilianische Verteidigung: Najdorf Variation'
		);
		expect(translateOpening('Some Unknown Opening')).toBe('Some Unknown Opening');
	});
});

describe('Eröffnungsbuch', () => {
	it('wichtige Züge zuerst', async () => {
		const { readFileSync } = await import('node:fs');
		const { setOpeningsForTest, continuations } = await import('#lib/data/openings.js');
		setOpeningsForTest(JSON.parse(readFileSync('static/openings.json', 'utf8')));
		const first = continuations([])
			.slice(0, 3)
			.map((c) => c.uci);
		expect(first).toContain('e2e4');
		expect(first).toContain('d2d4');
		const vsE4 = continuations(['e2e4'])
			.slice(0, 4)
			.map((c) => c.uci);
		expect(vsE4).toContain('c7c5');
		expect(vsE4).toContain('e7e5');
	});
});
