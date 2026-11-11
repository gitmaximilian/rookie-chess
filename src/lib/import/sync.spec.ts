import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/db/db.js';
import { getLinked, link, syncNow, unlink } from './sync.svelte';

const PGN = `[White "alice"]
[Black "bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

function lichessLine(id: string, createdAt: number) {
	return JSON.stringify({
		id,
		variant: 'standard',
		speed: 'blitz',
		createdAt,
		players: {
			white: { user: { name: 'alice' }, rating: 1234 },
			black: { user: { name: 'bob' }, rating: 1300 }
		},
		pgn: PGN
	});
}

describe('Konto-Sync', () => {
	beforeEach(async () => {
		await db.games.clear();
		await db.settings.clear();
	});

	it('verknüpft, holt Partien mit Elo und überspringt Duplikate', async () => {
		await link('lichess', 'alice');
		const urls: string[] = [];
		const fetcher = (async (url: string) => {
			urls.push(url);
			return new Response(lichessLine('g1', 1000) + '\n' + lichessLine('g2', 2000) + '\n');
		}) as unknown as typeof fetch;

		expect(await syncNow(fetcher)).toBe(2);
		const rows = await db.games.toArray();
		expect(rows[0]).toMatchObject({
			myColor: 'white',
			myRating: 1234,
			oppRating: 1300,
			speed: 'blitz'
		});
		const acc = await getLinked();
		expect(acc.lastSync?.lichess).toBeGreaterThan(0);

		// zweiter Abruf: nur seit dem letzten Mal, Duplikate werden nicht doppelt gespeichert
		expect(await syncNow(fetcher)).toBe(0);
		expect(urls[1]).toContain('&since=');
		expect(await db.games.count()).toBe(2);
	});

	it('Chess.com: ältere Monate als der letzte Abruf werden nicht geladen', async () => {
		await link('chesscom', 'alice');
		const now = Date.UTC(2026, 10, 15);
		const acc = await getLinked();
		acc.lastSync = { chesscom: now };
		await db.settings.put({ key: 'linkedAccounts', value: acc });
		const urls: string[] = [];
		const fetcher = (async (url: string) => {
			urls.push(url);
			if (url.endsWith('/archives'))
				return Response.json({
					archives: [
						'https://api.chess.com/pub/player/alice/games/2026/09',
						'https://api.chess.com/pub/player/alice/games/2026/10',
						'https://api.chess.com/pub/player/alice/games/2026/11'
					]
				});
			return Response.json({
				games: [
					{
						url: 'x/1',
						pgn: PGN,
						end_time: now / 1000 + 60,
						rules: 'chess',
						time_class: 'rapid',
						white: { username: 'alice', rating: 900 },
						black: { username: 'bob', rating: 950 }
					},
					{
						url: 'x/2',
						pgn: PGN,
						end_time: now / 1000 - 60,
						rules: 'chess',
						white: { username: 'alice' },
						black: { username: 'bob' }
					}
				]
			});
		}) as unknown as typeof fetch;
		expect(await syncNow(fetcher)).toBe(1);
		expect(urls.some((u) => u.endsWith('/2026/10'))).toBe(false);
		await unlink('chesscom');
		expect((await getLinked()).chesscom).toBeUndefined();
	});
});
