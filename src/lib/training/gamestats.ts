import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { accuracy, type PlyEval } from '#lib/analysis/classify.js';
import { reviewMoves } from '#lib/analysis/run.js';
import type { Explanation } from '#lib/analysis/explain.js';

export type Outcome = 'w' | 'd' | 'l';

export interface WDL {
	w: number;
	d: number;
	l: number;
	n: number;
	/** Punkte in % (Sieg 1, Remis ½) */
	score: number;
}

export function outcomeOf(g: GameRow): Outcome | null {
	if (g.result === '*') return null;
	if (g.result === '1/2-1/2') return 'd';
	const whiteWon = g.result === '1-0';
	return whiteWon === (g.myColor === 'white') ? 'w' : 'l';
}

export function wdl(games: GameRow[]): WDL {
	const r = { w: 0, d: 0, l: 0 };
	for (const g of games) {
		const o = outcomeOf(g);
		if (o) r[o]++;
	}
	const n = r.w + r.d + r.l;
	return { ...r, n, score: n ? Math.round(((r.w + r.d / 2) / n) * 100) : 0 };
}

function groupBy<T>(xs: T[], key: (x: T) => string | null): Map<string, T[]> {
	const m = new Map<string, T[]>();
	for (const x of xs) {
		const k = key(x);
		if (k === null) continue;
		m.set(k, [...(m.get(k) ?? []), x]);
	}
	return m;
}

export type Ending = 'mate' | 'resign' | 'time' | 'draw';
export type Phase = 'opening' | 'middlegame' | 'endgame';
export type Motif = Explanation['motif'];

export interface OpeningStat extends WDL {
	name: string;
	color: 'white' | 'black';
}

export interface GameStats {
	total: WDL;
	byColor: Record<'white' | 'black', WDL>;
	bySource: { key: string; wdl: WDL }[];
	bySpeed: { key: string; wdl: WDL }[];
	vsStrength: { key: 'stronger' | 'equal' | 'weaker'; wdl: WDL }[];
	ratingSeries: {
		key: string;
		source: string;
		speed: string;
		points: { date: number; rating: number }[];
	}[];
	openings: OpeningStat[];
	endings: Record<Ending, number>;
	lossEndings: Record<Ending, number>;
	avgMoves: number;
	analysed: number;
	accuracy: number | null;
	accuracyRecent: number | null;
	accuracyPrevious: number | null;
	phaseAccuracy: Record<Phase, number | null>;
	perGame: { blunders: number; mistakes: number; inaccuracies: number };
	motifs: { motif: Motif; n: number }[];
}

function ending(g: GameRow): Ending {
	if (g.result === '1/2-1/2') return 'draw';
	const term = g.pgn.match(/\[Termination\s+"([^"]*)"\]/)?.[1] ?? '';
	if (/time|zeit/i.test(term)) return 'time';
	try {
		if (Game.fromUciMoves(g.moves, g.startFen).end()?.kind === 'checkmate') return 'mate';
	} catch {
		/* ungültig – zählt als Aufgabe */
	}
	if (/checkmate/i.test(term)) return 'mate';
	return 'resign';
}

/** Phase eines Halbzugs (vereinfachte Grenzen nach Zugnummer) */
export function phaseOf(ply: number): Phase {
	if (ply <= 20) return 'opening';
	if (ply <= 60) return 'middlegame';
	return 'endgame';
}

/**
 * Wertet alle Partien aus.
 * @param openingName Name der Eröffnung zu einer Zugfolge (oder null)
 */
export function computeStats(
	games: GameRow[],
	openingName: (ucis: string[]) => string | null = () => null
): GameStats {
	const finished = games.filter((g) => outcomeOf(g) !== null);

	const byColor = {
		white: wdl(finished.filter((g) => g.myColor === 'white')),
		black: wdl(finished.filter((g) => g.myColor === 'black'))
	};
	const bySource = [...groupBy(finished, (g) => g.source)]
		.map(([key, gs]) => ({ key, wdl: wdl(gs) }))
		.sort((a, b) => b.wdl.n - a.wdl.n);
	const bySpeed = [...groupBy(finished, (g) => g.speed ?? null)]
		.map(([key, gs]) => ({ key, wdl: wdl(gs) }))
		.sort((a, b) => b.wdl.n - a.wdl.n);

	const rated = finished.filter((g) => g.myRating && g.oppRating);
	const strength = (g: GameRow) => {
		const diff = g.oppRating! - g.myRating!;
		return diff > 100 ? 'stronger' : diff < -100 ? 'weaker' : 'equal';
	};
	const vsStrength = (['stronger', 'equal', 'weaker'] as const)
		.map((key) => ({ key, wdl: wdl(rated.filter((g) => strength(g) === key)) }))
		.filter((x) => x.wdl.n > 0);

	const ratingSeries = [
		...groupBy(
			games.filter((g) => g.myRating && g.speed),
			(g) => `${g.source}:${g.speed}`
		)
	]
		.map(([key, gs]) => ({
			key,
			source: gs[0].source,
			speed: gs[0].speed!,
			points: gs.sort((a, b) => a.date - b.date).map((g) => ({ date: g.date, rating: g.myRating! }))
		}))
		.filter((s) => s.points.length >= 2)
		.sort((a, b) => b.points.length - a.points.length);

	const openings = [
		...groupBy(finished, (g) => {
			const name = openingName(g.moves);
			return name ? `${g.myColor}|${name.split(':')[0].trim()}` : null;
		})
	]
		.map(([key, gs]) => {
			const [color, name] = key.split('|') as ['white' | 'black', string];
			return { name, color, ...wdl(gs) };
		})
		.sort((a, b) => b.n - a.n);

	const endings: Record<Ending, number> = { mate: 0, resign: 0, time: 0, draw: 0 };
	const lossEndings: Record<Ending, number> = { mate: 0, resign: 0, time: 0, draw: 0 };
	for (const g of finished) {
		const e = ending(g);
		endings[e]++;
		if (outcomeOf(g) === 'l') lossEndings[e]++;
	}

	const avgMoves = finished.length
		? Math.round(finished.reduce((s, g) => s + Math.ceil(g.moves.length / 2), 0) / finished.length)
		: 0;

	// ── Analysierte Partien: Genauigkeit, Phasen, Fehlerarten ──
	const analysed = games
		.filter((g) => g.analysis?.done)
		.sort((a, b) => a.date - b.date)
		.slice(-150);
	const gameAcc: number[] = [];
	const phaseLoss: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
	const counts = { blunders: 0, mistakes: 0, inaccuracies: 0 };
	const motifMap = new Map<Motif, number>();
	for (const g of analysed) {
		const reviews = reviewMoves(g, g.analysis!.evals as PlyEval[]).filter(
			(r) => r.mover === g.myColor
		);
		if (!reviews.length) continue;
		gameAcc.push(accuracy(reviews.map((r) => r.loss)));
		for (const r of reviews) {
			phaseLoss[phaseOf(r.ply)].push(r.loss);
			if (r.judgement === 'blunder') counts.blunders++;
			else if (r.judgement === 'mistake') counts.mistakes++;
			else if (r.judgement === 'inaccuracy') counts.inaccuracies++;
			if (r.explanation && (r.judgement === 'blunder' || r.judgement === 'mistake'))
				motifMap.set(r.explanation.motif, (motifMap.get(r.explanation.motif) ?? 0) + 1);
		}
	}
	const avg = (xs: number[]) =>
		xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
	const recent = gameAcc.slice(-10);
	const previous = gameAcc.slice(-20, -10);
	const nA = gameAcc.length || 1;

	return {
		total: wdl(finished),
		byColor,
		bySource,
		bySpeed,
		vsStrength,
		ratingSeries,
		openings,
		endings,
		lossEndings,
		avgMoves,
		analysed: gameAcc.length,
		accuracy: avg(gameAcc),
		accuracyRecent: avg(recent),
		accuracyPrevious: previous.length >= 3 ? avg(previous) : null,
		phaseAccuracy: {
			opening: phaseLoss.opening.length >= 5 ? accuracy(phaseLoss.opening) : null,
			middlegame: phaseLoss.middlegame.length >= 5 ? accuracy(phaseLoss.middlegame) : null,
			endgame: phaseLoss.endgame.length >= 5 ? accuracy(phaseLoss.endgame) : null
		},
		perGame: {
			blunders: Math.round((counts.blunders / nA) * 10) / 10,
			mistakes: Math.round((counts.mistakes / nA) * 10) / 10,
			inaccuracies: Math.round((counts.inaccuracies / nA) * 10) / 10
		},
		motifs: [...motifMap].map(([motif, n]) => ({ motif, n })).sort((a, b) => b.n - a.n)
	};
}

export interface Insight {
	kind: 'good' | 'bad' | 'info';
	key: string;
	params?: Record<string, string | number>;
}

/** Die auffälligsten Erkenntnisse als kurze Sätze (i18n-Schlüssel unter stats.insight.*) */
export function insights(s: GameStats): Insight[] {
	const out: Insight[] = [];
	if (s.total.n < 5) return out;

	const { white, black } = s.byColor;
	if (white.n >= 5 && black.n >= 5 && Math.abs(white.score - black.score) >= 12)
		out.push({
			kind: 'info',
			key: white.score > black.score ? 'betterWhite' : 'betterBlack',
			params: { a: Math.max(white.score, black.score), b: Math.min(white.score, black.score) }
		});

	const solid = s.openings.filter((o) => o.n >= 3);
	const best = [...solid].sort((a, b) => b.score - a.score)[0];
	const worst = [...solid].sort((a, b) => a.score - b.score)[0];
	if (best && best.score >= 55)
		out.push({
			kind: 'good',
			key: 'bestOpening',
			params: { name: best.name, pct: best.score, n: best.n }
		});
	if (worst && worst !== best && worst.score <= 45)
		out.push({
			kind: 'bad',
			key: 'worstOpening',
			params: { name: worst.name, pct: worst.score, n: worst.n }
		});

	const phases = (Object.entries(s.phaseAccuracy) as [Phase, number | null][]).filter(
		(e): e is [Phase, number] => e[1] !== null
	);
	if (phases.length >= 2) {
		const [weak] = [...phases].sort((a, b) => a[1] - b[1]);
		const [strong] = [...phases].sort((a, b) => b[1] - a[1]);
		if (strong[1] - weak[1] >= 5)
			out.push({
				kind: 'bad',
				key: 'weakPhase',
				params: { phase: weak[0], acc: weak[1], best: strong[1] }
			});
	}

	if (s.motifs[0] && s.motifs[0].n >= 3)
		out.push({ kind: 'bad', key: 'motif', params: { motif: s.motifs[0].motif, n: s.motifs[0].n } });

	const losses = s.total.l;
	if (losses >= 5 && s.lossEndings.time / losses >= 0.25)
		out.push({
			kind: 'bad',
			key: 'time',
			params: { pct: Math.round((s.lossEndings.time / losses) * 100) }
		});

	if (s.accuracyRecent !== null && s.accuracyPrevious !== null) {
		const d = s.accuracyRecent - s.accuracyPrevious;
		if (Math.abs(d) >= 3)
			out.push({
				kind: d > 0 ? 'good' : 'bad',
				key: d > 0 ? 'improving' : 'declining',
				params: { d: Math.abs(d) }
			});
	}

	const stronger = s.vsStrength.find((x) => x.key === 'stronger');
	if (stronger && stronger.wdl.n >= 5 && stronger.wdl.score >= 40)
		out.push({ kind: 'good', key: 'giantKiller', params: { pct: stronger.wdl.score } });

	return out;
}
