/**
 * Persona-Simulation: Wie sieht eine Trainingswoche mit Rookie aus?
 * Ein einfaches, deterministisches Verhaltensmodell – kein Beweis, sondern ein Prüfstand für den Tagesplan:
 * Was schlägt Rookie vor, wie lange dauert es, wird abgerufen oder nur gelesen, kommen Fehler wieder?
 *
 * Annahmen (bewusst grob, in docs/learning-review-2026-11-13.md beschrieben):
 * - Puzzle: Lösungswahrscheinlichkeit nach Elo-Formel aus „wahrer“ Puzzle-Stärke und Puzzle-Wertung.
 * - Partie: 15 Minuten; Patzer je Partie aus der Persona (Poisson), Fehlerart nach Persona-Verteilung.
 * - Zeitbedarf je Aufgabe: Puzzle 1,2 min, Wiederholung 0,8 min, Lektion 6 min, Eröffnungsvariante 5 min,
 *   Endspiel 8 min, Partie nachspielen 1,5 min je Fehler, Blunder-Check-Übung 0,8 min je Stellung.
 */
import { buildPlan, progressOf, type PlanContext, type PlanTask } from '../plan.js';
import { BEGINNER_RATING, updateForPuzzle, type Rating } from '../glicko2.js';
import { puzzleTarget } from '../difficulty.js';

export interface Persona {
	name: string;
	/** wahre Puzzle-Stärke (Elo-Skala der Lichess-Puzzles) */
	puzzleSkill: number;
	/** Spielstärke, die Rookie schätzt */
	strength: number;
	rules: 'no' | 'some' | 'yes';
	focus: PlanContext['focus'];
	minutesPerDay: number;
	/** Patzer je eigener Partie zu Beginn */
	blundersPerGame: number;
	/** Anteil der Fehlerarten (z. B. hanging 0.5) */
	motifs: Record<string, number>;
	/** Online-Partien pro Tag, die über ein verknüpftes Konto hereinkommen */
	onlineGamesPerDay: number;
}

export const PERSONAS: Persona[] = [
	{
		name: 'A · 600, kennt die Regeln, stellt oft Figuren ein',
		puzzleSkill: 750,
		strength: 600,
		rules: 'some',
		focus: 'play',
		minutesPerDay: 25,
		blundersPerGame: 4,
		motifs: { hanging: 0.55, 'mate-allowed': 0.15, fork: 0.15, 'missed-win': 0.15 },
		onlineGamesPerDay: 0
	},
	{
		name: 'B · 1000 auf Lichess, stagniert',
		puzzleSkill: 1250,
		strength: 1000,
		rules: 'yes',
		focus: 'tactics',
		minutesPerDay: 30,
		blundersPerGame: 2.2,
		motifs: { hanging: 0.35, fork: 0.2, 'missed-win': 0.3, 'mate-allowed': 0.15 },
		onlineGamesPerDay: 3
	}
];

export type Mode = 'retrieval' | 'reading' | 'playing';

export interface DayLog {
	day: number;
	tasks: { kind: PlanTask['kind']; label: string; minutes: number; mode: Mode; note: string }[];
	minutes: number;
	puzzleRating: number;
	puzzleSuccess: number | null;
	dueMistakes: number;
}

export interface WeekLog {
	persona: string;
	days: DayLog[];
	summary: {
		minutes: number;
		share: Record<Mode, number>;
		puzzles: number;
		puzzleSuccess: number;
		games: number;
		ownMistakesCreated: number;
		ownMistakesPractised: number;
		/** wie viele eigene Fehler am Wochenende nie geübt wurden */
		ownMistakesNeverPractised: number;
		blunderChecks: number;
	};
}

/** deterministischer Zufall */
function rng(seed: number) {
	let s = seed;
	return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const expected = (skill: number, rating: number) => 1 / (1 + Math.pow(10, (rating - skill) / 400));

/** Optionale Erweiterungen des Plans, die nicht in PlanContext stecken (z. B. Blunder-Check) */
export interface SimHooks {
	/** Puzzle-Wertung, auf die Rookie Puzzles zielt (Standard: eigene Wertung; neu: puzzleTarget) */
	puzzleTarget?: (r: Rating) => number;
	/** Zusatzwerte im Kontext (neue Felder) */
	extendContext?: (ctx: PlanContext, s: SimState) => PlanContext;
}

export interface SimState {
	day: number;
	rating: Rating;
	mistakeQueue: { motif: string; due: number; reps: number }[];
	gamesTotal: number;
	lastGameDay: number | null;
	basicsDone: string[];
	endgameStars: Record<string, number>;
	courseProgress: Record<string, Record<string, unknown>>;
	puzzleReviewsDue: number;
	blunderChecks: number;
	mistakesPractised: number;
	mistakesCreated: number;
	blundersPerGame: number;
}

export function simulateWeek(p: Persona, hooks: SimHooks = {}, days = 7): WeekLog {
	const r = rng(p.puzzleSkill + p.minutesPerDay);
	const s: SimState = {
		day: 0,
		rating: { ...BEGINNER_RATING },
		mistakeQueue: [],
		gamesTotal: 0,
		lastGameDay: null,
		basicsDone: p.rules === 'yes' ? [] : [],
		endgameStars: {},
		courseProgress: {},
		puzzleReviewsDue: 0,
		blunderChecks: 0,
		mistakesPractised: 0,
		mistakesCreated: 0,
		blundersPerGame: p.blundersPerGame
	};
	const log: DayLog[] = [];
	let lastGameWithMistakes: number | null = null;
	const reviewed: number[] = [];
	const recent: boolean[] = [];
	const totals = { retrieval: 0, reading: 0, playing: 0 };
	let puzzles = 0;
	let solved = 0;
	const playGame = (): number => {
		// Patzer je Partie: Poisson-ähnlich um den Mittelwert
		const lambda = s.blundersPerGame;
		let k = 0;
		let acc = Math.exp(-lambda);
		let sum = acc;
		const u = r();
		while (u > sum && k < 12) {
			k++;
			acc *= lambda / k;
			sum += acc;
		}
		const keys = Object.keys(p.motifs);
		for (let i = 0; i < k; i++) {
			let x = r();
			const m = keys.find((key) => (x -= p.motifs[key]) <= 0) ?? keys[0];
			s.mistakeQueue.push({ motif: m, due: s.day, reps: 0 });
			s.mistakesCreated++;
		}
		s.gamesTotal++;
		s.lastGameDay = s.day;
		if (k) lastGameWithMistakes = s.gamesTotal;
		return k;
	};

	for (let d = 0; d < days; d++) {
		s.day = d;
		// Online-Partien des Vortags (verknüpftes Konto) kommen über Nacht herein
		for (let i = 0; i < p.onlineGamesPerDay; i++) if (d > 0) playGame();
		const dueMistakes = s.mistakeQueue.filter((m) => m.due <= d).length;
		let ctx: PlanContext = {
			day: `2026-11-${String(16 + d).padStart(2, '0')}`,
			dueReview: s.puzzleReviewsDue,
			dueRepertoire: 0,
			weakTheme: d > 0 ? 'hangingPiece' : null,
			puzzlesToday: 0,
			basicsDone: s.basicsDone,
			courseProgress: s.courseProgress,
			endgameStars: s.endgameStars,
			rulesKnown: p.rules,
			focus: p.focus,
			dailyGoal: 5,
			gameToReview:
				lastGameWithMistakes !== null && !reviewed.includes(lastGameWithMistakes)
					? lastGameWithMistakes
					: null,
			reviewedGames: reviewed,
			daysSinceGame: s.lastGameDay === null ? null : d - s.lastGameDay,
			gamesToday: 0,
			dueMistakes,
			safetyToday: 0,
			safetyFirst: p.strength < 1400,
			// erster Kontrolltest am zweiten Tag (nach den ersten Blunder-Checks), dann alle 14 Tage
			checkupDue: d === 1,
			checkupToday: false,
			strength: p.strength,
			minutes: p.minutesPerDay
		};
		if (hooks.extendContext) ctx = hooks.extendContext(ctx, s);
		const plan = buildPlan(ctx);
		const day: DayLog = {
			day: d + 1,
			tasks: [],
			minutes: 0,
			puzzleRating: 0,
			puzzleSuccess: null,
			dueMistakes
		};
		let dayPuzzles = 0;
		let daySolved = 0;
		const add = (task: PlanTask, minutes: number, mode: Mode, note: string) => {
			day.tasks.push({ kind: task.kind, label: task.id, minutes, mode, note });
			day.minutes += minutes;
			totals[mode] += minutes;
		};
		const solvePuzzle = (bonus = 0, rated = true) => {
			const target = hooks.puzzleTarget
				? hooks.puzzleTarget(s.rating)
				: puzzleTarget(s.rating.rating, recent);
			const pr = target + (r() - 0.5) * 300;
			const ok = r() < Math.min(0.97, expected(p.puzzleSkill, pr) + bonus);
			if (rated) {
				s.rating = updateForPuzzle(s.rating, pr, ok);
				recent.push(ok);
			}
			puzzles++;
			dayPuzzles++;
			if (ok) {
				solved++;
				daySolved++;
			}
			return ok;
		};
		for (const task of plan.tasks) {
			if (day.minutes >= p.minutesPerDay) break;
			const target = 'target' in task ? task.target : 1;
			switch (task.kind) {
				case 'puzzles': {
					let fails = 0;
					for (let i = 0; i < target; i++) if (!solvePuzzle()) fails++;
					// FSRS: verfehlte Puzzles sind nach 1 min wieder fällig (Lernschritt) – zählen hier für morgen
					s.puzzleReviewsDue += fails;
					add(task, target * 1.2, 'retrieval', `${target - fails}/${target} gelöst`);
					break;
				}
				case 'review': {
					let ok = 0;
					for (let i = 0; i < target; i++) if (solvePuzzle(0.2, false)) ok++;
					s.puzzleReviewsDue = Math.max(0, s.puzzleReviewsDue - ok);
					add(task, target * 0.8, 'retrieval', `${ok}/${target} wiederholt`);
					break;
				}
				case 'play': {
					const k = playGame();
					add(task, 15, 'playing', `${k} Patzer`);
					break;
				}
				case 'game': {
					const n = Math.max(1, Math.min(4, Math.round(s.blundersPerGame)));
					reviewed.push(task.gameId);
					const own = s.mistakeQueue.filter((m) => m.reps === 0).slice(-n);
					own.forEach((m) => {
						m.reps++;
						m.due = d + 3;
					});
					s.mistakesPractised += own.length;
					add(task, n * 1.5, 'retrieval', `${own.length} eigene Fehler nachgespielt`);
					break;
				}
				case 'basics':
					s.basicsDone = [...s.basicsDone, task.lesson];
					add(task, 6, 'reading', 'Lektion (meist Lesen, 1–2 Aufgaben)');
					break;
				case 'endgame':
					s.endgameStars = { ...s.endgameStars, [task.lesson]: 2 };
					add(task, 8, 'retrieval', 'Endspiel gegen Tablebase');
					break;
				case 'course':
					s.courseProgress = {
						...s.courseProgress,
						[task.course]: { ...s.courseProgress[task.course], [task.line]: { total: 1 } }
					};
					add(task, 5, 'reading', 'Eröffnungsvariante (geführt)');
					break;
				case 'repertoire':
					add(task, target * 0.5, 'retrieval', 'Repertoire');
					break;
				default: {
					// neue Aufgabenarten (z. B. Blunder-Check, eigene Fehler) – generisch
					const ext = task as PlanTask & { target?: number };
					const n = ext.target ?? 1;
					if ((task.kind as string) === 'mistakes') {
						const due = s.mistakeQueue.filter((m) => m.due <= d).slice(0, n);
						due.forEach((m) => {
							m.reps++;
							m.due = d + (m.reps === 1 ? 2 : m.reps === 2 ? 5 : 14);
						});
						s.mistakesPractised += due.length;
						add(task, Math.max(1, due.length) * 1.2, 'retrieval', `${due.length} eigene Fehler`);
					} else if ((task.kind as string) === 'safety') {
						s.blunderChecks += n;
						add(task, n * 0.8, 'retrieval', `${n} Blunder-Checks`);
					} else add(task, 5, 'retrieval', String(task.kind));
				}
			}
			void progressOf;
		}
		day.puzzleRating = Math.round(s.rating.rating);
		day.puzzleSuccess = dayPuzzles ? Math.round((daySolved / dayPuzzles) * 100) : null;
		log.push(day);
	}
	const minutes = totals.retrieval + totals.reading + totals.playing;
	const pct = (x: number) => Math.round((x / Math.max(1, minutes)) * 100);
	return {
		persona: p.name,
		days: log,
		summary: {
			minutes: Math.round(minutes),
			share: {
				retrieval: pct(totals.retrieval),
				reading: pct(totals.reading),
				playing: pct(totals.playing)
			},
			puzzles,
			puzzleSuccess: puzzles ? Math.round((solved / puzzles) * 100) : 0,
			games: s.gamesTotal,
			ownMistakesCreated: s.mistakesCreated,
			ownMistakesPractised: s.mistakesPractised,
			ownMistakesNeverPractised: s.mistakeQueue.filter((m) => m.reps === 0).length,
			blunderChecks: s.blunderChecks
		}
	};
}

/** Lesbares Protokoll für die Doku */
export function formatWeek(w: WeekLog): string {
	const lines = [`## ${w.persona}`, ''];
	for (const d of w.days)
		lines.push(
			`Tag ${d.day} (${Math.round(d.minutes)} min, Puzzle-Wertung ${d.puzzleRating}, Quote ${d.puzzleSuccess ?? '–'} %, fällige eigene Fehler ${d.dueMistakes}): ` +
				d.tasks
					.map((t) => `${t.label} [${t.mode}, ${Math.round(t.minutes)} min: ${t.note}]`)
					.join(' → ')
		);
	const s = w.summary;
	lines.push(
		'',
		`Summe: ${s.minutes} min · Abrufen ${s.share.retrieval} % · Lesen ${s.share.reading} % · Spielen ${s.share.playing} % · ` +
			`${s.puzzles} Puzzles (${s.puzzleSuccess} % gelöst) · ${s.games} Partien · eigene Fehler: ${s.ownMistakesCreated} entstanden, ` +
			`${s.ownMistakesPractised}× geübt, ${s.ownMistakesNeverPractised} nie geübt · Blunder-Checks ${s.blunderChecks}`
	);
	return lines.join('\n');
}
