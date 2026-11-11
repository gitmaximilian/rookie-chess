import { describe, expect, it } from 'vitest';
import {
	parseLichessNdjson,
	parseChessComMonth,
	toGameRow,
	fetchChessCom,
	fetchLichess,
	ImportError
} from './importers';

const PGN = `[Event "Rated Blitz game"]
[White "alice"]
[Black "Bob"]
[Result "0-1"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 g6 4. Qf3 Nf6 0-1`;

const ndjson =
	JSON.stringify({
		id: 'abc123',
		variant: 'standard',
		createdAt: 1700000000000,
		players: { white: { user: { name: 'alice' } }, black: { user: { name: 'Bob' } } },
		pgn: PGN
	}) +
	'\n' +
	JSON.stringify({ id: 'zz', variant: 'chess960', pgn: PGN }) +
	'\n';

const month = {
	games: [
		{
			url: 'https://chess.com/g/1',
			pgn: PGN,
			end_time: 1700000000,
			rules: 'chess',
			white: { username: 'alice' },
			black: { username: 'Bob' }
		},
		{
			url: 'https://chess.com/g/2',
			pgn: PGN,
			end_time: 1700000100,
			rules: 'bughouse',
			white: { username: 'x' },
			black: { username: 'y' }
		}
	]
};

describe('Import', () => {
	it('liest Lichess-NDJSON, ignoriert Varianten', () => {
		const g = parseLichessNdjson(ndjson);
		expect(g).toHaveLength(1);
		expect(g[0]).toMatchObject({ externalId: 'lichess:abc123', white: 'alice', result: '0-1' });
	});

	it('liest Chess.com-Monat, nur Standardschach', () => {
		const g = parseChessComMonth(month);
		expect(g).toHaveLength(1);
		expect(g[0].date).toBe(1700000000000);
	});

	it('erkennt meine Farbe (Groß-/Kleinschreibung egal)', () => {
		const row = toGameRow(parseLichessNdjson(ndjson)[0], 'bob')!;
		expect(row.myColor).toBe('black');
		expect(row.opponent).toBe('alice');
		expect(row.moves.slice(0, 2)).toEqual(['e2e4', 'e7e5']);
	});

	it('Chess.com: neueste Archive zuerst, Limit', async () => {
		const fake = (async (url: string) => {
			if (url.endsWith('/archives'))
				return new Response(JSON.stringify({ archives: ['a/2026/10', 'a/2026/11'] }));
			return new Response(JSON.stringify(month));
		}) as unknown as typeof fetch;
		const g = await fetchChessCom('Bob', 1, fake);
		expect(g).toHaveLength(1);
	});

	it('unbekannter Benutzer → notFound', async () => {
		const fake = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
		await expect(fetchLichess('nobody', 5, fake)).rejects.toMatchObject({ code: 'notFound' });
		await expect(fetchChessCom('nobody', 5, fake)).rejects.toBeInstanceOf(ImportError);
	});
});
