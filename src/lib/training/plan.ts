/**
 * „Dein Training heute“: ein kurzer, persönlicher Tagesplan.
 * Der Plan wird einmal pro Tag festgelegt (damit er sich nicht unter den Fingern ändert),
 * der Fortschritt wird jedes Mal frisch aus den Daten berechnet.
 */
import { BASICS } from '#lib/basics/lessons.js';
import { COURSES } from '#lib/openings/courses.js';
import { LESSONS } from '#lib/endgames/lessons.js';

export type PlanTask =
	| { id: string; kind: 'review'; target: number }
	| { id: string; kind: 'puzzles'; target: number; theme?: string }
	| { id: string; kind: 'repertoire'; target: number }
	| { id: string; kind: 'basics'; lesson: string }
	| { id: string; kind: 'course'; course: string; line: string }
	| { id: string; kind: 'endgame'; lesson: string }
	| { id: string; kind: 'game'; gameId: number }
	| { id: string; kind: 'play' };

export interface DailyPlan {
	day: string;
	tasks: PlanTask[];
}

/** Was Rookie heute über dich weiß */
export interface PlanContext {
	day: string;
	dueReview: number;
	dueRepertoire: number;
	weakTheme: string | null;
	/** heute erledigte Puzzles – dieselbe Zahl wie beim Tagesziel */
	puzzlesToday: number;
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
}

/** nach so vielen Tagen ohne Partie gehört Spielen in den Plan */
export const PLAY_AFTER_DAYS = 2;

/** Nächster sinnvoller Lernschritt (Grundlagen → Kurs → Endspiel) */
function nextLesson(c: PlanContext): PlanTask | null {
	const basicsOpen = BASICS.find((l) => !c.basicsDone.includes(l.id));
	if (basicsOpen && (c.rulesKnown === 'no' || c.rulesKnown === 'some' || c.focus === 'rules'))
		return { id: `basics:${basicsOpen.id}`, kind: 'basics', lesson: basicsOpen.id };

	const courseFirst = c.focus === 'openings';
	const course = () => {
		// angefangene Kurse zuerst fertig machen, sonst die einfachsten
		const ordered = [...COURSES].sort(
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
		const l = [...LESSONS].sort((a, b) => a.level - b.level).find((x) => !c.endgameStars[x.id]);
		return l ? ({ id: `endgame:${l.id}`, kind: 'endgame', lesson: l.id } as const) : null;
	};
	return (courseFirst ? (course() ?? endgame()) : (endgame() ?? course())) ?? null;
}

export function buildPlan(c: PlanContext): DailyPlan {
	const tasks: PlanTask[] = [];
	if (c.dueReview > 0)
		tasks.push({ id: 'review', kind: 'review', target: Math.min(c.dueReview, 10) });
	const n = Math.max(3, Math.min(c.dailyGoal, 10));
	// Spielen gehört zum Training: wer es als Schwerpunkt gewählt hat oder länger nicht gespielt hat
	const play =
		c.rulesKnown !== 'no' &&
		(c.focus === 'play' || c.daysSinceGame === null || c.daysSinceGame >= PLAY_AFTER_DAYS);
	const playTask: PlanTask = { id: 'play', kind: 'play' };
	if (play && c.focus === 'play') tasks.push(playTask);
	tasks.push(
		c.weakTheme && c.rulesKnown !== 'no'
			? { id: `puzzles:${c.weakTheme}`, kind: 'puzzles', target: n, theme: c.weakTheme }
			: { id: 'puzzles', kind: 'puzzles', target: n }
	);
	if (play && c.focus !== 'play') tasks.push(playTask);
	if (c.dueRepertoire > 0)
		tasks.push({ id: 'repertoire', kind: 'repertoire', target: Math.min(c.dueRepertoire, 8) });
	if (c.gameToReview !== null && !c.reviewedGames.includes(c.gameToReview))
		tasks.push({ id: `game:${c.gameToReview}`, kind: 'game', gameId: c.gameToReview });
	const lesson = nextLesson(c);
	if (lesson) tasks.push(lesson);
	return { day: c.day, tasks: tasks.slice(0, 4) };
}

/** Fortschritt einer Aufgabe: 0 … target */
export function progressOf(
	task: PlanTask,
	c: PlanContext,
	initial: { dueReview: number; dueRepertoire: number }
): { done: number; target: number } {
	switch (task.kind) {
		case 'review':
			return {
				done: Math.min(task.target, Math.max(0, initial.dueReview - c.dueReview)),
				target: task.target
			};
		case 'repertoire':
			return {
				done: Math.min(task.target, Math.max(0, initial.dueRepertoire - c.dueRepertoire)),
				target: task.target
			};
		case 'puzzles':
			// jedes heute gelöste Puzzle zählt – dieselbe Zahl wie beim Tagesziel;
			// das Thema bestimmt nur, welche Puzzles der Knopf öffnet
			return { done: Math.min(task.target, c.puzzlesToday), target: task.target };
		case 'play':
			return { done: Math.min(1, c.gamesToday), target: 1 };
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

export function isDone(
	task: PlanTask,
	c: PlanContext,
	initial: { dueReview: number; dueRepertoire: number }
) {
	const p = progressOf(task, c, initial);
	return p.done >= p.target;
}
