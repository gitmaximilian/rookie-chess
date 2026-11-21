import type { GameRow } from '#lib/db/db.js';
import { isTargetGameOn, quality, ratingAfter, targetSource } from '#lib/import/ratings.js';
import { toChessCom } from './platforms.js';
import { gameSafety } from './blunders.js';
import { outcomeOf } from './gamestats.js';
import {
	gameSkillStats,
	overallLevel,
	poolSkills,
	skillMirror,
	type GameSkillStats
} from './skills.js';

export const COACH_PERIODS = [7, 30, 365, 'all'] as const;
export type CoachPeriod = (typeof COACH_PERIODS)[number];
const DAY = 86_400_000;

/**
 * Spielniveau: die Elo-Entsprechung des Skill-Pentas (Gesamtniveau, Rapid-Eichung) aus den letzten
 * LEVEL_WINDOW analysierten Partien – auf derselben Skala wie die Lichess-Wertung.
 *
 * Ersetzt seit 0.9.0 den „Trainingsindex“ (0,6 × Sicherheit + 0,4 × Genauigkeit, 0–100): Der bewegte sich von
 * 900 bis 1700 nur um ~11 Punkte bei ±4 Punkten Zufall je 10 Partien, und seine Zahl war für sich nicht deutbar.
 * Das Gesamtniveau traf im Holdout an 154 echten Spielern die Wertung am besten (r 0,86, ±226 Elo ab ~12
 * Partien; Sicherheit allein r 0,83, Genauigkeit allein R² 0,14) – docs/research-2026-11-13.md.
 */
export interface CoachIndex {
	/** Spielniveau (Elo-Entsprechung, auf 25 gerundet) */
	value: number;
	accuracy: number;
	blundersPer30: number;
	analysed: number;
	moves: number;
}

export interface CoachHistoryPoint {
	date: number;
	rating: number;
	index: CoachIndex | null;
	outcome: 'w' | 'd' | 'l' | null;
	analysed: boolean;
	conversion: number | null;
	/** Lichess stuft neue Konten noch ein (große Sprünge je Partie) – zählt nicht für Verlauf und Veränderung */
	provisional?: boolean;
}

/** so viele jüngste analysierte Partien fließen in einen Punkt */
export const LEVEL_WINDOW = 15;
/** erst ab so vielen Partien ein Wert (Holdout: ab ~12 Partien ±230 Elo) */
export const LEVEL_MIN = 10;

export interface AnalysedGame {
	stats: GameSkillStats;
	accuracy: number;
}

export function playingLevel(window: AnalysedGame[]): CoachIndex | null {
	if (window.length < LEVEL_MIN) return null;
	const raw = poolSkills(window.map((w) => w.stats));
	const level = overallLevel(skillMirror(raw));
	if (!level) return null;
	return {
		value: level.elo,
		accuracy: window.reduce((sum, w) => sum + w.accuracy, 0) / window.length,
		blundersPer30: raw.safety.value ?? 0,
		analysed: window.length,
		moves: raw.safety.n
	};
}

/**
 * Verlauf auf einer Plattform (Standard: Lichess, sonst Chess.com – `targetSource`). Auf Chess.com steht das
 * Spielniveau umgerechnet auf der Chess.com-Skala (platforms.ts), damit beide Linien eine Achse teilen.
 */
export function coachHistory(
	games: GameRow[],
	source: 'lichess' | 'chesscom' = targetSource(games)
): CoachHistoryPoint[] {
	const window: AnalysedGame[] = [];
	const history: CoachHistoryPoint[] = [];
	const target = games.filter((g) => isTargetGameOn(g, source)).sort((a, b) => a.date - b.date);
	for (const game of target) {
		const rating = ratingAfter(game);
		if (rating === null || !Number.isFinite(rating) || !Number.isFinite(game.date)) continue;
		const outcome = outcomeOf(game);
		let index: CoachIndex | null = null;
		let analysed = false;
		let conversion: number | null = null;
		if (game.analysis?.done && game.analysis.evals.length === game.moves.length + 1) {
			const safety = gameSafety(game);
			const fit = safety ? quality(game) : null;
			const stats = fit ? gameSkillStats(game) : null;
			if (safety && fit && stats && safety.live > 0) {
				analysed = true;
				window.push({ stats, accuracy: fit.accuracy });
				if (window.length > LEVEL_WINDOW) window.shift();
				index = playingLevel(window);
				if (index && source === 'chesscom') index = { ...index, value: toChessCom(index.value) };
				if (safety.wonAt !== null) conversion = outcome === 'w' ? 1 : outcome === 'd' ? 0.5 : 0;
			}
		}
		history.push({ date: game.date, rating, index, outcome, analysed, conversion });
	}
	const settled = settledFrom(history.map((p) => p.rating));
	history.forEach((p, i) => (p.provisional = i < settled));
	return history;
}

/** so viel darf sich die Wertung je Partie höchstens ändern, damit sie als eingestuft gilt */
export const SETTLED_STEP = 40;

/**
 * Erste Partie, ab der die Wertung eingestuft ist: Die nächsten drei Partien bewegen sie jeweils um höchstens
 * SETTLED_STEP. Neue Lichess-Konten beginnen bei 1500 und springen anfangs um 100 und mehr je Partie – diese
 * Einstufung ist kein Fortschritt und kein Rückschritt (Rückmeldung 20.11.2026: „−222“ trotz stetigem Anstieg).
 */
export function settledFrom(ratings: number[]): number {
	for (let i = 0; i < ratings.length; i++) {
		const next = ratings.slice(i, i + 4);
		if (next.every((r, k) => k === 0 || Math.abs(r - next[k - 1]) <= SETTLED_STEP)) return i;
	}
	return ratings.length;
}

export function coachPeriod(history: CoachHistoryPoint[], period: CoachPeriod, now = Date.now()) {
	const end = now;
	const start = period === 'all' ? (history[0]?.date ?? end - DAY) : end - period * DAY;
	const points = history.filter((point) => point.date >= start && point.date <= end);
	// Wertung: nur eingestufte Punkte (ohne die anfängliche Einstufung neuer Konten)
	const rated = points.filter((point) => !point.provisional);
	const ratingBefore = history.findLast(
		(point) => point.date < start && !point.provisional
	)?.rating;
	const indexBefore = history.findLast((point) => point.date < start && point.index)?.index?.value;
	const indices = points.flatMap((point) => (point.index ? [point.index] : []));
	const latestIndex = indices.at(-1);
	const latestRating = rated.at(-1)?.rating;
	const conversions = points.flatMap((point) => point.conversion ?? []);
	return {
		points,
		start,
		end,
		latestIndex,
		latestRating,
		ratingDelta:
			latestRating === undefined || (ratingBefore === undefined && rated.length < 2)
				? null
				: latestRating - (ratingBefore ?? rated[0].rating),
		indexDelta:
			!latestIndex || (indexBefore === undefined && indices.length < 2)
				? null
				: latestIndex.value - (indexBefore ?? indices[0].value),
		analysed: points.filter((point) => point.analysed).length,
		wins: points.filter((point) => point.outcome === 'w').length,
		draws: points.filter((point) => point.outcome === 'd').length,
		losses: points.filter((point) => point.outcome === 'l').length,
		conversion: conversions.length
			? Math.round((conversions.reduce((sum, value) => sum + value, 0) / conversions.length) * 100)
			: null,
		conversionGames: conversions.length
	};
}

/** so viele gewertete Partien umfasst das Fenster von „Wirkt es?“ */
export const CHANGE_WINDOW = 15;

/**
 * Zufällige Schwankung über CHANGE_WINDOW Partien (95 %-Grenze, Elo), gemessen an echten Lichess-Spielern
 * (Rapid, Okt. 2025, nach der Einstufung, scripts/research/level-noise.mjs; docs/research-2026-11-13.md,
 * Nachtrag 21.11.2026):
 * - Wertung: 248 Spieler mit ≥ 31 Partien in einem Monat – über 15 Partien SD 24, 95 % innerhalb ±47.
 * - Spielniveau (Penta, 15 gegen 15 Partien): 30 Spieler – SD 311, 95 % innerhalb ±650. Für kurzfristige
 *   Veränderungen viel zu ungenau; deshalb urteilt „Wirkt es?“ nach der Wertung.
 */
export const RATING_NOISE = 47;
export const LEVEL_NOISE = 650;

export interface RatingChange {
	/** Wertung jetzt und vor CHANGE_WINDOW gewerteten Partien */
	now: number;
	before: number;
	delta: number;
	verdict: 'up' | 'down' | 'flat';
	/** gewertete Rapid-Partien pro Woche in diesem Fenster (die Dosis in dieser Zeit) */
	perWeek: number;
	/** Datum der ersten Partie des Fensters */
	since: number;
}

/**
 * Wirkt es? Wertungsänderung über die letzten 15 eingestuften Partien mit Urteil nach der gemessenen Schwankung
 * und der Spielmenge in dieser Zeit. Ein Zusammenhang, kein Experiment.
 */
export function ratingChange(history: CoachHistoryPoint[], now = Date.now()): RatingChange | null {
	const settled = history.filter((p) => !p.provisional);
	if (settled.length <= CHANGE_WINDOW) return null;
	const last = settled.at(-1)!;
	const prev = settled.at(-1 - CHANGE_WINDOW)!;
	const since = settled.at(-CHANGE_WINDOW)!.date;
	const delta = last.rating - prev.rating;
	const weeks = Math.max(1, (now - since) / (7 * DAY));
	return {
		now: last.rating,
		before: prev.rating,
		delta,
		verdict: delta > RATING_NOISE ? 'up' : delta < -RATING_NOISE ? 'down' : 'flat',
		perWeek: Math.round((CHANGE_WINDOW / weeks) * 10) / 10,
		since
	};
}
