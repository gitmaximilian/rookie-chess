import { en } from './en.js';
import { de } from './de.js';

export type Locale = 'en' | 'de';
export const LOCALES: { id: Locale; label: string }[] = [
	{ id: 'en', label: 'English' },
	{ id: 'de', label: 'Deutsch' }
];

type Params = Record<string, string | number>;
type Entry = string | ((p: Params) => string) | { [k: string]: Entry };

const DICTS: Record<Locale, Entry> = { en, de };
const STORAGE_KEY = 'rookie:lang';

function initial(): Locale {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === 'en' || v === 'de') return v;
	} catch {
		/* kein Storage */
	}
	return 'en';
}

// Vorgerendert wird immer Englisch; die gespeicherte Sprache wird nach dem Start gesetzt (init)
let current = $state<Locale>('en');

export const i18n = {
	get locale(): Locale {
		return current;
	},
	/** Nach dem Hydrieren aufrufen: gespeicherte Sprache übernehmen */
	init() {
		const l = initial();
		if (l !== current) current = l;
		if (typeof document !== 'undefined') document.documentElement.lang = l;
	},
	set(l: Locale) {
		current = l;
		try {
			localStorage.setItem(STORAGE_KEY, l);
		} catch {
			/* egal */
		}
		if (typeof document !== 'undefined') document.documentElement.lang = l;
	}
};

/** Nur für Tests */
export function setLocaleForTest(l: Locale) {
	current = l;
}

function lookup(dict: Entry, key: string): Entry | undefined {
	let node: Entry | undefined = dict;
	for (const part of key.split('.')) {
		if (!node || typeof node !== 'object') return undefined;
		node = (node as Record<string, Entry>)[part];
	}
	return node;
}

/** Übersetzt einen Schlüssel wie `play.start`; Parameter ersetzen `{name}` */
export function t(key: string, params: Params = {}): string {
	const v = lookup(DICTS[current], key) ?? lookup(DICTS.en, key);
	if (typeof v === 'function') return v(params);
	if (typeof v === 'string')
		return v.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`));
	return key;
}

/** Locale für Datums- und Zahlenformate */
export function intlLocale(): string {
	return current === 'de' ? 'de-AT' : 'en-GB';
}

/** Alle Blatt-Schlüssel eines Wörterbuchs (für Tests) */
export function keysOf(e: Entry, prefix = ''): string[] {
	if (typeof e !== 'object') return [prefix];
	return Object.entries(e).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

export { en, de };
