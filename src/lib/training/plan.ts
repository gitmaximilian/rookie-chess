/**
 * „Dein Training heute“: ein kurzer, persönlicher Tagesplan nach dem Rookie-Lernmodell
 * (docs/research-2026-11-13.md):
 *
 * 1. Sicherheit zuerst – Blunder-Check als Aufwärmen (Einsteiger verlieren die meisten Partien durch
 *    eingestellte Figuren und übersehene Ein-/Zweizüger).
 * 2. Eigene Fehler kommen mit Abständen wieder (1 → 3 → 8 → 22 Tage), bis sie sitzen.
 * 3. Gemischte Taktik mit ca. 80 % Erfolg; der Schwerpunkt bekommt zwei von drei Puzzles.
 * 4. Spielen mit Zeit (alle zwei Tage, ≈ 30 % der Zeit), danach die Partie besprechen.
 * 5. Theorie (Lektion, Eröffnung, Endspiel) nur, wenn im Zeitbudget Platz ist.
 *
 * Aufgaben werden nach Wichtigkeit ausgewählt, bis das Zeitbudget voll ist, und dann in einer
 * sinnvollen Reihenfolge gezeigt. Der Plan wird einmal pro Tag festgelegt (damit er sich nicht unter
 * den Fingern ändert), der Fortschritt wird jedes Mal frisch aus den Daten berechnet.
 */
import { BASICS } from '#lib/basics/lessons.js';
import { COURSES } from '#lib/openings/courses.js';
import { LESSONS } from '#lib/endgames/lessons.js';

export type PlanTask =
	| { id: string; kind: 'safety'; target: number }
	| { id: string; kind: 'mistakes'; target: number }
	| { id: string; kind: 'review'; target: number }
	| { id: string; kind: 'puzzles'; target: number; theme?: string }
	| { id: string; kind: 'repertoire'; target: number }
	| { id: string; kind: 'basics'; lesson: string }
	| { id: string; kind: 'course'; course: string; line: string }
	| { id: string; kind: 'endgame'; lesson: string }
	| { id: string; kind: 'game'; gameId: number }
	| { id: string; kind: 'play' }
	| { id: string; kind: 'checkup' };

export interface DailyPlan {
	day: string;
	tasks: PlanTask[];
}

/** Fälligkeiten zu Tagesbeginn – daran misst sich der Fortschritt der Wiederholungs-Aufgaben */
export interface PlanInitial {
	dueReview: number;
	dueRepertoire: number;
	dueMistakes?: number;
}

/** Was Rookie heute über dich weiß */
export interface PlanContext {
	day: string;
	/** fällige verfehlte Lichess-Puzzles */
	dueReview: number;
	dueRepertoire: number;
	/** fällige eigene Fehler (aus eigenen Partien) */
	dueMistakes: number;
	weakTheme: string | null;
	/** heute erledigte Puzzles – dieselbe Zahl wie beim Tagesziel */
	puzzlesToday: number;
	/** heute erledigte Blunder-Checks */
	safetyToday: number;
	/** Blunder-Check gehört in den Plan (Spielstärke < 1400 oder noch viele Patzer) */
	safetyFirst: boolean;
	/** Kontrolltest fällig / heute erledigt */
	checkupDue: boolean;
	checkupToday: boolean;
	basicsDone: string[];
	courseProgress: Record<string, Record<string, unknown>>;
	endgameStars: Record<string, number>;
	rulesKnown: 'no' | 'some' | 'yes' | null;
	focus: 'rules' | 'tactics' | 'play' | 'openings' | null;
	dailyGoal: number;
	/** jüngste eigene Partie mit Fehlern, die noch nicht nachgespielt wurde */
	gameToReview: number | null;
	reviewedGames: number[];
	/** Tage seit der letzten eigenen Partie (null = noch nie gespielt) */
	daysSinceGame: number | null;
	/** heute beendete Partien gegen Bots */
	gamesToday: number;
	/** geschätzte Spielstärke (null = unbekannt) – bestimmt, welche Lektionen schon passen */
	strength: number | null;
	/** Zeitbudget in Minuten */
	minutes: number;
}

/** ohne Schwerpunkt „Partien“: alle so viele Tage eine Partie */
export const PLAY_AFTER_DAYS = 2;
/** Standard-Zeitbudget (Minuten pro Tag) */
export const DEFAULT_MINUTES = 30;
/** höchstens so viele Aufgaben, damit der Plan überschaubar bleibt */
export const MAX_TASKS = 5;
/** Blunder-Checks pro Tag */
export const SAFETY_PER_DAY = 6;

/** geschätzte Minuten je Aufgabe (für das Zeitbudget und die Anzeige) */
export function minutesOf(task: PlanTask): number {
	switch (task.kind) {
		case 'safety':
			return Math.ceil(task.target * 0.7);
		case 'mistakes':
			return Math.max(1, Math.ceil(task.target * 1));
		case 'review':
			return Math.max(1, Math.ceil(task.target * 0.8));
		case 'puzzles':
			return Math.ceil(task.target * 1.2);
		case 'repertoire':
			return Math.max(1, Math.ceil(task.target * 0.5));
		case 'play':
			return 15;
		case 'game':
			// erst selbst suchen, dann nachspielen
			return 7;
		case 'checkup':
			return 6;
		case 'basics':
			return 6;
		case 'course':
			return 5;
		case 'endgame':
			return 8;
	}
}

/** höchste Lektionsstufe, die zur Spielstärke passt (1 = Grundlagen) */
export function levelFor(strength: number | null): 1 | 2 | 3 {
	if (strength === null || strength < 900) return 1;
	if (strength < 1200) return 2;
	return 3;
}

/** Nächster sinnvoller Lernschritt (Grundlagen → Endspiel/Kurs), passend zur Stufe */
function nextLesson(c: PlanContext): PlanTask | null {
	const basicsOpen = BASICS.find((l) => !c.basicsDone.includes(l.id));
	if (basicsOpen && (c.rulesKnown === 'no' || c.rulesKnown === 'some' || c.focus === 'rules'))
		return { id: `basics:${basicsOpen.id}`, kind: 'basics', lesson: basicsOpen.id };

	const max = levelFor(c.strength);
	const courseFirst = c.focus === 'openings';
	const course = () => {
		// angefangene Kurse zuerst fertig machen, sonst die einfachsten
		const ordered = [...COURSES]
			.filter((co) => co.level <= max || c.courseProgress[co.id])
			.sort(
				(a, b) =>
					Number(!c.courseProgress[a.id]) - Number(!c.courseProgress[b.id]) || a.level - b.level
			);
		for (const co of ordered) {
			const line = co.lines.find((l) => !c.courseProgress[co.id]?.[l.id]);
			if (line)
				return {
					id: `course:${co.id}:${line.id}`,
					kind: 'course',
					course: co.id,
					line: line.id
				} as const;
		}
		return null;
	};
	const endgame = () => {
		const l = [...LESSONS]
			.filter((x) => x.level <= max)
			.sort((a, b) => a.level - b.level)
			.find((x) => !c.endgameStars[x.id]);
		return l ? ({ id: `endgame:${l.id}`, kind: 'endgame', lesson: l.id } as const) : null;
	};
	return (courseFirst ? (course() ?? endgame()) : (endgame() ?? course())) ?? null;
}

/** Reihenfolge im Plan: Aufwärmen → Wiederholen → Taktik → Partie → Nacharbeit → Theorie */
const ORDER: PlanTask['kind'][] = [
	'checkup',
	'safety',
	'mistakes',
	'review',
	'puzzles',
	'game',
	'play',
	'repertoire',
	'basics',
	'course',
	'endgame'
];

export function buildPlan(c: PlanContext): DailyPlan {
	const n = Math.max(3, Math.min(c.dailyGoal, 10));
	const cand: { task: PlanTask; prio: number }[] = [];
	const add = (task: PlanTask, prio: number) => cand.push({ task, prio });
	const beginner = c.rulesKnown === 'no';

	if (beginner) {
		// erst die Regeln: Lektion und einfache Puzzles (Matt in 1 kommt in „Für dich“ von selbst)
		const lesson = nextLesson(c);
		if (lesson) add(lesson, 0);
		add({ id: 'puzzles', kind: 'puzzles', target: n }, 1);
	} else {
		if (c.checkupDue) add({ id: 'checkup', kind: 'checkup' }, 0.5);
		if (c.safetyFirst) add({ id: 'safety', kind: 'safety', target: SAFETY_PER_DAY }, 1);
		if (c.dueMistakes > 0)
			add({ id: 'mistakes', kind: 'mistakes', target: Math.min(c.dueMistakes, 5) }, 2);
		// Partie alle zwei Tage (≈ 4 pro Woche, ≈ 30 % der Zeit); Schwerpunkt „Partien“ macht sie
		// nur wichtiger – mehr spielen kann man jederzeit, der Plan hält Platz für Übung frei
		const play = c.daysSinceGame === null || c.daysSinceGame >= PLAY_AFTER_DAYS;
		if (play) add({ id: 'play', kind: 'play' }, c.focus === 'play' ? 1.5 : 2.6);
		if (c.gameToReview !== null && !c.reviewedGames.includes(c.gameToReview))
			add({ id: `game:${c.gameToReview}`, kind: 'game', gameId: c.gameToReview }, 3);
		add(
			c.weakTheme
				? { id: `puzzles:${c.weakTheme}`, kind: 'puzzles', target: n, theme: c.weakTheme }
				: { id: 'puzzles', kind: 'puzzles', target: n },
			c.focus === 'tactics' ? 2.4 : 2.8
		);
		if (c.dueReview > 0) add({ id: 'review', kind: 'review', target: Math.min(c.dueReview, 5) }, 6);
		if (c.dueRepertoire > 0)
			add(
				{ id: 'repertoire', kind: 'repertoire', target: Math.min(c.dueRepertoire, 8) },
				c.focus === 'openings' ? 3.5 : 7
			);
		const lesson = nextLesson(c);
		if (lesson) add(lesson, c.focus === 'openings' || c.focus === 'rules' ? 3.5 : 8);
	}

	// nach Wichtigkeit auswählen, bis das Zeitbudget voll ist (die wichtigste Aufgabe immer)
	const picked: PlanTask[] = [];
	let used = 0;
	for (const { task } of [...cand].sort((a, b) => a.prio - b.prio)) {
		if (picked.length >= MAX_TASKS) break;
		let t = task;
		// Taktik schrumpft bei knappem Budget lieber, als ganz zu entfallen (mindestens 3 Puzzles)
		if (t.kind === 'puzzles' && picked.length && used + minutesOf(t) > c.minutes) {
			const fit = Math.floor((c.minutes - used) / 1.2);
			if (fit >= 3) t = { ...t, target: Math.min(t.target, fit) };
		}
		const m = minutesOf(t);
		if (picked.length && used + m > c.minutes) continue;
		picked.push(t);
		used += m;
	}
	picked.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
	return { day: c.day, tasks: picked };
}

/** Fortschritt einer Aufgabe: 0 … target */
export function progressOf(
	task: PlanTask,
	c: PlanContext,
	initial: PlanInitial
): { done: number; target: number } {
	const fromDue = (start: number | undefined, now: number, target: number) => ({
		done: Math.min(target, Math.max(0, (start ?? now) - now)),
		target
	});
	switch (task.kind) {
		case 'review':
			return fromDue(initial.dueReview, c.dueReview, task.target);
		case 'repertoire':
			return fromDue(initial.dueRepertoire, c.dueRepertoire, task.target);
		case 'mistakes':
			return fromDue(initial.dueMistakes, c.dueMistakes, task.target);
		case 'safety':
			return { done: Math.min(task.target, c.safetyToday), target: task.target };
		case 'puzzles':
			// jedes heute gelöste Puzzle zählt – dieselbe Zahl wie beim Tagesziel;
			// das Thema bestimmt nur, welche Puzzles der Knopf öffnet
			return { done: Math.min(task.target, c.puzzlesToday), target: task.target };
		case 'play':
			return { done: Math.min(1, c.gamesToday), target: 1 };
		case 'checkup':
			return { done: Number(c.checkupToday), target: 1 };
		case 'basics':
			return { done: Number(c.basicsDone.includes(task.lesson)), target: 1 };
		case 'course':
			return { done: Number(!!c.courseProgress[task.course]?.[task.line]), target: 1 };
		case 'endgame':
			return { done: Number((c.endgameStars[task.lesson] ?? 0) > 0), target: 1 };
		case 'game':
			return { done: Number(c.reviewedGames.includes(task.gameId)), target: 1 };
	}
}

export function isDone(task: PlanTask, c: PlanContext, initial: PlanInitial) {
	const p = progressOf(task, c, initial);
	return p.done >= p.target;
}
