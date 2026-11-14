import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { gameReport, percentileAt, typicalLevel } from './report';
import type { MoveReview } from './run';

const row: GameRow = {
	date: 1,
	pgn: '',
	moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5'],
	startFen: INITIAL_FEN,
	result: '1-0',
	myColor: 'white',
	opponent: 'Bot',
	source: 'bot'
};

const rv = (
	ply: number,
	judgement: MoveReview['judgement'],
	loss: number,
	motif?: string
): MoveReview => ({
	ply,
	mover: ply % 2 === 1 ? 'white' : 'black',
	judgement,
	kind: judgement === 'best' ? 'best' : judgement === 'good' ? 'good' : judgement,
	loss,
	explanation: motif
		? { title: '', text: '', motif: motif as NonNullable<MoveReview['explanation']>['motif'] }
		: null
});

describe('Partie-Bewertung', () => {
	it('typisches Niveau: monoton, mit Rändern', () => {
		expect(typicalLevel(70, 30)).toEqual({ elo: 500, edge: 'below' });
		expect(typicalLevel(90, 30)).toEqual({ elo: 2100, edge: 'above' });
		const a = typicalLevel(80, 30)!.elo;
		const b = typicalLevel(84, 30)!.elo;
		expect(b).toBeGreaterThan(a);
		expect(typicalLevel(80, 5)).toBeNull();
	});

	it('Perzentil gegenüber Gleichstarken', () => {
		// Mittel bei ≈ 1000 liegt um 79 %: genau dort ≈ 50 %
		expect(percentileAt(79.1, 1000)).toBe(50);
		expect(percentileAt(90, 1000)).toBeGreaterThanOrEqual(80);
		expect(percentileAt(65, 1000)).toBeLessThanOrEqual(10);
		// dieselbe Genauigkeit ist bei 2000 schwächer eingeordnet als bei 800
		expect(percentileAt(85, 2000)).toBeLessThan(percentileAt(85, 800));
	});

	it('Wendepunkt, verpasste Chance, Lernpunkt', () => {
		const reviews = [
			rv(1, 'best', 0),
			rv(2, 'good', 0.02),
			rv(3, 'best', 0),
			rv(4, 'blunder', 0.5, 'hanging'), // Gegner patzt
			rv(5, 'mistake', 0.25, 'hanging'), // ich nutze es nicht
			rv(6, 'good', 0.01),
			rv(7, 'blunder', 0.6, 'hanging'),
			rv(8, 'best', 0)
		];
		const r = gameReport(row, reviews);
		expect(r.turning).toMatchObject({ ply: 7, mover: 'white' });
		expect(r.missed).toMatchObject({ ply: 5 });
		expect(r.white.chances).toEqual({ taken: 0, total: 1 });
		expect(r.lesson).toEqual({ motif: 'hanging', n: 2 });
		expect(r.white.blunders).toBe(1);
		// zu wenige Züge für eine Einordnung
		expect(r.white.level).toBeNull();
	});
});
