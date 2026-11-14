import { describe, expect, it } from 'vitest';
import { scoreSelfReview, selfReviewRate } from './selfreview';

describe('Erst du: Selbstanalyse', () => {
	it('genaue Treffer, Nachbarzüge, übersehene und unnötige Markierungen', () => {
		// Fehler bei Halbzug 9 und 21; markiert: 9 (genau), 19 (eigener Zug davor), 31 (war ok)
		const s = scoreSelfReview([9, 19, 31], [9, 21]);
		expect(s.found).toEqual([9, 21]);
		expect(s.missed).toEqual([]);
		expect(s.extra).toEqual([31]);
		expect(s.total).toBe(2);
	});

	it('eine Markierung zählt nur für einen Fehler', () => {
		// 11 liegt neben 9 und 13 – darf nur einmal treffen
		const s = scoreSelfReview([11], [9, 13]);
		expect(s.found).toHaveLength(1);
		expect(s.missed).toHaveLength(1);
	});

	it('keine Fehler in der Partie: jede Markierung ist überflüssig', () => {
		expect(scoreSelfReview([5], [])).toEqual({ found: [], missed: [], extra: [5], total: 0 });
	});

	it('Quote erst ab 3 Partien mit Fehlern', () => {
		const r = (found: number, total: number) => ({ gameId: 1, date: 1, found, total, extra: 0 });
		expect(selfReviewRate([r(1, 2), r(0, 1)])).toBeNull();
		expect(selfReviewRate([r(1, 2), r(0, 1), r(2, 2), r(0, 0)])).toBe(60);
	});
});
