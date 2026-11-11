import { db, type GameRow } from '#lib/db/db.js';
import { judge, accuracy, type PlyEval } from '#lib/analysis/classify.js';
import { Game, turnFromFen } from '#lib/chess/game.js';

export interface OnlineRating {
	source: 'lichess' | 'chesscom';
	speed: string;
	rating: number;
	/** Veränderung gegenüber 30 Tagen davor (falls bekannt) */
	delta: number | null;
	games: number;
}

const SPEED_ORDER = ['bullet', 'blitz', 'rapid', 'classical', 'daily', 'correspondence'];

/** Aktuelle Online-Wertungen aus importierten Partien (je Plattform und Bedenkzeit) */
export function ratingsFrom(games: GameRow[], now = Date.now()): OnlineRating[] {
	const groups = new Map<string, GameRow[]>();
	for (const g of games) {
		if ((g.source !== 'lichess' && g.source !== 'chesscom') || !g.myRating || !g.speed) continue;
		const k = `${g.source}|${g.speed}`;
		groups.set(k, [...(groups.get(k) ?? []), g]);
	}
	const out: OnlineRating[] = [];
	for (const [k, gs] of groups) {
		gs.sort((a, b) => a.date - b.date);
		const [source, speed] = k.split('|') as ['lichess' | 'chesscom', string];
		const last = gs.at(-1)!;
		const before = [...gs].reverse().find((g) => g.date < now - 30 * 86_400_000);
		out.push({
			source,
			speed,
			rating: last.myRating!,
			delta: before ? last.myRating! - before.myRating! : null,
			games: gs.length
		});
	}
	return out.sort(
		(a, b) =>
			a.source.localeCompare(b.source) ||
			b.games - a.games ||
			SPEED_ORDER.indexOf(a.speed) - SPEED_ORDER.indexOf(b.speed)
	);
}

export async function onlineRatings(): Promise<OnlineRating[]> {
	return ratingsFrom(await db.games.where('source').anyOf('lichess', 'chesscom').toArray());
}

/** Genauigkeit und Fehlerzahl meiner Züge in einer analysierten Partie (ohne Erklärungen – schnell) */
export function quality(
	row: GameRow
): { accuracy: number; blunders: number; mistakes: number } | null {
	const evals = row.analysis?.evals as PlyEval[] | undefined;
	if (!row.analysis?.done || !evals?.length) return null;
	const g = Game.fromUciMoves(row.moves, row.startFen);
	const losses: number[] = [];
	let blunders = 0;
	let mistakes = 0;
	for (let i = 0; i < g.moves.length; i++) {
		const before = evals[i];
		const after = evals[i + 1];
		if (!before || !after) break;
		const mover = turnFromFen(g.fenAt(i));
		if (mover !== row.myColor) continue;
		const j = judge(before, after, mover, g.moves[i].uci);
		losses.push(j.loss);
		if (j.judgement === 'blunder') blunders++;
		else if (j.judgement === 'mistake') mistakes++;
	}
	return { accuracy: accuracy(losses), blunders, mistakes };
}
