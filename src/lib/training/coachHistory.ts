import type { GameRow } from '#lib/db/db.js';
import { isTargetGame, quality, ratingAfter } from '#lib/import/ratings.js';
import { gameSafety } from './blunders.js';
import { outcomeOf } from './gamestats.js';

export const COACH_PERIODS = [7, 30, 365, 'all'] as const;
export type CoachPeriod = (typeof COACH_PERIODS)[number];
const DAY = 86_400_000;

export interface CoachIndex {
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
}

interface AnalysedGame {
	blunders: number;
	moves: number;
	accuracy: number;
}

export function trainingIndex(window: AnalysedGame[]): CoachIndex | null {
	const moves = window.reduce((sum, game) => sum + game.moves, 0);
	if (window.length < 3 || moves < 30) return null;
	const blundersPer30 = (30 * window.reduce((sum, game) => sum + game.blunders, 0)) / moves;
	const safety = Math.max(0, 100 - 10 * blundersPer30);
	const accuracy = window.reduce((sum, game) => sum + game.accuracy, 0) / window.length;
	return {
		value: Math.round(0.6 * safety + 0.4 * accuracy),
		accuracy,
		blundersPer30,
		analysed: window.length,
		moves
	};
}

export function coachHistory(games: GameRow[]): CoachHistoryPoint[] {
	const window: AnalysedGame[] = [];
	const history: CoachHistoryPoint[] = [];
	for (const game of games.filter(isTargetGame).sort((a, b) => a.date - b.date)) {
		const rating = ratingAfter(game);
		if (rating === null || !Number.isFinite(rating) || !Number.isFinite(game.date)) continue;
		const outcome = outcomeOf(game);
		let index: CoachIndex | null = null;
		let analysed = false;
		let conversion: number | null = null;
		if (game.analysis?.done && game.analysis.evals.length === game.moves.length + 1) {
			const safety = gameSafety(game);
			const fit = safety ? quality(game) : null;
			if (safety && fit && safety.live > 0) {
				analysed = true;
				window.push({ blunders: safety.blunders, moves: safety.live, accuracy: fit.accuracy });
				if (window.length > 10) window.shift();
				index = trainingIndex(window);
				if (safety.wonAt !== null) conversion = outcome === 'w' ? 1 : outcome === 'd' ? 0.5 : 0;
			}
		}
		history.push({ date: game.date, rating, index, outcome, analysed, conversion });
	}
	return history;
}

export function coachPeriod(history: CoachHistoryPoint[], period: CoachPeriod, now = Date.now()) {
	const end = now;
	const start = period === 'all' ? (history[0]?.date ?? end - DAY) : end - period * DAY;
	const points = history.filter((point) => point.date >= start && point.date <= end);
	const ratingBefore = history.findLast((point) => point.date < start)?.rating;
	const indexBefore = history.findLast((point) => point.date < start && point.index)?.index?.value;
	const indices = points.flatMap((point) => (point.index ? [point.index] : []));
	const latestIndex = indices.at(-1);
	const latestRating = points.at(-1)?.rating;
	const conversions = points.flatMap((point) => point.conversion ?? []);
	return {
		points,
		start,
		end,
		latestIndex,
		latestRating,
		ratingDelta:
			latestRating === undefined || (ratingBefore === undefined && points.length < 2)
				? null
				: latestRating - (ratingBefore ?? points[0].rating),
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
