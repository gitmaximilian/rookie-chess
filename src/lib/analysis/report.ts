/**
 * Partie-Bewertung: Was sagt diese eine Partie aus? (Analyse-Seite, Karte „Partie-Bewertung“)
 *
 * - **Niveau** je Seite: Auf welchem Niveau wird so genau typischerweise gespielt, und wie gut war die
 *   Partie für jemanden dieser Stärke (Perzentil)? Geeicht an 1 440 echten Lichess-Rapid-Partien
 *   (400–2200) mit derselben Rechentiefe wie Rookie – siehe ACCURACY_BY_RATING.
 * - **Phasen**: Genauigkeit in Eröffnung, Mittelspiel, Endspiel (Phase nach Material, wie im Profil).
 * - **Wendepunkt**: der Zug mit dem größten Verlust an Gewinnchance.
 * - **Chancen**: Wie oft wurde ein Fehler des Gegners sofort bestraft?
 * - **Lernpunkt**: das häufigste konkrete Motiv der eigenen Fehler – mit passender Übung.
 * Reine Funktionen, testbar ohne Engine.
 */
import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { accuracy } from './classify.js';
import type { MoveReview } from './run.js';
import { phasesByMaterial, type Phase } from '#lib/training/gamestats.js';

/**
 * Genauigkeit je Wertungsband – 2 433 Spieler-Partien aus 1 440 Lichess-Rapid-Partien (Oktober 2026),
 * Stockfish Tiefe 11 wie Rookie am Handy (scripts/research/performance-study.mjs).
 * r = Bandmitte, median/mean/sd der Genauigkeit einer Partie.
 *
 * Befund: Innerhalb eines Bands streut die Genauigkeit einer Partie um ±7–14 Punkte, die Mittel
 * liegen von 400 bis 2200 nur ~12 Punkte auseinander (Regression: R² = 0,14, Reststreuung ±465 Elo).
 * Eine „gespielte Elo“ aus einer einzelnen Partie wäre also weitgehend Zufall. Rookie zeigt deshalb
 * (1) das Niveau, auf dem so genau _typischerweise_ gespielt wird, und (2) wie die Partie im Vergleich zu
 * Gleichstarken einzuordnen ist (Perzentil) – das ist für eine Partie aussagekräftig.
 */
export const ACCURACY_BY_RATING = [
	{ r: 500, median: 76.7, mean: 74.4, sd: 14.5 },
	{ r: 700, median: 76.7, mean: 74.8, sd: 13.1 },
	{ r: 900, median: 79.0, mean: 78.0, sd: 10.6 },
	{ r: 1100, median: 81.3, mean: 80.2, sd: 9.8 },
	{ r: 1300, median: 81.5, mean: 81.1, sd: 8.6 },
	{ r: 1500, median: 82.1, mean: 82.2, sd: 7.2 },
	{ r: 1700, median: 84.3, mean: 83.4, sd: 6.8 },
	{ r: 1900, median: 85.7, mean: 84.7, sd: 6.8 },
	{ r: 2100, median: 87.1, mean: 86.3, sd: 6.3 }
] as const;

/** Partien mit weniger eigenen Zügen sagen fast nichts */
export const MIN_MOVES = 10;

export interface Level {
	/** Wertung, bei der diese Genauigkeit der Median ist (gerundet auf 50) */
	elo: number;
	/** unter dem kleinsten bzw. über dem größten Band der Eichung */
	edge: 'below' | 'above' | null;
}

/** Auf welchem Niveau wird typischerweise (Median) so genau gespielt? */
export function typicalLevel(acc: number, moves: number): Level | null {
	if (moves < MIN_MOVES) return null;
	const t = ACCURACY_BY_RATING;
	if (acc <= t[0].median) return { elo: t[0].r, edge: 'below' };
	if (acc >= t[t.length - 1].median) return { elo: t[t.length - 1].r, edge: 'above' };
	for (let i = 1; i < t.length; i++) {
		if (acc <= t[i].median && t[i].median > t[i - 1].median) {
			const f = (acc - t[i - 1].median) / (t[i].median - t[i - 1].median);
			return { elo: Math.round((t[i - 1].r + f * (t[i].r - t[i - 1].r)) / 50) * 50, edge: null };
		}
	}
	return { elo: t[t.length - 1].r, edge: 'above' };
}

/** Mittel und Streuung der Genauigkeit bei einer Wertung (linear zwischen den Bändern) */
function bandAt(rating: number): { mean: number; sd: number } {
	const t = ACCURACY_BY_RATING;
	if (rating <= t[0].r) return t[0];
	if (rating >= t[t.length - 1].r) return t[t.length - 1];
	const i = t.findIndex((x) => x.r >= rating);
	const f = (rating - t[i - 1].r) / (t[i].r - t[i - 1].r);
	return {
		mean: t[i - 1].mean + f * (t[i].mean - t[i - 1].mean),
		sd: t[i - 1].sd + f * (t[i].sd - t[i - 1].sd)
	};
}

/** Standardnormalverteilung (Abramowitz & Stegun 7.1.26) */
function phi(z: number): number {
	const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
	const y =
		1 -
		((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
			t *
			Math.exp(-(z * z) / 2);
	return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * Wie gut war diese Partie für jemanden dieser Stärke? Anteil der Partien von Gleichstarken,
 * die weniger genau waren (0–100, gerundet auf 5).
 */
export function percentileAt(acc: number, rating: number): number {
	const b = bandAt(rating);
	return Math.round((phi((acc - b.mean) / b.sd) * 100) / 5) * 5;
}

export interface SideReport {
	accuracy: number;
	moves: number;
	blunders: number;
	mistakes: number;
	/** typisches Niveau für diese Genauigkeit (null bei zu kurzer Partie) */
	level: Level | null;
	/** Genauigkeit je Phase (null = zu wenige Züge in der Phase) */
	phases: Record<Phase, number | null>;
	/** Fehler des Gegners und wie oft sofort bestraft */
	chances: { taken: number; total: number };
}

export interface GameReport {
	white: SideReport;
	black: SideReport;
	/** größter Verlust an Gewinnchance in der Partie */
	turning: { ply: number; mover: 'white' | 'black'; loss: number } | null;
	/** größte verpasste Chance des Spielers (Fehler des Gegners nicht bestraft) */
	missed: { ply: number; loss: number } | null;
	/** häufigstes konkretes Motiv der eigenen Fehler */
	lesson: { motif: NonNullable<MoveReview['explanation']>['motif']; n: number } | null;
}

/** so viele Züge braucht eine Phase für eine eigene Genauigkeit */
const PHASE_MIN = 6;

export function gameReport(row: GameRow, reviews: MoveReview[]): GameReport {
	let phases: Phase[] | null = null;
	try {
		const g = Game.fromUciMoves(row.moves, row.startFen);
		phases = phasesByMaterial(Array.from({ length: g.ply + 1 }, (_, i) => g.fenAt(i)));
	} catch {
		/* ungültige Zugfolge: ohne Phasen */
	}
	const byPly = new Map(reviews.map((r) => [r.ply, r]));
	const side = (c: 'white' | 'black'): SideReport => {
		const rs = reviews.filter((r) => r.mover === c);
		const acc = accuracy(rs.map((r) => r.loss));
		const blunders = rs.filter((r) => r.judgement === 'blunder').length;
		const ph: Record<Phase, number | null> = { opening: null, middlegame: null, endgame: null };
		if (phases)
			for (const p of ['opening', 'middlegame', 'endgame'] as const) {
				const xs = rs.filter((r) => phases![r.ply - 1] === p);
				ph[p] = xs.length >= PHASE_MIN ? accuracy(xs.map((r) => r.loss)) : null;
			}
		const chances = { taken: 0, total: 0 };
		for (const r of reviews) {
			if (r.mover === c || (r.judgement !== 'mistake' && r.judgement !== 'blunder')) continue;
			const reply = byPly.get(r.ply + 1);
			if (!reply) continue;
			chances.total++;
			if (reply.loss < 0.1) chances.taken++;
		}
		return {
			accuracy: acc,
			moves: rs.length,
			blunders,
			mistakes: rs.filter((r) => r.judgement === 'mistake').length,
			level: typicalLevel(acc, rs.length),
			phases: ph,
			chances
		};
	};

	const worst = [...reviews].sort((a, b) => b.loss - a.loss)[0];
	const turning =
		worst && worst.loss >= 0.3 ? { ply: worst.ply, mover: worst.mover, loss: worst.loss } : null;

	let missed: GameReport['missed'] = null;
	for (const r of reviews) {
		if (r.mover === row.myColor || (r.judgement !== 'mistake' && r.judgement !== 'blunder'))
			continue;
		const reply = byPly.get(r.ply + 1);
		if (reply && reply.loss >= 0.2 && (!missed || reply.loss > missed.loss))
			missed = { ply: reply.ply, loss: reply.loss };
	}

	const counts = new Map<string, number>();
	for (const r of reviews)
		if (
			r.mover === row.myColor &&
			r.explanation &&
			r.explanation.motif !== 'positional' &&
			(r.judgement === 'blunder' || r.judgement === 'mistake')
		)
			counts.set(r.explanation.motif, (counts.get(r.explanation.motif) ?? 0) + 1);
	const top = [...counts].sort((a, b) => b[1] - a[1])[0];

	return {
		white: side('white'),
		black: side('black'),
		turning,
		missed,
		lesson: top ? { motif: top[0] as NonNullable<GameReport['lesson']>['motif'], n: top[1] } : null
	};
}
