import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, setSetting, getSetting, bumpActivity, today } from './db';
import { exportAll, importAll, mergeBackup, parseBackup } from './backup';

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

	it('Zusammenführen: eine alte Sicherung löscht keine neueren Daten', async () => {
		for (const t of ['games', 'puzzleAttempts', 'settings', 'activity'] as const)
			await db.table(t).clear();
		const game = (date: number, opponent: string) => ({
			date,
			pgn: '',
			moves: ['e2e4'],
			startFen: 'x',
			result: '1-0' as const,
			myColor: 'white' as const,
			opponent,
			source: 'bot' as const
		});
		// Stand der alten Sicherung: eine Partie, ein Puzzle
		await db.games.add(game(1, 'Alt'));
		await db.puzzleAttempts.add({
			puzzleId: 'p1',
			date: 10,
			solved: true,
			ratingAfter: 900,
			themes: [],
			source: 'lichess'
		});
		const old = parseBackup(JSON.stringify(await exportAll()));
		// danach weitergespielt
		await db.games.add(game(2, 'Neu'));
		await db.puzzleAttempts.add({
			puzzleId: 'p2',
			date: 20,
			solved: false,
			ratingAfter: 880,
			themes: [],
			source: 'lichess'
		});

		await mergeBackup(old);
		expect((await db.games.toArray()).map((g) => g.opponent).sort()).toEqual(['Alt', 'Neu']);
		expect((await db.puzzleAttempts.toArray()).map((a) => a.puzzleId).sort()).toEqual(['p1', 'p2']);
	});
});
