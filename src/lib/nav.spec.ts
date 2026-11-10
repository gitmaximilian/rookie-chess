import { describe, expect, it } from 'vitest';
import { isActive, navItems } from './nav';

describe('isActive', () => {
	it('Start ist nur auf / aktiv', () => {
		expect(isActive('/', '/')).toBe(true);
		expect(isActive('/', '/puzzles')).toBe(false);
	});

	it('Bereiche sind auch auf Unterseiten aktiv', () => {
		expect(isActive('/lernen', '/lernen/endspiele')).toBe(true);
		expect(isActive('/lernen', '/lernenx')).toBe(false);
	});

	it('hat genau fünf Tabs fürs iPhone', () => {
		expect(navItems).toHaveLength(5);
	});
});
