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

const SPEED_ORDER = [
	'ultraBullet',
	'bullet',
	'blitz',
	'rapid',
	'classical',
	'daily',
	'correspondence'
];

function header(pgn: string, key: string): string | undefined {
	return pgn.match(new RegExp(`\\[${key}\\s+"([^"]*)"\\]`))?.[1];
}

/**
 * Wertung NACH der Partie.
 * Lichess liefert die Zahl vor der Partie (+ RatingDiff im PGN), Chess.com schon die Zahl danach.
 */
export function ratingAfter(g: GameRow): number | null {
	if (!g.myRating) return null;
	if (g.source === 'lichess') {
		const diff = Number(
			header(g.pgn, g.myColor === 'white' ? 'WhiteRatingDiff' : 'BlackRatingDiff')
		);
		return Number.isFinite(diff) ? g.myRating + diff : g.myRating;
	}
	return g.myRating;
}

/** Wertungsänderung durch die Partie (nur Lichess bekannt) */
export function ratingDiff(g: GameRow): number | null {
	if (g.source !== 'lichess') return null;
	const d = Number(header(g.pgn, g.myColor === 'white' ? 'WhiteRatingDiff' : 'BlackRatingDiff'));
	return Number.isFinite(d) ? d : null;
}

/** Gewertete Partie? Ungewertete Partien verfälschen sonst Verlauf und aktuelle Zahl. */
export function isRated(g: GameRow): boolean {
	if (g.source !== 'lichess' && g.source !== 'chesscom') return false;
	if (!g.myRating || !g.speed) return false;
	if (g.rated !== undefined) return g.rated;
	if (g.source === 'lichess') {
		// ältere Importe: RatingDiff gibt es nur bei gewerteten Partien, sonst Event "Casual …"
		if (header(g.pgn, 'WhiteRatingDiff') || header(g.pgn, 'BlackRatingDiff')) return true;
		return !/casual/i.test(header(g.pgn, 'Event') ?? '');
	}
	return true;
}

export interface RatingPoint {
	date: number;
	rating: number;
	gameId?: number;
	result: 'w' | 'd' | 'l' | null;
	opponent: string;
	oppRating?: number;
}

export interface RatingSeries {
	key: string;
	source: 'lichess' | 'chesscom';
	speed: string;
	points: RatingPoint[];
}

const outcome = (g: GameRow): RatingPoint['result'] =>
	g.result === '*'
		? null
		: g.result === '1/2-1/2'
			? 'd'
			: (g.result === '1-0') === (g.myColor === 'white')
				? 'w'
				: 'l';

/** Wertungsverlauf je Plattform und Bedenkzeit – nur gewertete Partien, Zahl nach der Partie */
export function ratingSeriesFrom(games: GameRow[]): RatingSeries[] {
	const groups = new Map<string, GameRow[]>();
	for (const g of games) {
		if (!isRated(g)) continue;
		const k = `${g.source}:${g.speed}`;
		const arr = groups.get(k);
		if (arr) arr.push(g);
		else groups.set(k, [g]);
	}
	return [...groups]
		.map(([key, gs]) => {
			gs.sort((a, b) => a.date - b.date);
			return {
				key,
				source: gs[0].source as 'lichess' | 'chesscom',
				speed: gs[0].speed!,
				points: gs.map((g) => ({
					date: g.date,
					rating: ratingAfter(g)!,
					gameId: g.id,
					result: outcome(g),
					opponent: g.opponent,
					oppRating: g.oppRating
				}))
			};
		})
		.sort(
			(a, b) =>
				a.source.localeCompare(b.source) ||
				b.points.length - a.points.length ||
				SPEED_ORDER.indexOf(a.speed) - SPEED_ORDER.indexOf(b.speed)
		);
}

/** Aktuelle Online-Wertungen aus importierten Partien (je Plattform und Bedenkzeit) */
export function ratingsFrom(games: GameRow[], now = Date.now()): OnlineRating[] {
	return ratingSeriesFrom(games).map((s) => {
		const last = s.points.at(-1)!;
		const before = [...s.points].reverse().find((p) => p.date < now - 30 * 86_400_000);
		return {
			source: s.source,
			speed: s.speed,
			rating: last.rating,
			delta: before ? last.rating - before.rating : null,
			games: s.points.length
		};
	});
}

export interface RangeSummary {
	current: number;
	start: number;
	change: number;
	peak: { rating: number; date: number };
	low: { rating: number; date: number };
	games: number;
	w: number;
	d: number;
	l: number;
	/** Turnierleistung (Ø Gegner + 400·(S−N)/N), nur wenn Gegnerzahlen bekannt */
	performance: number | null;
	avgOpp: number | null;
	bestWin: { rating: number; opponent: string; date: number } | null;
	/** längste Siegesserie im Zeitraum */
	winStreak: number;
}

/** Kennzahlen eines Verlaufsausschnitts. `prev` = letzter Punkt vor dem Zeitraum (Startwert). */
export function summarise(points: RatingPoint[], prev?: RatingPoint): RangeSummary | null {
	if (!points.length) return null;
	let peak = points[0];
	let low = points[0];
	let w = 0;
	let d = 0;
	let l = 0;
	let streak = 0;
	let winStreak = 0;
	let oppSum = 0;
	let oppN = 0;
	let score = 0;
	let bestWin: RangeSummary['bestWin'] = null;
	for (const p of points) {
		if (p.rating > peak.rating) peak = p;
		if (p.rating < low.rating) low = p;
		if (p.result === 'w') {
			w++;
			streak++;
			winStreak = Math.max(winStreak, streak);
			if (p.oppRating && (!bestWin || p.oppRating > bestWin.rating))
				bestWin = { rating: p.oppRating, opponent: p.opponent, date: p.date };
		} else {
			streak = 0;
			if (p.result === 'd') d++;
			else if (p.result === 'l') l++;
		}
		if (p.oppRating && p.result) {
			oppSum += p.oppRating;
			oppN++;
			score += p.result === 'w' ? 1 : p.result === 'd' ? 0.5 : 0;
		}
	}
	const start = (prev ?? points[0]).rating;
	const avgOpp = oppN ? Math.round(oppSum / oppN) : null;
	return {
		current: points.at(-1)!.rating,
		start,
		change: points.at(-1)!.rating - start,
		peak: { rating: peak.rating, date: peak.date },
		low: { rating: low.rating, date: low.date },
		games: points.length,
		w,
		d,
		l,
		performance: oppN >= 3 ? Math.round(avgOpp! + (400 * (2 * score - oppN)) / oppN) : null,
		avgOpp,
		bestWin,
		winStreak
	};
}

export interface MonthRow {
	month: string;
	start: number;
	end: number;
	change: number;
	games: number;
	score: number;
}

/** Monatsübersicht (neueste zuerst) */
export function byMonth(points: RatingPoint[]): MonthRow[] {
	const groups: { month: string; pts: RatingPoint[] }[] = [];
	for (const p of points) {
		const d = new Date(p.date);
		const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		if (groups.at(-1)?.month !== m) groups.push({ month: m, pts: [] });
		groups.at(-1)!.pts.push(p);
	}
	const rows: MonthRow[] = [];
	let prev: number | null = null;
	for (const g of groups) {
		const start = prev ?? g.pts[0].rating;
		const end = g.pts.at(-1)!.rating;
		const done = g.pts.filter((p) => p.result);
		const sc = done.reduce((a, p) => a + (p.result === 'w' ? 1 : p.result === 'd' ? 0.5 : 0), 0);
		rows.push({
			month: g.month,
			start,
			end,
			change: end - start,
			games: g.pts.length,
			score: done.length ? Math.round((sc / done.length) * 100) : 0
		});
		prev = end;
	}
	return rows.reverse();
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
