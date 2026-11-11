import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSetting } from '#lib/db/db.js';
import { firstRoute, needsOnboarding, saveProfile, startBot, startRating } from './profile';

describe('Einstieg', () => {
	beforeEach(async () => {
		await db.settings.clear();
		await db.puzzleAttempts.clear();
		await db.activity.clear();
		await db.games.clear();
	});

	it('Start-Rating und Bot passen zur Selbsteinschätzung', () => {
		expect(startRating({ rules: 'no', level: 'unknown' })).toBe(500);
		expect(startRating({ rules: 'yes', level: 'club' })).toBe(1300);
		expect(startBot({ rules: 'no', level: 'unknown' })).toBe('bruno');
		expect(startBot({ rules: 'yes', level: 'casual' })).toBe('tina');
	});

	it('wer die Regeln nicht kennt, startet mit den Grundlagen', () => {
		expect(firstRoute({ rules: 'no', level: 'unknown', focus: 'play', date: 0 })).toBe(
			'/learn/basics'
		);
		expect(firstRoute({ rules: 'yes', level: 'club', focus: 'tactics', date: 0 })).toBe('/puzzles');
	});

	it('nur ganz neue Nutzer werden gefragt', async () => {
		expect(await needsOnboarding()).toBe(true);
		await db.activity.put({ day: '2026-11-11', puzzles: 1, games: 0, reviews: 0 });
		expect(await needsOnboarding()).toBe(false);
	});

	it('speichert Profil, Rating und Bot', async () => {
		await saveProfile({ rules: 'yes', level: 'casual', focus: 'play', date: 1 });
		expect((await getSetting<{ rating: number }>('puzzleRating', { rating: 0 })).rating).toBe(950);
		expect(await getSetting('lastBotId', '')).toBe('tina');
		expect(await needsOnboarding()).toBe(false);
	});
});
