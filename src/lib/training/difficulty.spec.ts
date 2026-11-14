import { describe, expect, it } from 'vitest';
import {
	expectedScore,
	offsetFor,
	puzzleScore,
	puzzleTarget,
	targetOffset,
	TARGET_SUCCESS
} from './difficulty';
import { updateForPuzzle } from './glicko2';

describe('Schwierigkeit', () => {
	it('80 % Erfolg heißt ≈ 241 Punkte unter der eigenen Wertung', () => {
		expect(Math.round(offsetFor(0.8))).toBe(241);
		expect(expectedScore(1000, 1000 - offsetFor(TARGET_SUCCESS))).toBeCloseTo(0.8, 5);
	});

	it('ohne genug Daten: Grundabstand', () => {
		expect(targetOffset([true, false])).toBe(241);
		expect(puzzleTarget(900, [])).toBe(659);
	});

	it('regelt nach: viele Fehlversuche → leichter, fast alles gelöst → schwerer', () => {
		const bad = Array.from({ length: 20 }, (_, i) => i % 2 === 0); // 50 %
		const good = Array.from({ length: 20 }, (_, i) => i !== 0); // 95 %
		expect(targetOffset(bad)).toBeGreaterThan(targetOffset([]));
		expect(targetOffset(good)).toBeLessThan(targetOffset([]));
		// Grenzen
		expect(targetOffset(Array(20).fill(false))).toBe(450);
		expect(targetOffset(Array(20).fill(true))).toBe(121);
	});

	it('nie unter 400 (kleinste Puzzles)', () => {
		expect(puzzleTarget(500, [])).toBe(400);
	});

	it('Hinweis zählt halb; die Wertung steigt dann weniger', () => {
		expect(puzzleScore(true, false)).toBe(1);
		expect(puzzleScore(true, true)).toBe(0.5);
		expect(puzzleScore(false, true)).toBe(0);
		const p = { rating: 900, rd: 120, vol: 0.06 };
		const clean = updateForPuzzle(p, 700, 1).rating;
		const hinted = updateForPuzzle(p, 700, 0.5).rating;
		expect(hinted).toBeLessThan(clean);
		// ½ gegen ein viel leichteres Puzzle ist ein Verlust an Wertung
		expect(hinted).toBeLessThan(900);
	});
});
