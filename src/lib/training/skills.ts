/**
 * Skill-Penta: der Spiegel deiner Spielstärke in fünf Fähigkeiten.
 *
 * Jede Ecke misst eine eigenständige, trainierbare Fähigkeit aus deinen eigenen analysierten Partien:
 * - Sicherheit: eigene Patzer je 30 Züge in noch offenen Stellungen (weniger ist besser)
 * - Taktik:     Anteil der gegnerischen Fehler, die du sofort bestrafst
 * - Eröffnung:  Genauigkeit in der Eröffnungsphase
 * - Strategie:  Genauigkeit der ruhigen Mittelspielzüge (ohne Patzer)
 * - Endspiel:   Genauigkeit im Endspiel (≤ 6 Figuren außer Bauern und Königen)
 *
 * Jeder Wert wird über echte Lichess-Partien (Rapid/Classical, 400–3200, Stockfish Tiefe 11 wie Rookie)
 * in eine **Elo-Entsprechung** übersetzt: „So sicher spielen Lichess-Spieler um 1150.“ Der Punktwert
 * 0–100 ist diese Entsprechung bezogen auf die Weltspitze (100 ≈ 2800). Die Gewichte sagen, wie stark
 * eine Fähigkeit mit der Wertung zusammenhängt – daraus die erwartete Wirkung einer Verbesserung.
 * Eichung: scripts/research/skill-study.mjs, skill-fit.mjs; Befunde in docs/research-2026-11-13.md.
 *
 * Reine Funktionen – testbar ohne Datenbank.
 */
import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { accuracy, whiteWin, type PlyEval } from '#lib/analysis/classify.js';
import { phasesByMaterial } from './gamestats.js';

export type Skill = 'safety' | 'tactics' | 'opening' | 'strategy' | 'endgame';

/** Reihenfolge im Fünfeck: oben Sicherheit, im Uhrzeigersinn */
export const SKILLS: Skill[] = ['safety', 'tactics', 'endgame', 'strategy', 'opening'];

/** Weltspitze: 100 Punkte */
export const ELITE = 2800;

/** Verlust an Gewinnchance (Prozentpunkte) pro Zug je Kategorie – siehe skill-study.mjs */
export type LossPerMove = Record<Skill, number>;

/**
 * Lichess-Werte je Band (r = mittlere Wertung, Rapid/Classical, Oktober 2026), monoton geglättet.
 * safety = Patzer je 30 Züge, tactics = % sofort bestrafter Gegnerfehler, sonst Genauigkeit in % in
 * offenen Stellungen (15–85 % Gewinnchance). lpm = verlorene Gewinnchance pro Zug je Kategorie
 * (Prozentpunkte; Taktik pro Chance, Sicherheit pro Zug in offener Stellung, Phasen pro ruhigem Zug).
 */
export const SKILL_TABLE: {
	r: number;
	safety: number;
	tactics: number;
	opening: number;
	strategy: number;
	endgame: number;
	lpm: LossPerMove;
}[] = [
	{
		r: 506,
		safety: 5.41,
		tactics: 41.3,
		opening: 64.4,
		strategy: 84.5,
		endgame: 66.9,
		lpm: { safety: 3.772, tactics: 19.128, opening: 3.217, strategy: 3.893, endgame: 2.557 }
	},
	{
		r: 716,
		safety: 5.04,
		tactics: 45.5,
		opening: 69.7,
		strategy: 84.7,
		endgame: 66.9,
		lpm: { safety: 3.672, tactics: 16.511, opening: 3.004, strategy: 3.893, endgame: 2.557 }
	},
	{
		r: 900,
		safety: 4.03,
		tactics: 48.3,
		opening: 77.9,
		strategy: 84.9,
		endgame: 76.4,
		lpm: { safety: 2.881, tactics: 14.697, opening: 2.715, strategy: 3.719, endgame: 2.047 }
	},
	{
		r: 1106,
		safety: 3.52,
		tactics: 52.8,
		opening: 80.7,
		strategy: 86.4,
		endgame: 77.6,
		lpm: { safety: 2.49, tactics: 11.142, opening: 2.506, strategy: 3.198, endgame: 2.047 }
	},
	{
		r: 1300,
		safety: 3.06,
		tactics: 56.9,
		opening: 83.4,
		strategy: 87,
		endgame: 77.6,
		lpm: { safety: 2.283, tactics: 10.389, opening: 2.274, strategy: 3.079, endgame: 2.047 }
	},
	{
		r: 1503,
		safety: 2.93,
		tactics: 56.9,
		opening: 84.5,
		strategy: 87.2,
		endgame: 77.6,
		lpm: { safety: 2.069, tactics: 9.704, opening: 2.137, strategy: 3.079, endgame: 2.047 }
	},
	{
		r: 1697,
		safety: 2.59,
		tactics: 59.3,
		opening: 86.9,
		strategy: 88.6,
		endgame: 79.8,
		lpm: { safety: 1.752, tactics: 9.335, opening: 1.979, strategy: 2.726, endgame: 2.006 }
	},
	{
		r: 1886,
		safety: 2.05,
		tactics: 60.9,
		opening: 88.6,
		strategy: 88.6,
		endgame: 84.1,
		lpm: { safety: 1.367, tactics: 7.78, opening: 1.834, strategy: 2.624, endgame: 1.91 }
	},
	{
		r: 2089,
		safety: 1.79,
		tactics: 62,
		opening: 90.5,
		strategy: 88.7,
		endgame: 86.6,
		lpm: { safety: 1.236, tactics: 7.683, opening: 1.597, strategy: 2.624, endgame: 1.62 }
	},
	{
		r: 2276,
		safety: 1.14,
		tactics: 69.4,
		opening: 92.9,
		strategy: 90.7,
		endgame: 88.2,
		lpm: { safety: 0.744, tactics: 5.923, opening: 1.362, strategy: 2.169, endgame: 1.62 }
	},
	{
		r: 2472,
		safety: 0.55,
		tactics: 73.9,
		opening: 95.7,
		strategy: 93,
		endgame: 94.5,
		lpm: { safety: 0.371, tactics: 4.732, opening: 0.842, strategy: 1.588, endgame: 0.84 }
	},
	{
		r: 2914,
		safety: 0.03,
		tactics: 79.5,
		opening: 98.6,
		strategy: 97.9,
		endgame: 98.5,
		lpm: { safety: 0.023, tactics: 2.736, opening: 0.31, strategy: 0.479, endgame: 0.297 }
	}
];

/** Züge je Partie in jeder Kategorie (Mittel aller Bänder) – wenn eigene Daten fehlen */
export const MEAN_COUNT: Record<Skill, number> = {
	safety: 28.2,
	tactics: 3.5,
	opening: 9.4,
	strategy: 6.0,
	endgame: 6.8
};

/**
 * 1 Prozentpunkt weniger verlorene Gewinnchance pro Partie ≈ so viele Elo:
 * (2276 − 506) / (244,1 − 78,5) über die Bänder 500–2300 (skill-fit.mjs).
 */
export const ELO_PER_POINT = 10.7;

/**
 * Mindestmengen, ab denen eine Ecke gezeigt wird. Geprüft an 139 echten Lichess-Spielern, die nicht in der
 * Eichung stecken (Holdout, Produkt-Review 14.11.2026): Raten (immer den Mittelwert) liegt im Mittel 500 Elo
 * daneben. Darunter war z. B. Taktik mit 10–19 Gegnerfehlern 621 Elo daneben – schlechter als Raten.
 * Ab diesen Mengen liegt jede Ecke im Mittel unter ~440 Elo daneben, das Gesamtniveau ab ~12 Partien bei ~230.
 */
export const MIN_SAMPLE: Record<Skill, number> = {
	safety: 250, // Züge in offener Stellung (≈ 9 Partien) – MAE 307, ab 400: 232
	tactics: 35, // Fehler des Gegners (≈ 10 Partien) – MAE 437, ab 60: 329
	opening: 60, // Eröffnungszüge (≈ 6 Partien) – MAE 232
	strategy: 150, // ruhige Mittelspielzüge (≈ 25 Partien) – MAE 271
	endgame: 80 // Endspielzüge (≈ 12 Partien) – MAE 293
};

/** unterste Elo-Entsprechung beim Fortschreiben unter das erste Band (400–600) */
export const FLOOR = 300;

/** ab diesem Anteil der verlorenen Gewinnchance durch Patzer ist eine Phase vor allem ein Sicherheitsproblem */
export const BLUNDER_SHARE = 0.5;

/** so viele jüngste analysierte Partien fließen ein */
export const WINDOW = 30;
/**
 * Reicht das für eine Ecke nicht (Stellungsspiel um 1000: nur ~3 ruhige Mittelspielzüge je Partie, Endspiel
 * ~2 – Holdout-Daten), nimmt diese Ecke ältere Partien dazu, bis zu so vielen.
 */
export const WINDOW_MAX = 100;

// ───────── Rohdaten aus eigenen Partien ─────────

export interface SkillSample {
	/** gepoolter Wert (siehe SKILL_TABLE) oder null */
	value: number | null;
	/** Stichprobengröße (Züge bzw. Chancen) */
	n: number;
	/** Werte je Partie – für den Zufallsbereich */
	perGame: number[];
}

export type SkillRaw = Record<Skill, SkillSample> & {
	games: number;
	/** eigene Züge je Partie in jeder Kategorie (für die Elo-Wirkung) */
	perGameCount: Record<Skill, number>;
	/**
	 * Anteil der verlorenen Gewinnchance in Eröffnung und Endspiel, der auf Patzer geht (0..1, null = keine
	 * Daten). Unter ~1800 ist die Genauigkeit ohne Patzer in beiden Phasen fast gleich (Lichess-Daten) –
	 * schwache Werte dort sind meist eingestellte Figuren, und dagegen hilft der Blunder-Check, kein Kurs.
	 */
	blunderShare: { opening: number | null; endgame: number | null };
	/** aus wie vielen Partien jede Ecke stammt (Standard: games; mehr, wenn das Fenster erweitert wurde) */
	windowGames?: Partial<Record<Skill, number>>;
};

/** Gewinnchance (0..1) aus Sicht von `side` */
const winFor = (e: PlyEval, side: 'white' | 'black') =>
	side === 'white' ? whiteWin(e) : 1 - whiteWin(e);

/**
 * Sammelt die fünf Messwerte aus den jüngsten analysierten eigenen Partien –
 * genau wie scripts/research/skill-study.mjs, damit die Eichung passt.
 */
export function collectSkills(games: GameRow[], window = WINDOW): SkillRaw {
	const recent = games
		.filter((g) => g.analysis?.done && g.analysis.evals.length > 2)
		.sort((a, b) => b.date - a.date)
		.slice(0, window);
	const acc = {
		live: 0,
		blunders: 0,
		chances: 0,
		taken: 0,
		opening: [0, 0],
		strategy: [0, 0],
		endgame: [0, 0],
		/** Verlust durch Patzer je Phase (Eröffnung, Endspiel) */
		blunderLoss: { opening: 0, endgame: 0 }
	};
	const cnt: Record<Skill, number> = { safety: 0, tactics: 0, opening: 0, strategy: 0, endgame: 0 };
	const per: Record<Skill, number[]> = {
		safety: [],
		tactics: [],
		opening: [],
		strategy: [],
		endgame: []
	};
	for (const g of recent) {
		let game: Game;
		try {
			game = Game.fromUciMoves(g.moves, g.startFen);
		} catch {
			continue;
		}
		const evals = g.analysis!.evals as PlyEval[];
		const fens = Array.from({ length: game.ply + 1 }, (_, i) => game.fenAt(i));
		const phases = phasesByMaterial(fens);
		const n = Math.min(game.moves.length, evals.length - 1);
		const loss: number[] = [];
		for (let i = 0; i < n; i++) {
			const mover = i % 2 === 0 ? turnOf(fens[0]) : other(turnOf(fens[0]));
			const before = evals[i];
			const after = evals[i + 1];
			const l =
				game.moves[i].uci === before.best
					? 0
					: Math.max(0, winFor(before, mover) - winFor(after, mover)) * 2;
			loss.push(l);
		}
		const g1 = { live: 0, blunders: 0, chances: 0, taken: 0 };
		const ph = { opening: [0, 0], strategy: [0, 0], endgame: [0, 0] };
		for (let i = 0; i < n; i++) {
			const mover = i % 2 === 0 ? turnOf(fens[0]) : other(turnOf(fens[0]));
			if (mover !== g.myColor) continue;
			const l = loss[i];
			const w = winFor(evals[i], mover);
			if (w >= 0.2) {
				g1.live++;
				if (l >= 0.3) g1.blunders++;
			}
			// Genauigkeit nur in offenen Stellungen (wie die Eichung)
			const open = w >= 0.15 && w <= 0.85;
			const p = phases[i];
			if (open && p === 'opening') {
				add(ph.opening, l);
				if (l >= 0.3) acc.blunderLoss.opening += l;
			} else if (open && p === 'middlegame') {
				if (l < 0.3) add(ph.strategy, l);
			} else if (open && p === 'endgame') {
				add(ph.endgame, l);
				if (l >= 0.3) acc.blunderLoss.endgame += l;
			}
			const chance = i > 0 && loss[i - 1] >= 0.2;
			if (chance) {
				g1.chances++;
				if (l < 0.1) g1.taken++;
				cnt.tactics++;
			} else {
				if (w >= 0.2) cnt.safety++;
				if (!(w >= 0.2 && l >= 0.3) && open)
					cnt[p === 'opening' ? 'opening' : p === 'middlegame' ? 'strategy' : 'endgame']++;
			}
		}
		acc.live += g1.live;
		acc.blunders += g1.blunders;
		acc.chances += g1.chances;
		acc.taken += g1.taken;
		for (const k of ['opening', 'strategy', 'endgame'] as const) {
			acc[k][0] += ph[k][0];
			acc[k][1] += ph[k][1];
			if (ph[k][1] >= 5) per[k].push(accuracy(Array(ph[k][1]).fill(ph[k][0] / ph[k][1])));
		}
		if (g1.live >= 10) per.safety.push((g1.blunders / g1.live) * 30);
		if (g1.chances >= 2) per.tactics.push((g1.taken / g1.chances) * 100);
	}
	const accOf = (x: number[]) => (x[1] ? accuracy(Array(x[1]).fill(x[0] / x[1])) : null);
	const shareOf = (k: 'opening' | 'endgame') =>
		acc[k][0] > 0 ? acc.blunderLoss[k] / acc[k][0] : null;
	const nGames = recent.length;
	return {
		games: nGames,
		blunderShare: { opening: shareOf('opening'), endgame: shareOf('endgame') },
		perGameCount: Object.fromEntries(
			SKILLS.map((k) => [k, nGames ? cnt[k] / nGames : MEAN_COUNT[k]])
		) as Record<Skill, number>,
		safety: {
			value: acc.live ? (acc.blunders / acc.live) * 30 : null,
			n: acc.live,
			perGame: per.safety
		},
		tactics: {
			value: acc.chances ? (acc.taken / acc.chances) * 100 : null,
			n: acc.chances,
			perGame: per.tactics
		},
		opening: { value: accOf(acc.opening), n: acc.opening[1], perGame: per.opening },
		strategy: { value: accOf(acc.strategy), n: acc.strategy[1], perGame: per.strategy },
		endgame: { value: accOf(acc.endgame), n: acc.endgame[1], perGame: per.endgame }
	};
}

/**
 * Wie collectSkills, aber Ecken mit zu wenig Daten in den letzten WINDOW Partien greifen auf bis zu
 * WINDOW_MAX Partien zurück – sonst bleibt z. B. Stellungsspiel bei Einsteigern trotz vieler Partien leer.
 */
export function collectSkillsAdaptive(games: GameRow[]): SkillRaw {
	const raw = collectSkills(games, WINDOW);
	const short = SKILLS.filter((k) => raw[k].n < MIN_SAMPLE[k]);
	if (!short.length || raw.games < WINDOW) return raw;
	const wide = collectSkills(games, WINDOW_MAX);
	if (wide.games <= raw.games) return raw;
	const out: SkillRaw = { ...raw, windowGames: {}, blunderShare: { ...raw.blunderShare } };
	for (const k of short) {
		out[k] = wide[k];
		out.windowGames![k] = wide.games;
		if (k === 'opening' || k === 'endgame') out.blunderShare[k] = wide.blunderShare[k];
	}
	return out;
}

function add(x: number[], l: number) {
	x[0] += l;
	x[1]++;
}
const turnOf = (fen: string): 'white' | 'black' => (fen.split(' ')[1] === 'b' ? 'black' : 'white');
const other = (c: 'white' | 'black') => (c === 'white' ? 'black' : 'white');

// ───────── Spiegel: Elo-Entsprechung, Punkte, Empfehlung ─────────

/** Sicherheit: weniger ist besser; alles andere: mehr ist besser */
const higherIsBetter = (s: Skill) => s !== 'safety';

/**
 * Elo-Entsprechung eines Werts (linear zwischen den Bändern). Oben begrenzt; unter dem ersten Band (≈ 500)
 * mit der Steigung der ersten beiden Bänder fortgeschrieben bis FLOOR – sonst landet jeder Neuling bei ≈ 500
 * oder höher (Holdout: Band 400–600 im Mittel +350 zu hoch).
 */
export function eloFor(skill: Skill, v: number, table = SKILL_TABLE): number {
	if (!table.length) return 0;
	const xs = table.map((t) => t[skill]);
	const better = (a: number, b: number) => (higherIsBetter(skill) ? a >= b : a <= b);
	if (!better(v, xs[0])) {
		const [a, b] = [xs[0], xs[1]];
		if (b === undefined || a === b) return table[0].r;
		const slope = (table[1].r - table[0].r) / (b - a);
		return Math.max(FLOOR, table[0].r + (v - a) * slope);
	}
	if (better(v, xs[xs.length - 1])) return table[table.length - 1].r;
	for (let i = 1; i < xs.length; i++) {
		const a = xs[i - 1];
		const b = xs[i];
		if ((v - a) * (v - b) <= 0 && a !== b)
			return table[i - 1].r + ((v - a) / (b - a)) * (table[i].r - table[i - 1].r);
	}
	return table[table.length - 1].r;
}

/** Wert, den Spieler mit dieser Wertung im Schnitt haben (Umkehrung von eloFor) */
export function valueAt(skill: Skill, elo: number, table = SKILL_TABLE): number {
	if (!table.length) return 0;
	if (elo <= table[0].r) return table[0][skill];
	if (elo >= table[table.length - 1].r) return table[table.length - 1][skill];
	const i = table.findIndex((t) => t.r >= elo);
	const f = (elo - table[i - 1].r) / (table[i].r - table[i - 1].r);
	return table[i - 1][skill] + f * (table[i][skill] - table[i - 1][skill]);
}

export const scoreFor = (elo: number) =>
	Math.max(0, Math.min(100, Math.round((elo / ELITE) * 100)));
const r25 = (x: number) => Math.round(x / 25) * 25;

export interface SkillValue {
	skill: Skill;
	/** 0–100 (100 ≈ Weltspitze), null = noch zu wenig Daten */
	score: number | null;
	/** Elo-Entsprechung (gerundet auf 25) */
	elo: number | null;
	/** Zufallsbereich der Elo-Entsprechung (±1 Standardfehler) */
	low: number | null;
	high: number | null;
	/** Messwert (Patzer/30, % genutzt oder Genauigkeit %) */
	value: number | null;
	/** Stichprobe und was bis zur Mindestmenge fehlt */
	n: number;
	missing: number;
	/** aus so vielen Partien */
	games: number;
}

export function skillMirror(raw: SkillRaw, table = SKILL_TABLE): SkillValue[] {
	return SKILLS.map((skill) => {
		const s = raw[skill];
		const games = raw.windowGames?.[skill] ?? raw.games;
		const missing = Math.max(0, MIN_SAMPLE[skill] - s.n);
		if (s.value === null || missing > 0 || !table.length)
			return {
				skill,
				score: null,
				elo: null,
				low: null,
				high: null,
				value: s.value,
				n: s.n,
				missing,
				games
			};
		const elo = eloFor(skill, s.value, table);
		// Standardfehler aus der Streuung zwischen den Partien
		const xs = s.perGame;
		let se = 0;
		if (xs.length >= 3) {
			const m = xs.reduce((a, b) => a + b, 0) / xs.length;
			se = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length);
		}
		const e1 = eloFor(skill, s.value + se, table);
		const e2 = eloFor(skill, s.value - se, table);
		return {
			skill,
			score: scoreFor(elo),
			elo: r25(elo),
			low: r25(Math.min(e1, e2)),
			high: r25(Math.max(e1, e2)),
			value: s.value,
			n: s.n,
			missing: 0,
			games
		};
	});
}

/** typischer Verlust pro Zug bei einer Wertung (interpoliert) */
export function lossPerMoveAt(skill: Skill, elo: number, table = SKILL_TABLE): number {
	if (elo <= table[0].r) return table[0].lpm[skill];
	if (elo >= table[table.length - 1].r) return table[table.length - 1].lpm[skill];
	const i = table.findIndex((t) => t.r >= elo);
	const f = (elo - table[i - 1].r) / (table[i].r - table[i - 1].r);
	return table[i - 1].lpm[skill] + f * (table[i].lpm[skill] - table[i - 1].lpm[skill]);
}

/** verlorene Gewinnchance je Partie eines typischen Spielers dieser Wertung (Prozentpunkte) */
function totalLossAt(elo: number, table = SKILL_TABLE): number {
	return SKILLS.reduce((s, k) => s + lossPerMoveAt(k, elo, table) * MEAN_COUNT[k], 0);
}

/**
 * Gesamtniveau: Wie viel Gewinnchance verlierst du pro Partie, wenn jede Fähigkeit so ist wie gemessen?
 * Die Wertung, bei der typische Spieler genauso viel verlieren, ist dein Niveau. So zählt jede Ecke so
 * stark, wie sie in echten Partien Punkte kostet. Ecken ohne Daten nehmen den Mittelwert der anderen an.
 */
export function overallLevel(values: SkillValue[], table = SKILL_TABLE) {
	const known = values.filter((v) => v.elo !== null);
	if (known.length < 3 || !table.length) return null;
	const avg = known.reduce((s, v) => s + v.elo!, 0) / known.length;
	const loss = SKILLS.reduce((s, k) => {
		const v = values.find((x) => x.skill === k);
		return s + lossPerMoveAt(k, v?.elo ?? avg, table) * MEAN_COUNT[k];
	}, 0);
	// Wertung mit genau diesem Gesamtverlust (Verlust fällt mit der Wertung)
	const totals = table.map((t) => totalLossAt(t.r, table));
	let elo = table[table.length - 1].r;
	if (loss >= totals[0]) elo = table[0].r;
	else
		for (let i = 1; i < table.length; i++)
			if (loss >= totals[i]) {
				const f = (totals[i - 1] - loss) / (totals[i - 1] - totals[i]);
				elo = table[i - 1].r + f * (table[i].r - table[i - 1].r);
				break;
			}
	return { elo: r25(elo), score: scoreFor(elo) };
}

/** Anteil jeder Fähigkeit am Unterschied zwischen einer Wertung und 200 darüber (0..1) */
export function shareAt(elo: number, table = SKILL_TABLE): Record<Skill, number> {
	const d = SKILLS.map(
		(k) => (lossPerMoveAt(k, elo, table) - lossPerMoveAt(k, elo + 200, table)) * MEAN_COUNT[k]
	);
	const tot = d.reduce((a, b) => a + Math.max(0, b), 0) || 1;
	return Object.fromEntries(SKILLS.map((k, i) => [k, Math.max(0, d[i]) / tot])) as Record<
		Skill,
		number
	>;
}

export interface Advice {
	skill: Skill;
	/** Ziel: Elo-Entsprechung und Messwert, den Spieler dort im Schnitt haben */
	target: number;
	targetValue: number;
	/** erwarteter Zuwachs in Elo (gerundet auf 25) */
	gain: number;
	/** so viel Gewinnchance pro Partie verlierst du dann weniger (Prozentpunkte) */
	points: number;
	/** Eröffnung/Endspiel: der Verlust dort sind vor allem Patzer → zuerst Sicherheit trainieren */
	viaSafety: boolean;
}

/** Kommt der Verlust in dieser Phase vor allem von Patzern? (dann hilft der Blunder-Check, kein Kurs) */
export function mostlyBlunders(skill: Skill, raw: Pick<SkillRaw, 'blunderShare'>): boolean {
	if (skill !== 'opening' && skill !== 'endgame') return false;
	const share = raw.blunderShare?.[skill];
	return share !== null && share !== undefined && share >= BLUNDER_SHARE;
}

/**
 * Was bringt am meisten? Ziel je Ecke: eine Stufe über dir (deine Entsprechung + 200, mindestens dein
 * Gesamtniveau + 100). Zuwachs = weniger verlorene Gewinnchance pro Zug × deine Züge dieser Art pro
 * Partie × ELO_PER_POINT. So zählt, was in _deinen_ Partien wirklich vorkommt.
 */
export function adviceFor(values: SkillValue[], raw: SkillRaw, table = SKILL_TABLE): Advice[] {
	const all = overallLevel(values, table);
	if (!all) return [];
	return values
		.filter((v) => v.elo !== null)
		.map((v) => {
			const target = Math.min(ELITE, Math.max(v.elo! + 200, all.elo + 100));
			const points =
				(lossPerMoveAt(v.skill, v.elo!, table) - lossPerMoveAt(v.skill, target, table)) *
				(raw.perGameCount[v.skill] || MEAN_COUNT[v.skill]);
			return {
				skill: v.skill,
				target: r25(target),
				targetValue: valueAt(v.skill, target, table),
				// auf 25 gerundet: das Niveau selbst ist nur auf ±230 Elo genau (Holdout), mehr wäre Scheingenauigkeit
				gain: Math.max(0, Math.round((points * ELO_PER_POINT) / 25) * 25),
				points: Math.round(points * 10) / 10,
				viaSafety: mostlyBlunders(v.skill, raw)
			};
		})
		.sort((a, b) => b.gain - a.gain || SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill));
}

/** Gesamtniveau aus den eigenen Partien – für die Spielstärke (lib/training/strength.ts) */
export function gameLevel(games: GameRow[]): { elo: number; games: number } | null {
	const raw = collectSkillsAdaptive(games);
	const all = overallLevel(skillMirror(raw));
	return all ? { elo: all.elo, games: raw.games } : null;
}
