import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { accuracy, type PlyEval } from '#lib/analysis/classify.js';
import { reviewMoves } from '#lib/analysis/run.js';
import type { Explanation } from '#lib/analysis/explain.js';
import { ratingSeriesFrom, type RatingSeries } from '#lib/import/ratings.js';

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
	ratingSeries: RatingSeries[];
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
	/** Patzer je 30 eigene Züge – unabhängig von der Partielänge */
	blundersPer30: number | null;
	/** Fehler des Gegners (Fehler/Patzer) und wie oft du sie sofort bestraft hast */
	chances: { taken: number; total: number };
	motifs: { motif: Motif; n: number }[];
	/** Genauigkeit je analysierter Partie, älteste zuerst (für Trends mit Zufallsbereich) */
	accuracySeries: number[];
	/** eigene Züge je Phase (Mindestmengen für Phasen-Vergleiche) */
	phaseMoves: Record<Phase, number>;
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

/** Phase eines Halbzugs nur nach Zugnummer – Rückfall, wenn keine Stellung bekannt ist */
export function phaseOf(ply: number): Phase {
	if (ply <= 20) return 'opening';
	if (ply <= 60) return 'middlegame';
	return 'endgame';
}

/** Figuren außer Bauern und Königen (beide Seiten) und Besetzung der Grundreihen aus einer FEN */
function material(fen: string): { pieces: number; backWhite: number; backBlack: number } {
	const rows = fen.split(' ')[0].split('/');
	const count = (row: string, re: RegExp) => (row.match(re) ?? []).length;
	return {
		pieces: count(rows.join(''), /[qrbnQRBN]/g),
		backWhite: count(rows[7] ?? '', /[QRBNK]/g),
		backBlack: count(rows[0] ?? '', /[qrbnk]/g)
	};
}

/**
 * Phase jeder Stellung nach dem Material auf dem Brett (angelehnt an Lichess):
 * - Endspiel: höchstens 6 Figuren außer Bauern und Königen
 * - Eröffnung endet nach Zug 15, sobald höchstens 10 solche Figuren übrig sind
 *   oder eine Grundreihe weitgehend leer ist (Figuren entwickelt)
 * Phasen gehen nur vorwärts. Index = Halbzug-Nummer der Stellung (0 = Ausgangsstellung).
 */
export function phasesByMaterial(fens: string[]): Phase[] {
	let phase: Phase = 'opening';
	return fens.map((fen, i) => {
		const m = material(fen);
		if (m.pieces <= 6) phase = 'endgame';
		else if (
			phase === 'opening' &&
			(i > 30 || m.pieces <= 10 || m.backWhite < 4 || m.backBlack < 4)
		)
			phase = 'middlegame';
		return phase;
	});
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

	const ratingSeries = ratingSeriesFrom(games).filter((s) => s.points.length >= 2);

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
	const phaseGames: Record<Phase, Set<number>> = {
		opening: new Set(),
		middlegame: new Set(),
		endgame: new Set()
	};
	let ownMoves = 0;
	const chances = { taken: 0, total: 0 };
	for (const [gi, g] of analysed.entries()) {
		const all = reviewMoves(g, g.analysis!.evals as PlyEval[]);
		const reviews = all.filter((r) => r.mover === g.myColor);
		if (!reviews.length) continue;
		gameAcc.push(accuracy(reviews.map((r) => r.loss)));
		ownMoves += reviews.length;
		// Phase nach Material der Stellung vor dem Zug
		let phases: Phase[] | null = null;
		try {
			const game = Game.fromUciMoves(g.moves, g.startFen);
			phases = phasesByMaterial(Array.from({ length: game.ply + 1 }, (_, i) => game.fenAt(i)));
		} catch {
			/* ungültige Zugfolge: Rückfall auf Zugnummer */
		}
		// Chancen: Gegner macht einen Fehler/Patzer – nutzt du ihn mit dem nächsten Zug?
		const byPly = new Map(all.map((r) => [r.ply, r]));
		for (const r of all) {
			if (r.mover === g.myColor || (r.judgement !== 'mistake' && r.judgement !== 'blunder'))
				continue;
			const reply = byPly.get(r.ply + 1);
			if (!reply) continue;
			chances.total++;
			if (reply.loss < 0.1) chances.taken++;
		}
		for (const r of reviews) {
			const ph = phases?.[r.ply - 1] ?? phaseOf(r.ply);
			phaseLoss[ph].push(r.loss);
			phaseGames[ph].add(gi);
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
	const phaseValue = (p: Phase) =>
		phaseLoss[p].length >= 12 && phaseGames[p].size >= 2 ? accuracy(phaseLoss[p]) : null;

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
		// erst ab 12 Zügen aus mindestens 2 Partien – sonst schwankt der Wert zu stark
		phaseAccuracy: {
			opening: phaseValue('opening'),
			middlegame: phaseValue('middlegame'),
			endgame: phaseValue('endgame')
		},
		blundersPer30: ownMoves >= 30 ? Math.round((counts.blunders / ownMoves) * 300) / 10 : null,
		chances,
		perGame: {
			blunders: Math.round((counts.blunders / nA) * 10) / 10,
			mistakes: Math.round((counts.mistakes / nA) * 10) / 10,
			inaccuracies: Math.round((counts.inaccuracies / nA) * 10) / 10
		},
		motifs: [...motifMap].map(([motif, n]) => ({ motif, n })).sort((a, b) => b.n - a.n),
		accuracySeries: gameAcc,
		phaseMoves: {
			opening: phaseLoss.opening.length,
			middlegame: phaseLoss.middlegame.length,
			endgame: phaseLoss.endgame.length
		}
	};
}

export interface Insight {
	kind: 'good' | 'bad' | 'info';
	key: string;
	params?: Record<string, string | number>;
	/** Wie viel ändert es? (betroffene Partien × Abstand) – zum Sortieren */
	weight?: number;
	/** passende Übung in Rookie */
	action?: 'course' | 'safety' | 'puzzles' | 'endgame' | 'slower' | 'mistakes';
}

/** Mindestmengen: darunter ist ein Unterschied fast immer Zufall */
export const INSIGHT_MIN = {
	games: 15,
	opening: 8,
	color: 10,
	phaseMoves: 60,
	phaseGames: 5,
	losses: 8,
	accuracyWindow: 10
};

/** Punkte-Anteil 0..1 aus Sieg/Remis/Niederlage */
const pts = (x: WDL) => (x.n ? (x.w + x.d / 2) / x.n : 0);

/**
 * Weicht eine Gruppe (Eröffnung, Farbe) deutlich vom eigenen Schnitt ab?
 * Normalnäherung der Binomialverteilung: |p − p0| > 1,96 · √(p0(1−p0)/n).
 */
export function clearlyDifferent(group: WDL, p0: number): boolean {
	if (!group.n) return false;
	const se = Math.sqrt(Math.max(0.05, p0 * (1 - p0)) / group.n);
	return Math.abs(pts(group) - p0) > 1.96 * se;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[]) =>
	xs.length < 2 ? 0 : xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1);

/**
 * Die Erkenntnisse, die wirklich etwas aussagen – als kurze Sätze (i18n-Schlüssel unter stats.insight.*).
 *
 * Regeln (statt „was auffällt“ aus drei Partien):
 * - erst ab 15 beendeten Partien überhaupt;
 * - jede Aussage braucht eine Mindestmenge **und** einen Unterschied, der größer ist als der
 *   95-%-Zufallsbereich (Eröffnung/Farbe gegen den eigenen Schnitt, Genauigkeit jüngste 10 gegen die 10 davor);
 * - Stellungsfehler („positional“) sind kein Motiv, an dem man üben kann – genannt wird das häufigste
 *   konkrete Motiv (Figur hängt, Gabel, Matt …);
 * - sortiert nach Wirkung (betroffene Partien × Abstand), höchstens vier; jede mit passender Übung.
 */
export function insights(s: GameStats): Insight[] {
	const out: Insight[] = [];
	if (s.total.n < INSIGHT_MIN.games) return out;
	const p0 = pts(s.total);

	const { white, black } = s.byColor;
	if (white.n >= INSIGHT_MIN.color && black.n >= INSIGHT_MIN.color) {
		// zwei Anteile vergleichen
		const pw = pts(white);
		const pb = pts(black);
		const se = Math.sqrt(Math.max(0.05, p0 * (1 - p0)) * (1 / white.n + 1 / black.n));
		if (Math.abs(pw - pb) > 1.96 * se)
			out.push({
				kind: 'info',
				key: pw > pb ? 'betterWhite' : 'betterBlack',
				params: { a: Math.max(white.score, black.score), b: Math.min(white.score, black.score) },
				weight: Math.abs(pw - pb) * Math.min(white.n, black.n)
			});
	}

	const solid = s.openings.filter((o) => o.n >= INSIGHT_MIN.opening && clearlyDifferent(o, p0));
	const best = [...solid].filter((o) => pts(o) > p0).sort((a, b) => b.score - a.score)[0];
	const worst = [...solid].filter((o) => pts(o) < p0).sort((a, b) => a.score - b.score)[0];
	if (best)
		out.push({
			kind: 'good',
			key: 'bestOpening',
			params: {
				name: best.name,
				pct: best.score,
				n: best.n,
				color: best.color,
				avg: s.total.score
			},
			weight: (pts(best) - p0) * best.n
		});
	if (worst)
		out.push({
			kind: 'bad',
			key: 'worstOpening',
			params: {
				name: worst.name,
				pct: worst.score,
				n: worst.n,
				color: worst.color,
				avg: s.total.score
			},
			weight: (p0 - pts(worst)) * worst.n,
			action: 'course'
		});

	// Phase: genug Züge in jeder Phase und ein deutlicher Abstand (≥ 8 Punkte Genauigkeit)
	const phases = (Object.entries(s.phaseAccuracy) as [Phase, number | null][]).filter(
		(e): e is [Phase, number] => e[1] !== null && s.phaseMoves[e[0]] >= INSIGHT_MIN.phaseMoves
	);
	if (phases.length >= 2) {
		const [weak] = [...phases].sort((a, b) => a[1] - b[1]);
		const [strong] = [...phases].sort((a, b) => b[1] - a[1]);
		if (strong[1] - weak[1] >= 8)
			out.push({
				kind: 'bad',
				key: 'weakPhase',
				params: { phase: weak[0], acc: weak[1], best: strong[1] },
				weight: ((strong[1] - weak[1]) / 100) * s.analysed,
				action: weak[0] === 'endgame' ? 'endgame' : weak[0] === 'opening' ? 'course' : 'safety'
			});
	}

	// häufigstes konkretes Motiv (ohne „Stellungsfehler“), mit Anteil an allen konkreten Fehlern
	const concrete = s.motifs.filter((m) => m.motif !== 'positional');
	const allConcrete = concrete.reduce((a, m) => a + m.n, 0);
	const top = concrete[0];
	if (top && top.n >= 5 && s.analysed >= 5)
		out.push({
			kind: 'bad',
			key: 'motif',
			params: {
				motif: top.motif,
				n: top.n,
				games: s.analysed,
				share: Math.round((top.n / allConcrete) * 100)
			},
			weight: top.n / 2,
			action: top.motif === 'hanging' || top.motif === 'mate-allowed' ? 'safety' : 'mistakes'
		});

	const losses = s.total.l;
	if (
		losses >= INSIGHT_MIN.losses &&
		s.lossEndings.time >= 3 &&
		s.lossEndings.time / losses >= 0.25
	)
		out.push({
			kind: 'bad',
			key: 'time',
			params: { pct: Math.round((s.lossEndings.time / losses) * 100), n: s.lossEndings.time },
			weight: s.lossEndings.time,
			action: 'slower'
		});

	// Genauigkeit: jüngste 10 gegen die 10 davor, nur wenn größer als der Zufallsbereich (Welch)
	const w = INSIGHT_MIN.accuracyWindow;
	const acc = s.accuracySeries;
	if (acc.length >= 2 * w) {
		const a = acc.slice(-w);
		const b = acc.slice(-2 * w, -w);
		const d = mean(a) - mean(b);
		const margin = 1.96 * Math.sqrt(variance(a) / w + variance(b) / w);
		if (Math.abs(d) > margin)
			out.push({
				kind: d > 0 ? 'good' : 'bad',
				key: d > 0 ? 'improving' : 'declining',
				params: { d: Math.round(Math.abs(d)) },
				weight: Math.abs(d) / 2
			});
	}

	const stronger = s.vsStrength.find((x) => x.key === 'stronger');
	// gegen > 100 stärkere Gegner erwartet man < 36 %; ab 10 Partien und ≥ 50 % ist das bemerkenswert
	if (stronger && stronger.wdl.n >= 10 && stronger.wdl.score >= 50)
		out.push({
			kind: 'good',
			key: 'giantKiller',
			params: { pct: stronger.wdl.score, n: stronger.wdl.n },
			weight: stronger.wdl.n * 0.15
		});

	return out.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 4);
}
