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

	it('Coach-Tab gilt auch für die Statistik', () => {
		expect(isActive('/coach', '/coach/stats')).toBe(true);
		expect(navItems.some((n) => n.href === '/profile')).toBe(false);
	});

	it('hat sechs Tabs (Coach statt Profil)', () => {
		expect(navItems).toHaveLength(6);
	});
});
