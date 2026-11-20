/**
 * „Dein Training heute“: ein kurzer, persönlicher Tagesplan nach dem Rookie-Lernmodell
 * (docs/research-2026-11-13.md):
 *
 * 1. Sicherheit zuerst – Blunder-Check als Aufwärmen (Einsteiger verlieren die meisten Partien durch
 *    eingestellte Figuren und übersehene Ein-/Zweizüger).
 * 2. Eigene Fehler kommen mit Abständen wieder (1 → 3 → 8 → 22 Tage), bis sie sitzen.
 * 3. Gemischte Taktik mit ca. 80 % Erfolg; der Schwerpunkt bekommt zwei von drei Puzzles.
 * 4. Regelmäßig gewertetes Rapid gegen Menschen, danach einen eigenen Fehler üben.
 * 5. Theorie (Lektion, Eröffnung, Endspiel) nur, wenn im Zeitbudget Platz ist.
 *
 * Aufgaben werden nach Wichtigkeit ausgewählt, bis das Zeitbudget voll ist, und dann in einer
 * sinnvollen Reihenfolge gezeigt. Der Plan wird einmal pro Tag festgelegt (damit er sich nicht unter
 * den Fingern ändert), der Fortschritt wird jedes Mal frisch aus den Daten berechnet.
 */
import { BASICS, TACTICS } from '#lib/basics/lessons.js';
import { COURSES } from '#lib/openings/courses.js';
import { LESSONS } from '#lib/endgames/lessons.js';
import { POSITIONAL } from '#lib/basics/positional.js';

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
	| { id: string; kind: 'checkup' }
	| { id: string; kind: 'scan'; target: number }
	| { id: string; kind: 'positional'; lesson: string }
	| { id: string; kind: 'tactic'; lesson: string };

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
	/** heute gescannte Stellungen (Brett-Scan) */
	scanToday?: number;
	/** Blunder-Check gehört in den Plan (Spielstärke < 1400 oder noch viele Patzer) */
	safetyFirst: boolean;
	/** Kontrolltest fällig / heute erledigt */
	checkupDue: boolean;
	checkupToday: boolean;
	basicsDone: string[];
	/** erledigte Stellungsspiel-Lektionen */
	positionalDone?: string[];
	/** erledigte Taktik-Lektionen (Gabel, Fesselung, …) */
	tacticsDone?: string[];
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
	/** heutige Lernpartien (gewertetes Lichess-Rapid oder Partie in Rookie) */
	gamesToday: number;
	/** geschätzte Spielstärke (null = unbekannt) – bestimmt, welche Lektionen schon passen */
	strength: number | null;
	/** Zeitbudget in Minuten */
	minutes: number;
	/**
	 * Wochendosis des Coachs (prescription.ts). Fehlt sie, gilt die alte Regel „alle zwei Tage eine Partie“
	 * und die festen Mengen unten.
	 */
	week?: {
		/** Lernpartien dieser Woche und Ziel */
		games: number;
		target: number;
		/** Tage bis Sonntagabend, heute eingeschlossen */
		daysLeft: number;
		safety: number;
		scan: number;
	};
}

/** ohne Schwerpunkt „Partien“: alle so viele Tage eine Partie */
export const PLAY_AFTER_DAYS = 2;
/** Standard-Zeitbudget (Minuten pro Tag) */
export const DEFAULT_MINUTES = 30;
/** höchstens so viele Aufgaben, damit der Plan überschaubar bleibt */
export const MAX_TASKS = 5;
/** Blunder-Checks pro Tag */
export const SAFETY_PER_DAY = 6;
/** unter dieser Stärke: täglich Brett-Scan (Stufen „Fundament“ und „Brett sehen“) */
export const SCAN_UNTIL = 1200;
/** Stellungen im täglichen Brett-Scan */
export const SCAN_PER_DAY = 3;
/** ab dieser Stärke schlägt der Plan Stellungsspiel-Lektionen vor */
export const POSITIONAL_FROM = 1150;
/** so viele Minuten darf der Plan für die täglichen Puzzles über dem Budget liegen */
export const PUZZLE_OVERFLOW = 5;

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
			return 20;
		case 'game':
			return 4;
		case 'checkup':
			return 6;
		case 'scan':
			return task.target;
		case 'positional':
			return 6;
		case 'tactic':
			return 5;
		case 'basics':
			return 5;
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

/** Taktik-Lektionen (Motive erkennen) bis zu dieser Stärke vor Stellungsspiel, Endspiel und Kursen */
export const TACTICS_UNTIL = 1400;

/**
 * Nächster sinnvoller Lernschritt, passend zur Stufe: Regeln → Taktik-Motive (unter 1400) → Stellungsspiel
 * (ab 1150) → Endspiel/Kurs. Tagesplan und „Weiter lernen“ nutzen dieselbe Reihenfolge.
 */
export function nextLesson(c: PlanContext): PlanTask | null {
	const basicsOpen = BASICS.find((l) => !c.basicsDone.includes(l.id));
	if (basicsOpen && (c.rulesKnown === 'no' || c.rulesKnown === 'some' || c.focus === 'rules'))
		return { id: `basics:${basicsOpen.id}`, kind: 'basics', lesson: basicsOpen.id };

	const tactic = TACTICS.find((l) => !(c.tacticsDone ?? []).includes(l.id));
	if (tactic && c.focus !== 'openings' && (c.strength === null || c.strength < TACTICS_UNTIL))
		return { id: `tactic:${tactic.id}`, kind: 'tactic', lesson: tactic.id };

	const max = levelFor(c.strength);
	// ab ~1150 zählt Stellungsspiel (Lichess-Daten: Strategie und Eröffnung gewinnen an Gewicht) –
	// erst die Ideen, dann weitere Endspiele und Kurse
	const pos = POSITIONAL.find((l) => !(c.positionalDone ?? []).includes(l.id));
	if (pos && c.focus !== 'openings' && c.strength !== null && c.strength >= POSITIONAL_FROM)
		return { id: `positional:${pos.id}`, kind: 'positional', lesson: pos.id };
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
	'basics',
	'checkup',
	'scan',
	'safety',
	'play',
	'game',
	'mistakes',
	'review',
	'puzzles',
	'repertoire',
	'tactic',
	'positional',
	'course',
	'endgame'
];

export function needsBasics(c: PlanContext): boolean {
	return (
		(c.rulesKnown === 'no' || c.rulesKnown === 'some') &&
		BASICS.some((lesson) => !c.basicsDone.includes(lesson.id))
	);
}

export function rapidDue(c: PlanContext): boolean {
	if (needsBasics(c)) return false;
	if (c.daysSinceGame === null) return true;
	if (!c.week) return c.daysSinceGame >= PLAY_AFTER_DAYS;
	// Wochenziel: gleichmäßig verteilen; gegen Wochenende aufholen, sobald die Tage knapp werden
	const left = c.week.target - c.week.games;
	if (left <= 0) return false;
	const gap = Math.max(1, Math.round(7 / c.week.target));
	return c.daysSinceGame >= gap || left >= c.week.daysLeft;
}

export function buildPlan(c: PlanContext): DailyPlan {
	const n = Math.max(3, Math.min(c.dailyGoal, 20));
	const cand: { task: PlanTask; prio: number }[] = [];
	const add = (task: PlanTask, prio: number) => cand.push({ task, prio });
	const beginner = needsBasics(c);

	if (beginner) {
		// Erst die nächste offene Regellektion.
		const lesson = nextLesson(c);
		if (lesson) add(lesson, 0);
	} else {
		if (c.checkupDue) add({ id: 'checkup', kind: 'checkup' }, 0.5);
		// unter 1200: das Brett sehen (Brett-Scan) gehört täglich dazu, der Blunder-Check wird kürzer
		const scan = c.strength === null || c.strength < SCAN_UNTIL;
		if (c.safetyFirst)
			add(
				{ id: 'safety', kind: 'safety', target: c.week?.safety ?? (scan ? 4 : SAFETY_PER_DAY) },
				1
			);
		if (scan) add({ id: 'scan', kind: 'scan', target: c.week?.scan || SCAN_PER_DAY }, 1.2);
		if (c.dueMistakes > 0)
			add({ id: 'mistakes', kind: 'mistakes', target: Math.min(c.dueMistakes, 5) }, 2);
		// Bei fälligem Spieltag 20 Minuten freihalten. Bei knapper Zeit erscheint der Spieltermin separat.
		if (rapidDue(c) || c.gamesToday > 0)
			add({ id: 'play', kind: 'play' }, c.focus === 'play' ? 0.8 : 1.4);
		if (c.gameToReview !== null && !c.reviewedGames.includes(c.gameToReview))
			add(
				{ id: `game:${c.gameToReview}`, kind: 'game', gameId: c.gameToReview },
				c.gamesToday > 0 ? 0.2 : 1.5
			);
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

	// nach Wichtigkeit auswählen, bis das Zeitbudget voll ist
	const picked: PlanTask[] = [];
	let used = 0;
	for (const { task } of [...cand].sort((a, b) => a.prio - b.prio)) {
		if (picked.length >= MAX_TASKS) break;
		let t = task;
		// Taktik schrumpft bei knappem Budget lieber, als ganz zu entfallen (mindestens 3 Puzzles)
		if (t.kind === 'puzzles' && used + minutesOf(t) > c.minutes) {
			const fit = Math.floor((c.minutes - used) / 1.2);
			if (fit >= 3) t = { ...t, target: Math.min(t.target, fit) };
		}
		// Puzzles jeden Tag – auch an Spieltagen, notfalls 3 Stück über dem Budget (Lichess: Puzzle-Menge hängt
		// am stärksten mit dem Aufstieg zusammen, docs/research-2026-11-13.md, Nachtrag 20.11.)
		if (t.kind === 'puzzles' && used + minutesOf(t) > c.minutes && c.week)
			t = { ...t, target: Math.min(t.target, 3) };
		const m = minutesOf(t);
		if (used + m > c.minutes + (t.kind === 'puzzles' && c.week ? PUZZLE_OVERFLOW : 0)) continue;
		picked.push(t);
		used += m;
	}
	const orderOf = (task: PlanTask) =>
		c.gamesToday > 0 && task.kind === 'game' ? -1 : ORDER.indexOf(task.kind);
	picked.sort((a, b) => orderOf(a) - orderOf(b));
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
		case 'scan':
			return { done: Math.min(task.target, c.scanToday ?? 0), target: task.target };
		case 'positional':
			return { done: Number((c.positionalDone ?? []).includes(task.lesson)), target: 1 };
		case 'tactic':
			return { done: Number((c.tacticsDone ?? []).includes(task.lesson)), target: 1 };
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
