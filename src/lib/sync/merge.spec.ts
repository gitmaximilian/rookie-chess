import { describe, expect, it } from 'vitest';
import { mergeSnapshots, TOMBSTONE_KEY } from './merge';

const game = (p: object) => ({
	date: 1,
	pgn: '',
	moves: ['e2e4'],
	startFen: '',
	result: '1-0',
	myColor: 'white',
	opponent: 'Tina',
	source: 'bot',
	...p
});

describe('Abgleich zwischen Geräten', () => {
	it('vereinigt Partien, Versuche und Wertungen ohne Duplikate', () => {
		const iphone = {
			games: [game({ id: 1, date: 10 }), game({ id: 2, date: 20 })],
			puzzleAttempts: [{ id: 1, puzzleId: 'a', date: 1, solved: true }],
			ratings: [{ id: 1, area: 'puzzle', date: 1, rating: 900 }]
		};
		const mac = {
			games: [game({ date: 20 }), game({ date: 30 })],
			puzzleAttempts: [
				{ puzzleId: 'a', date: 1, solved: true },
				{ puzzleId: 'b', date: 2, solved: false }
			],
			ratings: [{ area: 'puzzle', date: 2, rating: 910 }]
		};
		const m = mergeSnapshots(iphone, mac);
		expect(m.games.map((g) => (g as { date: number }).date).sort()).toEqual([10, 20, 30]);
		expect(m.games.every((g) => !('id' in (g as object)))).toBe(true);
		expect(m.puzzleAttempts).toHaveLength(2);
		expect(m.ratings).toHaveLength(2);
	});

	it('synchronisiert keine importierten Online-Partien (Namen Dritter)', () => {
		const m = mergeSnapshots({ games: [game({ source: 'lichess', externalId: 'lichess:x' })] }, {});
		expect(m.games).toHaveLength(0);
	});

	it('Einstellungen: neuere gewinnt; nur-lokale bleiben draußen', () => {
		const m = mergeSnapshots(
			{
				settings: [
					{ key: 'dailyGoal', value: 10, t: 5 },
					{ key: 'lastBackupAt', value: 1, t: 9 }
				]
			},
			{ settings: [{ key: 'dailyGoal', value: 3, t: 7 }] }
		);
		const s = m.settings as { key: string; value: unknown }[];
		expect(s.find((x) => x.key === 'dailyGoal')?.value).toBe(3);
		expect(s.some((x) => x.key === 'lastBackupAt')).toBe(false);
	});

	it('Wiederholungskarten: zuletzt geübte Fassung gewinnt', () => {
		const card = (last: string, reps: number) => ({
			id: 'puzzle:a',
			kind: 'puzzle',
			due: 1,
			card: { last_review: last, reps }
		});
		const m = mergeSnapshots(
			{ reviewCards: [card('2026-11-10T10:00:00Z', 3)] },
			{ reviewCards: [card('2026-11-11T10:00:00Z', 4)] }
		);
		expect((m.reviewCards[0] as { card: { reps: number } }).card.reps).toBe(4);
	});

	it('Endspiele: beste Sterne; Aktivität: Maximum pro Tag', () => {
		const m = mergeSnapshots(
			{
				endgames: [{ id: 'kqk', stars: 3, bestMoves: 12, date: 1 }],
				activity: [{ day: '2026-11-11', puzzles: 5, games: 0, reviews: 2 }]
			},
			{
				endgames: [{ id: 'kqk', stars: 2, bestMoves: 9, date: 2 }],
				activity: [{ day: '2026-11-11', puzzles: 3, games: 1, reviews: 2 }]
			}
		);
		expect(m.endgames[0]).toMatchObject({ stars: 3, bestMoves: 9 });
		expect(m.activity[0]).toMatchObject({ puzzles: 5, games: 1, reviews: 2 });
	});

	it('Löschmarken: auf einem Gerät gelöscht → verschwindet überall', () => {
		const local = {
			settings: [
				{ key: TOMBSTONE_KEY, value: { games: { 'bot:20': 5 }, repertoire: { n1: 5 } }, t: 5 }
			],
			games: [game({ date: 10 })],
			repertoire: []
		};
		const remote = {
			games: [game({ date: 10 }), game({ date: 20 })],
			repertoire: [{ id: 'n1' }, { id: 'n2' }]
		};
		const m = mergeSnapshots(local, remote);
		expect(m.games.map((g) => (g as { date: number }).date)).toEqual([10]);
		expect(m.repertoire.map((n) => (n as { id: string }).id)).toEqual(['n2']);
	});

	it('stabil: zweimal zusammenführen ändert nichts mehr', () => {
		const a = { settings: [{ key: 'x', value: 1, t: 1 }], games: [game({ date: 1 })] };
		const once = mergeSnapshots(a, {});
		expect(JSON.stringify(mergeSnapshots(once, once))).toBe(JSON.stringify(once));
	});

	it('neue Lerndaten: Blunder-Check-Versuche, Kontrolltests und safety-Karten gehen nicht verloren', () => {
		const card = (due: number, reps: number) => ({
			id: 'safety:abc',
			kind: 'safety',
			due,
			card: { due: new Date(due), reps, last_review: new Date(due - 1000) },
			data: { id: 'abc' }
		});
		const iphone = {
			puzzleAttempts: [
				{ puzzleId: 'abc', date: 5, solved: false, source: 'safety', themes: ['fork'] }
			],
			reviewCards: [card(1000, 1)],
			settings: [
				{ key: 'checkups', value: [{ date: 1, form: 'A', score: 7, total: 12 }], t: 1 },
				{ key: 'coachedGames', value: 4, t: 3 }
			]
		};
		const mac = {
			puzzleAttempts: [{ puzzleId: 'xyz', date: 6, solved: true, source: 'checkup', themes: [] }],
			reviewCards: [card(5000, 2)],
			settings: [
				{
					key: 'checkups',
					value: [
						{ date: 1, form: 'A', score: 7, total: 12 },
						{ date: 9, form: 'B', score: 9, total: 12 }
					],
					t: 9
				}
			]
		};
		const m = mergeSnapshots(iphone, mac);
		expect(m.puzzleAttempts).toHaveLength(2);
		expect(m.reviewCards).toHaveLength(1);
		const settings = m.settings as { key: string; value: unknown }[];
		expect((settings.find((x) => x.key === 'checkups')?.value as unknown[]).length).toBe(2);
		expect(settings.find((x) => x.key === 'coachedGames')?.value).toBe(4);
	});
});
