import { describe, expect, it } from 'vitest';
import { en, de, keysOf, t, setLocaleForTest } from './i18n.svelte';

describe('i18n', () => {
	it('Deutsch hat genau dieselben Schlüssel wie Englisch', () => {
		expect(keysOf(de).sort()).toEqual(keysOf(en).sort());
	});

	it('Standard ist Englisch, Parameter werden eingesetzt', () => {
		setLocaleForTest('en');
		expect(t('nav.play')).toBe('Play');
		expect(t('home.goalLeft', { n: 1 })).toBe('1 more puzzle to reach your goal.');
		setLocaleForTest('de');
		expect(t('nav.play')).toBe('Spielen');
		expect(t('home.goalLeft', { n: 3 })).toBe('Noch 3 Puzzles bis zum Ziel.');
		setLocaleForTest('en');
	});

	it('unbekannte Schlüssel fallen auf den Schlüssel zurück', () => {
		expect(t('gibt.es.nicht')).toBe('gibt.es.nicht');
	});
});
