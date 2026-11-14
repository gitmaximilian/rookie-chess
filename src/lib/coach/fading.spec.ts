import { describe, expect, it } from 'vitest';
import { coachLevel, GUIDED_GAMES } from './fading';

describe('Hilfe ausschleichen', () => {
	it('automatisch: erst warnen, nach einigen Partien nur noch fragen', () => {
		expect(coachLevel('auto', 0)).toBe('warn');
		expect(coachLevel('auto', GUIDED_GAMES - 1)).toBe('warn');
		expect(coachLevel('auto', GUIDED_GAMES)).toBe('check');
	});
	it('eigene Wahl gilt immer', () => {
		expect(coachLevel('warn', 50)).toBe('warn');
		expect(coachLevel('check', 0)).toBe('check');
	});
});
