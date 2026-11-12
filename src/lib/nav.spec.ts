import { describe, expect, it } from 'vitest';
import { isActive, navItems } from './nav';

describe('isActive', () => {
	it('Start ist nur auf / aktiv', () => {
		expect(isActive('/', '/')).toBe(true);
		expect(isActive('/', '/puzzles')).toBe(false);
	});

	it('Bereiche sind auch auf Unterseiten aktiv', () => {
		expect(isActive('/learn', '/learn/endgames')).toBe(true);
		expect(isActive('/learn', '/learnx')).toBe(false);
	});

	it('Einstellungen & Co. markieren den Profil-Tab', () => {
		expect(isActive('/profile', '/settings')).toBe(true);
		expect(isActive('/profile', '/import')).toBe(true);
		expect(isActive('/play', '/settings')).toBe(false);
	});

	it('hat sechs Tabs (Partien ist eigener Tab)', () => {
		expect(navItems).toHaveLength(6);
	});
});
