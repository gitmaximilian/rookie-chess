/**
 * „Erst du“: Selbstanalyse vor der Engine (Rookie-Lernmodell, Grundsatz 2 und 6).
 *
 * Nach der Partie markiert man zuerst selbst, wo man Fehler vermutet – erst dann zeigt Stockfish die
 * Auflösung. Selbst erklären (Bisra et al. 2018) und ein Abrufversuch vor der Lösung (Kornell et al. 2009)
 * verbessern das Lernen; für Schach ist das nicht eigens geprüft (Beleglage: Übertrag, mittel–schwach).
 * Nebenbei entsteht eine Kennzahl: Wie viele seiner Fehler sieht man selbst?
 */

/** höchstens so viele Markierungen – zwingt zum Abwägen statt alles anzukreuzen */
export const MAX_MARKS = 3;

export interface SelfReviewScore {
	/** markiert und tatsächlich (oder einen eigenen Zug daneben) ein Fehler */
	found: number[];
	/** Fehler, die man nicht markiert hat */
	missed: number[];
	/** markiert, war aber in Ordnung */
	extra: number[];
	total: number;
}

/**
 * Vergleicht die Markierungen mit den echten Fehlern (Halbzug-Nummern).
 * Ein Treffer zählt auch, wenn man den eigenen Zug davor oder danach markiert hat (±2 Halbzüge):
 * Man hat die kritische Stelle erkannt, nur den Zug um eins verschätzt.
 */
export function scoreSelfReview(marked: number[], mistakes: number[]): SelfReviewScore {
	const found: number[] = [];
	const used = new Set<number>();
	for (const m of [...mistakes].sort((a, b) => a - b)) {
		const hit = [m, m - 2, m + 2].find((p) => marked.includes(p) && !used.has(p));
		if (hit !== undefined) {
			used.add(hit);
			found.push(m);
		}
	}
	return {
		found,
		missed: mistakes.filter((m) => !found.includes(m)),
		extra: marked.filter((p) => !used.has(p)),
		total: mistakes.length
	};
}

export interface SelfReviewResult {
	gameId: number;
	date: number;
	found: number;
	total: number;
	extra: number;
}

/** Anteil selbst gefundener Fehler über die letzten Selbstanalysen (null bei < 3 Partien mit Fehlern) */
export function selfReviewRate(results: SelfReviewResult[], last = 10): number | null {
	const xs = results.filter((r) => r.total > 0).slice(-last);
	if (xs.length < 3) return null;
	const found = xs.reduce((s, r) => s + r.found, 0);
	const total = xs.reduce((s, r) => s + r.total, 0);
	return Math.round((found / total) * 100);
}
