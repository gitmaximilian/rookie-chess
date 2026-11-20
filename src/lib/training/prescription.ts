/**
 * Die Verordnung des Coachs: Was trainierst du diese Woche, wie viel, und woran merkst du, dass es wirkt?
 * Weg von Angeboten hin zu einer klaren Dosis je Niveau (docs/coach-plan-2026-11-20.md).
 *
 * Herleitung (docs/research-2026-11-13.md, Nachtrag 20.11.2026 – Korrelationen, keine Experimente):
 * - **Partien je Woche:** 883 neue Lichess-Konten bei 550–1050 Rapid (Okt. 2025), nach ~13 Monaten: unter 2
 *   Partien/Woche +5 Elo (Median), 2–4 → +47, 4–8 → +137, 8–15 → +165, darüber +231 – ab ~8 flacht es ab.
 *   Deshalb mindestens 3, ab 30 min/Tag 4 und höchstens 8 Partien.
 * - **Puzzles:** bei gleicher Partienzahl (~400–480) +71 mit < 100 Puzzles, +173 mit 100–1000, +289 mit > 1000.
 *   Deshalb jeden Trainingstag Puzzles (≈ 4–5 am Tag sind über 1000 im Jahr).
 * - **Rapid statt Blitz:** Wer mehr Blitz/Bullet als Rapid spielt, gewann +96 statt +157.
 * - **Aufteilung:** ~45 % Spielen, 5 min Besprechen je Partie, ≤ 15 % Theorie, der Rest Abrufen (Blunder-Check,
 *   Brett-Scan, Taktik, eigene Fehler). Selbststudium ist der stärkste Prädiktor (Charness et al. 2005); die
 *   Gewichte sind eine Folgerung, kein Experiment.
 * - **Innerhalb des Abrufens:** Sicherheit gegen Taktik nach den Lichess-Anteilen am Abstand zum nächsten Band
 *   (skills.ts `shareAt`).
 * - **Zeitkontrolle:** 10+5 (häufigster Lichess-Rapid-Pool). 15+10 erst, wenn Patzer der Engpass sind und die
 *   Wertung steht – mehr Zeit für den Blunder-Check (Trainer-Erfahrung, keine Studie).
 * - **Sechs Trainingstage:** Ein verpasster Tag schadet der Gewohnheit nicht (Lally et al. 2010).
 *
 * Reine Funktionen – testbar ohne Datenbank.
 */
import { priorities, stageFor, type StageId } from './levels.js';
import { valueAt } from './skills.js';
import { GOAL, nextMilestone } from './strength.js';

/** Trainingstage pro Woche */
export const DAYS_PER_WEEK = 6;
/** Anteil der Woche fürs Spielen (ohne Besprechen) */
export const PLAY_SHARE = 0.45;
/** Theorie-Anteil je Stufe (Eröffnung, Stellungsspiel, Endspiel – erst ab 1200 spürbar, Lichess-Daten) */
export const THEORY_SHARE: Record<StageId, number> = {
	foundation: 0.1,
	vision: 0.1,
	solid: 0.15,
	plans: 0.2
};
/** Besprechen je Partie (Minuten): eigene Patzer zuerst, dann verpasste Chancen */
export const REVIEW_MINUTES = 5;
/** Minuten je Aufgabe (wie plan.ts `minutesOf`) */
const PUZZLE_MIN = 1.2;
const SAFETY_MIN = 0.7;
const LESSON_MIN = 6;
/** typische Dauer einer Partie (Annahme: etwa zwei Drittel der vollen Bedenkzeit beider Seiten) */
export const GAME_MINUTES = { '15+10': 25, '10+5': 20 } as const;
export type TimeControl = keyof typeof GAME_MINUTES;

export const MIN_GAMES = 3;
export const MAX_SAFETY = 8;
export const MAX_LESSONS = 5;
/** mindestens so viele Puzzles am Trainingstag (≈ 1250 im Jahr) */
export const MIN_PUZZLES = 4;
export const MAX_GAMES = 8;

export interface Recipe {
	stage: StageId;
	minutesPerDay: number;
	timeControl: TimeControl;
	/** Partien pro Woche (Rapid gegen Menschen; ohne Konto gegen Bots) */
	games: number;
	/** pro Trainingstag */
	puzzles: number;
	safety: number;
	/** Brett-Scan-Stellungen pro Tag (nur unter 1200) */
	scan: number;
	/** Lektionen (Eröffnung, Stellungsspiel, Endspiel) pro Woche */
	lessons: number;
	/** Minuten pro Woche je Baustein – für die Erklärung */
	split: { play: number; review: number; drill: number; theory: number };
}

/** Die Dosis für deine Stufe und dein Zeitbudget */
export function recipeFor(strength: number | null, minutesPerDay: number, slow = false): Recipe {
	const stage = stageFor(strength).id;
	const elo = strength ?? 600;
	const week = Math.max(10, minutesPerDay) * DAYS_PER_WEEK;
	const timeControl: TimeControl = slow ? '15+10' : '10+5';
	const perGame = GAME_MINUTES[timeControl] + REVIEW_MINUTES;
	const games = Math.max(
		MIN_GAMES,
		Math.min(MAX_GAMES, Math.round((week * PLAY_SHARE) / GAME_MINUTES[timeControl]))
	);
	const theory = Math.round(week * THEORY_SHARE[stage]);
	const drill = Math.max(0, week - games * perGame - theory);
	const perDay = drill / DAYS_PER_WEEK;
	// Sicherheit gegen Taktik nach den Lichess-Anteilen (Eröffnung, Stellungsspiel, Endspiel stecken in der Theorie)
	const pr = Object.fromEntries(priorities(strength).map((p) => [p.skill, p.share]));
	const safetyShare = pr.safety / Math.max(0.01, pr.safety + pr.tactics);
	const scan = elo < 1200 ? 3 : 0;
	// Puzzles zuerst (Lichess: Puzzle-Menge hängt am stärksten mit dem Aufstieg zusammen), mindestens vier am
	// Tag; Blunder-Checks aus dem Rest, 3–8 am Tag (danach lässt die Aufmerksamkeit nach – Annahme).
	// Lektionen abgerundet, damit die Theorie ihr Budget nicht überzieht; übrige Minuten gehen in Taktik.
	const lessons = Math.max(1, Math.min(MAX_LESSONS, Math.floor(theory / LESSON_MIN)));
	const spare = Math.max(0, theory - lessons * LESSON_MIN) / DAYS_PER_WEEK;
	const puzzles = Math.max(
		MIN_PUZZLES,
		Math.round(((perDay - scan) * (1 - safetyShare) + spare) / PUZZLE_MIN)
	);
	const safety = Math.max(
		3,
		Math.min(MAX_SAFETY, Math.round((perDay - scan - puzzles * PUZZLE_MIN + spare) / SAFETY_MIN))
	);
	return {
		stage,
		minutesPerDay,
		timeControl,
		games,
		puzzles,
		safety,
		scan,
		lessons,
		split: {
			play: games * GAME_MINUTES[timeControl],
			review: games * REVIEW_MINUTES,
			drill,
			theory
		}
	};
}

// ───────── Diese Woche ─────────

/** Montag 0:00 der Woche, in der `now` liegt (Ortszeit) */
export function weekStart(now: number): number {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	const dow = (d.getDay() + 6) % 7; // Montag = 0
	d.setDate(d.getDate() - dow);
	return d.getTime();
}

export interface WeekInput {
	/** Partien dieser Woche, die als Lernpartie zählen (id, Datum) */
	games: { id: number; date: number }[];
	/** besprochene Partien (ids) */
	reviewed: number[];
	/** gelöste Puzzles je Tag dieser Woche (Summe) */
	puzzles: number;
	/** Blunder-Checks dieser Woche */
	safety: number;
}

export interface WeekProgress {
	games: { done: number; target: number };
	reviewed: { done: number; target: number };
	puzzles: { done: number; target: number };
	safety: { done: number; target: number };
	/** Anteil der Wochendosis (0..1), gewichtet nach Minuten */
	share: number;
}

export function weekProgress(r: Recipe, w: WeekInput): WeekProgress {
	const games = { done: w.games.length, target: r.games };
	const reviewed = {
		done: w.games.filter((g) => w.reviewed.includes(g.id)).length,
		target: Math.min(r.games, Math.max(1, w.games.length))
	};
	const puzzles = { done: w.puzzles, target: r.puzzles * DAYS_PER_WEEK };
	const safety = { done: w.safety, target: r.safety * DAYS_PER_WEEK };
	const part = (x: { done: number; target: number }, min: number) =>
		Math.min(1, x.target ? x.done / x.target : 1) * min;
	// Lektionen haben keinen Zeitstempel je Woche – die Wochendosis misst Spielen, Besprechen und Üben
	const total = r.split.play + r.split.review + r.split.drill || 1;
	const drillPuzzle = r.puzzles * PUZZLE_MIN;
	const drillSafety = r.safety * SAFETY_MIN;
	const drillShare = drillPuzzle + drillSafety || 1;
	const share =
		(part(games, r.split.play) +
			part(reviewed, r.split.review) +
			part(puzzles, (r.split.drill * drillPuzzle) / drillShare) +
			part(safety, (r.split.drill * drillSafety) / drillShare)) /
		total;
	return { games, reviewed, puzzles, safety, share: Math.round(share * 100) / 100 };
}

// ───────── Weg zu 1600 ─────────

export interface Path {
	strength: number;
	goal: number;
	progress: number;
	/** Patzer je 30 Züge: deiner und der typische Wert von Spielern auf dem Etappenziel */
	blunders: number | null;
	blundersAtGoal: number;
	/** Patzer sind das Haupthindernis (über dem Wert der Etappe) */
	blunderGap: boolean;
	reached: boolean;
}

export function pathTo1600(strength: number | null, blundersPer30: number | null): Path | null {
	if (strength === null) return null;
	const m = nextMilestone(strength);
	const at = Math.round(valueAt('safety', m.goal) * 10) / 10;
	return {
		strength,
		goal: m.goal,
		progress: m.progress,
		blunders: blundersPer30,
		blundersAtGoal: at,
		blunderGap: blundersPer30 !== null && blundersPer30 > at,
		reached: strength >= GOAL
	};
}

// ───────── Anpassen: Was ändert der Coach, wenn es nicht vorangeht? ─────────

export type Adjustment =
	/** zu wenig gespielt: Partien sind Test und Fehlerquelle */
	| { kind: 'play-more'; played: number; target: number }
	/** gespielt, aber kaum besprochen */
	| { kind: 'review-first'; reviewed: number; played: number }
	/** Wertung tritt auf der Stelle, Patzer über dem Etappenwert → langsamer spielen, mehr Blunder-Check */
	| { kind: 'slow-down'; days: number }
	/** Wertung tritt auf der Stelle, Patzer schon ok → Taktik nach vorn */
	| { kind: 'more-tactics'; days: number }
	/** es geht voran: Kurs halten */
	| { kind: 'on-track'; gain: number }
	/** noch zu wenig Daten für ein Urteil */
	| { kind: 'none' };

/** Zeitraum für das Urteil „tritt auf der Stelle“ */
export const STALL_DAYS = 42;
/** so viele Partien braucht das Urteil mindestens */
export const STALL_GAMES = 8;
/** weniger Zuwachs gilt als Stillstand (Lichess-Wertung schwankt um ±30 bei 10 Partien) */
export const STALL_GAIN = 30;

export interface AdjustInput {
	recipe: Recipe;
	/** Lernpartien der letzten 14 Tage und davon besprochen */
	games14: number;
	reviewed14: number;
	/** Wertungsverlauf (gewertete Rapid-Partien), älteste zuerst */
	ratings: { date: number; rating: number }[];
	path: Path | null;
	now: number;
}

export function adjust(i: AdjustInput): Adjustment {
	if (i.games14 < i.recipe.games)
		return { kind: 'play-more', played: i.games14, target: i.recipe.games * 2 };
	if (i.reviewed14 * 2 < i.games14)
		return { kind: 'review-first', reviewed: i.reviewed14, played: i.games14 };
	const from = i.now - STALL_DAYS * 86_400_000;
	const window = i.ratings.filter((r) => r.date >= from);
	const before = [...i.ratings].reverse().find((r) => r.date < from);
	if (window.length < STALL_GAMES || !before) return { kind: 'none' };
	const gain = window[window.length - 1].rating - before.rating;
	if (gain >= STALL_GAIN) return { kind: 'on-track', gain };
	return i.path?.blunderGap
		? { kind: 'slow-down', days: STALL_DAYS }
		: { kind: 'more-tactics', days: STALL_DAYS };
}
