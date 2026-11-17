import { describe, expect, it } from 'vitest';
import { coachLevel } from './fading';

const now = 40 * 86_400_000;
const samples = [true, true, true, false].map((solved, index) => ({
	puzzleId: String(index),
	date: now - index,
	solved
}));

describe('Coach-Automatik', () => {
	it('reduziert Hilfe bei mindestens vier aktuellen unterschiedlichen Aufgaben und 75 % Erfolg', () => {
		expect(coachLevel('auto', samples.slice(0, 3), now)).toBe('warn');
		expect(coachLevel('auto', samples, now)).toBe('check');
	});
	it('ignoriert Wiederholungen und ältere Ergebnisse; bei schlechteren Entscheidungen kehren Warnungen zurück', () => {
		expect(coachLevel('auto', [...samples.slice(0, 3), samples[0]], now)).toBe('warn');
		expect(coachLevel('auto', samples, now + 31 * 86_400_000)).toBe('warn');
		expect(
			coachLevel('auto', [...samples, { puzzleId: '0', date: now + 1, solved: false }], now + 1)
		).toBe('warn');
	});
	it('die eigene Wahl gilt immer', () => {
		expect(coachLevel('warn', samples, now)).toBe('warn');
		expect(coachLevel('check', [], now)).toBe('check');
	});
});
