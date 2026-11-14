/**
 * Wirkt das Training? Ehrliche Fortschrittsmessung (Rookie-Lernmodell, Grundsatz 7).
 *
 * Hauptkennzahl: **Patzer je 30 eigene Züge** – sie misst genau die Fähigkeit mit dem größten Hebel
 * unter 1200 und hängt nicht von der Partielänge ab. Sie schwankt aber von Partie zu Partie stark
 * (Lichess-Daten: Standardabweichung ≈ so groß wie der Mittelwert, docs/research-2026-11-13.md).
 * Deshalb:
 * - Vergleich erst ab je MIN_WINDOW Partien in zwei Zeiträumen (jüngste vs. davor),
 * - ein Unterschied gilt erst als echt, wenn er größer ist als der 95-%-Zufallsbereich (Welch).
 * Reine Funktionen – testbar ohne Datenbank.
 */
import type { GameRow } from '#lib/db/db.js';
import type { PlyEval } from '#lib/analysis/classify.js';
import { reviewMoves } from '#lib/analysis/run.js';

export interface GameBlunders {
	date: number;
	/** Patzer je 30 eigene Züge in dieser Partie */
	per30: number;
	ownMoves: number;
}

/** Partien mit weniger eigenen Zügen sagen zu wenig */
export const MIN_OWN_MOVES = 10;
/** Partien je Zeitraum für einen Vergleich */
export const MIN_WINDOW = 10;

/** Patzer je 30 eigene Züge für jede fertig analysierte Partie, älteste zuerst */
export function blunderSeries(games: GameRow[]): GameBlunders[] {
	const out: GameBlunders[] = [];
	for (const g of [...games].sort((a, b) => a.date - b.date)) {
		if (!g.analysis?.done) continue;
		let reviews;
		try {
			reviews = reviewMoves(g, g.analysis.evals as PlyEval[]).filter((r) => r.mover === g.myColor);
		} catch {
			continue;
		}
		if (reviews.length < MIN_OWN_MOVES) continue;
		const blunders = reviews.filter((r) => r.judgement === 'blunder').length;
		out.push({ date: g.date, per30: (blunders / reviews.length) * 30, ownMoves: reviews.length });
	}
	return out;
}

export interface Trend {
	/** Mittel der jüngsten Partien (null = noch keine) */
	recent: number | null;
	recentN: number;
	/** Mittel der Partien davor (null = noch zu wenige für einen Vergleich) */
	previous: number | null;
	previousN: number;
	/** recent − previous (negativ = weniger Patzer = besser) */
	diff: number | null;
	/** halbe Breite des 95-%-Zufallsbereichs für diff */
	margin: number | null;
	/** besser, schlechter oder (noch) nicht zu unterscheiden */
	verdict: 'better' | 'worse' | 'same' | 'unknown';
	/** so viele Partien fehlen noch bis zum ersten Vergleich */
	missing: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[]) => {
	if (xs.length < 2) return 0;
	const m = mean(xs);
	return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
};
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Jüngste `window` Partien gegen die `window` davor.
 * Ein Unterschied zählt nur, wenn er den 95-%-Bereich (1,96 · Standardfehler nach Welch) überschreitet.
 */
export function blunderTrend(series: GameBlunders[], window = MIN_WINDOW): Trend {
	const recent = series.slice(-window);
	const previous = series.slice(-2 * window, -window);
	const base = {
		recent: recent.length ? r1(mean(recent.map((x) => x.per30))) : null,
		recentN: recent.length,
		previousN: previous.length
	};
	if (recent.length < window || previous.length < window)
		return {
			...base,
			previous: null,
			diff: null,
			margin: null,
			verdict: 'unknown',
			missing: Math.max(0, 2 * window - series.length)
		};
	const a = recent.map((x) => x.per30);
	const b = previous.map((x) => x.per30);
	const diff = mean(a) - mean(b);
	const margin = 1.96 * Math.sqrt(variance(a) / a.length + variance(b) / b.length);
	return {
		...base,
		previous: r1(mean(b)),
		diff: r1(diff),
		margin: r1(margin),
		verdict: Math.abs(diff) <= margin ? 'same' : diff < 0 ? 'better' : 'worse',
		missing: 0
	};
}

/** Trefferquote der jüngsten Versuche (null bei zu wenigen) */
export function successRate(results: boolean[], min = 10): number | null {
	if (results.length < min) return null;
	return Math.round((results.filter(Boolean).length / results.length) * 100);
}
