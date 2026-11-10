import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, setSetting, getSetting, bumpActivity, today } from './db';
import { exportAll, importAll, parseBackup } from './backup';

describe('Backup', () => {
	it('Export → Import ergibt dieselben Daten', async () => {
		await setSetting('puzzleRating', { rating: 950, rd: 120, vol: 0.06 });
		await db.games.add({
			date: 1,
			pgn: '1. e4 *',
			moves: ['e2e4'],
			startFen: 'x',
			result: '*',
			myColor: 'white',
			opponent: 'Bot',
			source: 'bot'
		});
		await bumpActivity('puzzles', 3);

		const backup = await exportAll();
		const json = JSON.stringify(backup);

		await db.games.clear();
		await db.settings.clear();
		expect(await db.games.count()).toBe(0);

		await importAll(parseBackup(json));
		expect(await db.games.count()).toBe(1);
		expect(await getSetting('puzzleRating', null)).toEqual({ rating: 950, rd: 120, vol: 0.06 });
		expect((await db.activity.get(today()))?.puzzles).toBe(3);
	});

	it('lehnt fremde Dateien ab', () => {
		expect(() => parseBackup('{"foo":1}')).toThrow('not a Rookie backup');
		expect(() => parseBackup('kein json')).toThrow('not valid JSON');
	});
});
