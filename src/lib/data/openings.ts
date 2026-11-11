/**
 * Eröffnungsnamen (Lichess chess-openings, CC0). Wird einmal geladen,
 * danach synchron nutzbar. Ohne Daten liefert `openingFor` null.
 */
import { i18n } from '#lib/i18n/i18n.svelte.js';
import { translateOpening } from './openingNamesDe.js';

export interface Opening {
	eco: string;
	name: string;
	/** Anzahl Halbzüge, die zur Eröffnung gehören */
	plies: number;
}

let table: Record<string, [string, string]> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadOpenings(fetcher: typeof fetch = fetch): Promise<void> {
	loading ??= fetcher('/openings.json')
		.then((r) => r.json())
		.then((t) => {
			table = t;
			for (const l of listeners) l();
		})
		.catch(() => {
			loading = null;
		});
	return loading;
}

/** Reagiert, sobald die Daten geladen sind */
export function onOpeningsLoaded(fn: () => void): () => void {
	if (table) fn();
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function setOpeningsForTest(t: Record<string, [string, string]>) {
	table = t;
}

/** Längste bekannte Eröffnung für die Zugfolge */
export function openingFor(ucis: string[]): Opening | null {
	if (!table) {
		if (typeof window !== 'undefined') loadOpenings();
		return null;
	}
	for (let n = Math.min(ucis.length, 40); n > 0; n--) {
		const hit = table[ucis.slice(0, n).join(' ')];
		if (hit) return { eco: hit[0], name: localName(hit[1]), plies: n };
	}
	return null;
}

/** Alle Eröffnungen, die mit dieser Zugfolge beginnen (für den Trainer) */
export function continuations(ucis: string[]): { uci: string; name: string }[] {
	if (!table) return [];
	const prefix = ucis.length ? ucis.join(' ') + ' ' : '';
	const named = new Map<string, string>();
	const weight = new Map<string, number>();
	for (const [k, [, name]] of Object.entries(table)) {
		if (prefix && !k.startsWith(prefix)) continue;
		const parts = k.split(' ');
		if (parts.length <= ucis.length) continue;
		const next = parts[ucis.length];
		// Gewicht = Anzahl bekannter Varianten über diesen Zug (Maß für Bedeutung)
		weight.set(next, (weight.get(next) ?? 0) + 1);
		if (
			parts.length === ucis.length + 1 &&
			(!named.has(next) || name.length < named.get(next)!.length)
		)
			named.set(next, name);
	}
	return [...weight.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([uci]) => ({ uci, name: localName(named.get(uci) ?? '') }));
}

function localName(name: string): string {
	return i18n.locale === 'de' ? translateOpening(name) : name;
}
