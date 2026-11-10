/**
 * Eröffnungsnamen (Lichess chess-openings, CC0). Wird einmal geladen,
 * danach synchron nutzbar. Ohne Daten liefert `openingFor` null.
 */
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
		if (hit) return { eco: hit[0], name: hit[1], plies: n };
	}
	return null;
}

/** Alle Eröffnungen, die mit dieser Zugfolge beginnen (für den Trainer) */
export function continuations(ucis: string[]): { uci: string; name: string }[] {
	if (!table) return [];
	const prefix = ucis.join(' ');
	const seen = new Map<string, string>();
	for (const [k, [, name]] of Object.entries(table)) {
		const parts = k.split(' ');
		if (parts.length !== ucis.length + 1) continue;
		if (prefix && !k.startsWith(prefix + ' ')) continue;
		const next = parts[ucis.length];
		if (!seen.has(next) || name.length < seen.get(next)!.length) seen.set(next, name);
	}
	return [...seen].map(([uci, name]) => ({ uci, name }));
}
