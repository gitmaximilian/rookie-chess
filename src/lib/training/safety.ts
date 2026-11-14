/**
 * Blunder-Check: „Du willst diesen Zug spielen – ist er sicher?“
 *
 * Unter 1200 entscheiden eingestellte Figuren und übersehene Ein-/Zweizüger die meisten Partien
 * (docs/research-2026-11-13.md, Frage 4). Ein Puzzle trainiert, den Fehler des Gegners zu _nutzen_;
 * diese Übung trainiert die andere Hälfte: den eigenen Fehler _vor_ dem Ziehen zu erkennen.
 *
 * Die Stellungen stammen aus der Lichess-Puzzle-Datenbank (CC0): Jedes Lichess-Puzzle beginnt mit dem
 * Zug, mit dem ein Mensch in einer echten Partie gepatzt hat. Rookie zeigt die Stellung _davor_ und fragt,
 * ob der geplante Zug sicher ist. Zur Hälfte ist der gezeigte Zug der echte Patzer, zur Hälfte ein von
 * Stockfish geprüfter sicherer Zug (scripts/build-safety.mjs). Wer „nicht sicher“ sagt, muss die
 * Widerlegung selbst auf dem Brett zeigen – Raten allein reicht nicht.
 */
export interface SafetyItem {
	id: string;
	/** Stellung vor dem geplanten Zug; am Zug ist der Spieler */
	fen: string;
	/** geplanter Zug (UCI) */
	move: string;
	safe: boolean;
	/** bei unsicheren Zügen: die Widerlegung des Gegners (UCI) */
	reply?: string;
	/** Wertung des zugrunde liegenden Lichess-Puzzles */
	rating: number;
	/** Hauptmotiv der Widerlegung (Lichess-Thema), bei sicheren Zügen das des Originals */
	theme: string;
	/** Kontrolltest-Fassung A/B – solche Aufgaben kommen im Training nicht vor */
	form?: 'A' | 'B';
}

/** kompaktes Format in static/safety/items.json */
export type RawSafety = [string, string, string, 0 | 1, string, number, string, '' | 'A' | 'B'];

export function parseSafety(raw: RawSafety[]): SafetyItem[] {
	return raw.map(([id, fen, move, safe, reply, rating, theme, form]) => ({
		id,
		fen,
		move,
		safe: safe === 1,
		...(reply ? { reply } : {}),
		rating,
		theme,
		...(form ? { form } : {})
	}));
}

let cache: Promise<SafetyItem[]> | null = null;

export function loadSafety(fetcher: typeof fetch = fetch): Promise<SafetyItem[]> {
	cache ??= fetcher('/safety/items.json')
		.then((r) => {
			if (!r.ok) throw new Error('Blunder-Check-Aufgaben nicht gefunden');
			return r.json();
		})
		.then(parseSafety)
		.catch((e) => {
			cache = null;
			throw e;
		});
	return cache;
}

/**
 * Wählt eine Trainingsaufgabe nahe der Ziel-Wertung (Kontrolltest-Aufgaben ausgenommen).
 * Sichere und unsichere Züge wechseln zufällig (ca. 50:50) – wer immer „unsicher“ sagt, liegt oft falsch.
 */
export function pickSafety(
	items: SafetyItem[],
	target: number,
	exclude: Set<string>,
	rng: () => number = Math.random
): SafetyItem | null {
	const want = rng() < 0.5;
	const pool = items.filter((i) => !i.form && !exclude.has(i.id));
	if (!pool.length) return null;
	const same = pool.filter((i) => i.safe === want);
	const from = same.length ? same : pool;
	const near = [...from].sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
	const top = near.slice(0, Math.min(25, near.length));
	return top[Math.floor(rng() * top.length)];
}

/** Die feste Fassung des Kontrolltests (immer gleiche Reihenfolge) */
export function checkupItems(items: SafetyItem[], form: 'A' | 'B'): SafetyItem[] {
	return items.filter((i) => i.form === form).sort((a, b) => a.id.localeCompare(b.id));
}

export type SafetyAnswer = 'safe' | 'unsafe';

/**
 * Bewertung einer Antwort.
 * - sicherer Zug: richtig, wenn „sicher“ gesagt wurde
 * - unsicherer Zug: richtig erst, wenn „nicht sicher“ gesagt _und_ die Widerlegung gefunden wurde;
 *   „nicht sicher“ ohne Widerlegung zählt halb (die Gefahr gespürt, aber nicht gesehen)
 */
export function gradeSafety(
	item: SafetyItem,
	answer: SafetyAnswer,
	refuted: boolean | null
): { score: number; correct: boolean } {
	if (item.safe) return { score: answer === 'safe' ? 1 : 0, correct: answer === 'safe' };
	if (answer === 'safe') return { score: 0, correct: false };
	return refuted ? { score: 1, correct: true } : { score: 0.5, correct: false };
}

/** Ist ein gespielter Zug die gesuchte Widerlegung? (genau der Zug oder Umwandlung in eine Dame) */
export function isReply(item: SafetyItem, uci: string): boolean {
	if (!item.reply) return false;
	return uci === item.reply || (uci.length === 4 && item.reply.startsWith(uci));
}

// ───────── Kontrolltest ─────────

export interface CheckupResult {
	date: number;
	form: 'A' | 'B';
	/** Punkte (½ für „unsicher erkannt, aber Widerlegung nicht gefunden“) */
	score: number;
	total: number;
}

/** alle so viele Tage schlägt der Tagesplan einen Kontrolltest vor */
export const CHECKUP_EVERY_DAYS = 14;

export function nextForm(history: CheckupResult[]): 'A' | 'B' {
	return history.at(-1)?.form === 'A' ? 'B' : 'A';
}

export function checkupDue(history: CheckupResult[], now = Date.now()): boolean {
	const last = history.at(-1);
	return !last || now - last.date >= CHECKUP_EVERY_DAYS * 86_400_000;
}

/**
 * Vergleich mit dem ersten Test: ehrlich, mit Hinweis auf den Zufall.
 * Bei 12 Aufgaben liegt die Standardabweichung einer Trefferquote um 70 % bei ≈ 13 Prozentpunkten
 * (Binomial) – erst ein Unterschied von ≥ 2 Punkten (≈ 17 %) und mindestens 3 Tests sind mehr als Zufall.
 */
export function checkupTrend(
	history: CheckupResult[]
): { first: number; last: number; diff: number; meaningful: boolean } | null {
	if (history.length < 2) return null;
	const pct = (r: CheckupResult) => Math.round((r.score / r.total) * 100);
	const first = pct(history[0]);
	const last = pct(history.at(-1)!);
	const diffPts = history.at(-1)!.score - history[0].score;
	return {
		first,
		last,
		diff: last - first,
		meaningful: history.length >= 3 && Math.abs(diffPts) >= 2
	};
}
