import { describe, expect, it } from 'vitest';
import {
	checkupDue,
	checkupItems,
	checkupTrend,
	gradeSafety,
	isReply,
	nextForm,
	parseSafety,
	pickSafety,
	CHECKUP_EVERY_DAYS,
	type RawSafety
} from './safety';

const RAW: RawSafety[] = [
	['a1', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1a2', 1, '', 700, 'hangingPiece', ''],
	['a2', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1b1', 0, 'h1g1', 720, 'fork', ''],
	['a3', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1b2', 0, 'e7e8q', 1100, 'mateIn1', ''],
	['t1', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1a2', 1, '', 800, 'pin', 'A'],
	['t2', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1b1', 0, 'h1g1', 900, 'fork', 'B']
];

describe('Blunder-Check', () => {
	const items = parseSafety(RAW);

	it('liest das kompakte Format', () => {
		expect(items[0]).toMatchObject({ id: 'a1', safe: true, rating: 700 });
		expect(items[0].reply).toBeUndefined();
		expect(items[1]).toMatchObject({ safe: false, reply: 'h1g1', theme: 'fork' });
		expect(items[3].form).toBe('A');
	});

	it('Auswahl: nah an der Ziel-Wertung, nie Kontrolltest-Aufgaben, nichts doppelt', () => {
		const rng = () => 0.1; // „unsicher“ gewünscht (0.1 < 0.5 → safe), erstes Element
		const p = pickSafety(items, 700, new Set(), rng);
		expect(p?.id).toBe('a1');
		const q = pickSafety(items, 1100, new Set(['a1']), () => 0.9);
		expect(q?.safe).toBe(false);
		expect(q?.form).toBeUndefined();
		expect(pickSafety(items, 700, new Set(['a1', 'a2', 'a3']))).toBeNull();
	});

	it('Bewertung: „nicht sicher“ zählt erst mit gefundener Widerlegung voll', () => {
		const safe = items[0];
		const unsafe = items[1];
		expect(gradeSafety(safe, 'safe', null)).toEqual({ score: 1, correct: true });
		expect(gradeSafety(safe, 'unsafe', null)).toEqual({ score: 0, correct: false });
		expect(gradeSafety(unsafe, 'safe', null)).toEqual({ score: 0, correct: false });
		expect(gradeSafety(unsafe, 'unsafe', true)).toEqual({ score: 1, correct: true });
		expect(gradeSafety(unsafe, 'unsafe', false)).toEqual({ score: 0.5, correct: false });
	});

	it('Widerlegung: genauer Zug oder Umwandlung ohne Figurenangabe', () => {
		expect(isReply(items[1], 'h1g1')).toBe(true);
		expect(isReply(items[1], 'h1h2')).toBe(false);
		expect(isReply(items[2], 'e7e8')).toBe(true);
	});

	it('Kontrolltest: feste Fassungen im Wechsel, alle 14 Tage', () => {
		expect(checkupItems(items, 'A').map((i) => i.id)).toEqual(['t1']);
		expect(nextForm([])).toBe('A');
		const day = 86_400_000;
		const h = [{ date: 0, form: 'A' as const, score: 7, total: 12 }];
		expect(nextForm(h)).toBe('B');
		expect(checkupDue([], 0)).toBe(true);
		expect(checkupDue(h, (CHECKUP_EVERY_DAYS - 1) * day)).toBe(false);
		expect(checkupDue(h, CHECKUP_EVERY_DAYS * day)).toBe(true);
	});

	it('Verlauf: erst ab 3 Tests und 2 Punkten Unterschied „echt“', () => {
		const r = (score: number) => ({ date: 0, form: 'A' as const, score, total: 12 });
		expect(checkupTrend([r(6)])).toBeNull();
		expect(checkupTrend([r(6), r(9)])?.meaningful).toBe(false);
		expect(checkupTrend([r(6), r(7), r(9)])).toMatchObject({
			first: 50,
			last: 75,
			meaningful: true
		});
		expect(checkupTrend([r(6), r(7), r(7)])?.meaningful).toBe(false);
	});
});
