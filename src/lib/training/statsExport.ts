import type { GameRow } from '#lib/db/db.js';
import { outcomeOf, type GameStats } from './gamestats.js';
import {
	isRated,
	ratingAfter,
	ratingDiff,
	quality,
	summarise,
	byMonth,
	type RatingSeries
} from '#lib/import/ratings.js';

const COLUMNS = [
	'date',
	'source',
	'speed',
	'rated',
	'color',
	'opponent',
	'opponent_rating',
	'my_rating_before',
	'my_rating_after',
	'rating_change',
	'result',
	'score',
	'moves',
	'opening',
	'accuracy',
	'blunders',
	'mistakes'
] as const;

function cell(v: unknown): string {
	if (v === null || v === undefined) return '';
	const s = String(v);
	// Formel-Injektion in Tabellenprogrammen verhindern, Anführungszeichen maskieren
	const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
	return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Alle Partien als CSV (eine Zeile je Partie, neueste zuerst) */
export function gamesCsv(
	games: GameRow[],
	openingName: (ucis: string[]) => string | null = () => null
): string {
	const rows = [...games]
		.sort((a, b) => b.date - a.date)
		.map((g) => {
			const o = outcomeOf(g);
			const q = quality(g);
			const after = ratingAfter(g);
			const diff = ratingDiff(g);
			const online = g.source === 'lichess' || g.source === 'chesscom';
			return [
				new Date(g.date).toISOString().slice(0, 16).replace('T', ' '),
				g.source,
				g.speed ?? '',
				online ? (isRated(g) ? 'yes' : 'no') : '',
				g.myColor,
				g.opponent,
				g.oppRating ?? '',
				// Chess.com kennt nur die Zahl nach der Partie
				g.source === 'lichess' ? (g.myRating ?? '') : '',
				after ?? '',
				diff ?? '',
				g.result,
				o === 'w' ? 1 : o === 'd' ? 0.5 : o === 'l' ? 0 : '',
				Math.ceil(g.moves.length / 2),
				openingName(g.moves) ?? '',
				q?.accuracy ?? '',
				q?.blunders ?? '',
				q?.mistakes ?? ''
			]
				.map(cell)
				.join(',');
		});
	return [COLUMNS.join(','), ...rows].join('\n');
}

/** Zusammenfassung als JSON (lesbar, mit Wertungsverlauf je Bedenkzeit) */
export function statsJson(stats: GameStats, series: RatingSeries[], puzzleRating?: number) {
	return {
		exportedAt: new Date().toISOString(),
		app: 'Rookie',
		results: { total: stats.total, byColor: stats.byColor, bySource: stats.bySource },
		bySpeed: stats.bySpeed,
		vsStrength: stats.vsStrength,
		puzzleRating: puzzleRating ?? null,
		ratings: series.map((s) => ({
			source: s.source,
			speed: s.speed,
			summary: summarise(s.points),
			months: byMonth(s.points),
			history: s.points.map((p) => ({
				date: new Date(p.date).toISOString().slice(0, 10),
				rating: p.rating
			}))
		})),
		openings: stats.openings,
		quality: {
			analysedGames: stats.analysed,
			accuracy: stats.accuracy,
			accuracyLast10: stats.accuracyRecent,
			perGame: stats.perGame,
			byPhase: stats.phaseAccuracy,
			typicalMistakes: stats.motifs
		},
		endings: stats.endings,
		avgMoves: stats.avgMoves
	};
}

export function download(name: string, content: string, type: string) {
	// BOM, damit Excel Umlaute in CSV richtig erkennt
	const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
