import {
	db,
	getSetting,
	setSetting,
	today,
	type GameRow,
	type PuzzleAttemptRow
} from '#lib/db/db.js';
import { countDue } from './srs.js';
import { themeStats, weakest } from './stats.js';
import { getCourseProgress } from '#lib/openings/progress.js';
import { getProfile } from '#lib/onboarding/profile.js';
import { getPuzzleRating } from './rating.js';
import { isTargetGame, ratingAfter, targetRating } from '#lib/import/ratings.js';
import { blundersPer30 } from './blunders.js';
import {
	adjust,
	pathTo1600,
	recipeFor,
	weekProgress,
	weekStart,
	type Adjustment,
	type Path,
	type Recipe,
	type WeekProgress
} from './prescription.js';
import { BOTS } from '#lib/bots/bots.js';
import { estimateStrength, type Strength } from './strength.js';
import { gameLevel } from './skills.js';
import {
	buildPlan,
	needsBasics,
	DEFAULT_MINUTES,
	type DailyPlan,
	type PlanContext,
	type PlanInitial
} from './plan.js';
import { computeStats, type GameStats } from './gamestats.js';
import { pickFocus, type Focus } from './focus.js';
import { checkupDue, type CheckupResult } from './safety.js';

interface StoredPlan extends DailyPlan {
	revision: 1;
	reviewAfterRapid: number | null;
	rulesPending: boolean;
	initial: PlanInitial;
}

/** Blunder-Check gehört in den Plan: unter 1400 oder solange noch oft gepatzt wird */
export const SAFETY_UNTIL = 1400;
/**
 * „noch oft“: so viele Patzer je 30 Züge in offener Stellung wie Lichess-Spieler um 1400 (≈ 2,9) oder mehr.
 * Seit v0.7 dieselbe Definition wie Penta und Fortschrittskarte (vorher 1,5 nach der alten, weicheren Zählung).
 */
export const SAFETY_BLUNDERS_PER_30 = 3;
/** erster Kontrolltest, sobald man das Format kennt (so viele Blunder-Checks) */
export const CHECKUP_AFTER = 6;

export function needsSafety(strength: number | null, blundersPer30: number | null): boolean {
	return (
		strength === null ||
		strength < SAFETY_UNTIL ||
		(blundersPer30 !== null && blundersPer30 >= SAFETY_BLUNDERS_PER_30)
	);
}

export async function loadPlanContext(): Promise<PlanContext> {
	const day = today();
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const attempts = await db.puzzleAttempts.toArray();
	const games = await db.games.toArray();
	const rapid = games.filter(isTargetGame);
	const stats = computeStats(rapid.length ? rapid : games);
	const focus = focusFrom(stats, attempts);
	// jüngste Lernpartie: gewertetes Rapid oder eine Partie in Rookie
	const lastPracticeGame = games
		.filter(isPracticeGame)
		.reduce<(typeof games)[number] | null>(
			(latest, g) => (!latest || g.date > latest.date ? g : latest),
			null
		);
	const profile = await getProfile();
	const lastMistake = await db.mistakes.orderBy('date').last();
	const strength = await currentStrength(games);
	const safetyAttempts = attempts.filter((a) => a.source === 'safety');
	const checkups = await getSetting<CheckupResult[]>('checkups', []);
	const minutes = await getSetting('minutesPerDay', DEFAULT_MINUTES);
	const recipe = recipeFor(strength?.value ?? null, minutes);
	const now = Date.now();
	const ws = weekStart(now);
	const practice = games.filter(isPracticeGame);
	const lastPractice = lastPracticeGame?.date ?? 0;
	return {
		day,
		dueReview: await countDue('puzzle'),
		dueRepertoire: await countDue('repertoire'),
		dueMistakes: await countDue('mistake'),
		weakTheme: focus?.theme ?? null,
		puzzlesToday: (await db.activity.get(day))?.puzzles ?? 0,
		safetyToday: safetyAttempts.filter((a) => a.date >= start.getTime()).length,
		scanToday: attempts.filter((a) => a.source === 'scan' && a.date >= start.getTime()).length,
		positionalDone: await getSetting<string[]>('positionalDone', []),
		tacticsDone: await getSetting<string[]>('tacticsDone', []),
		safetyFirst: needsSafety(strength?.value ?? null, stats.blundersPer30),
		checkupDue: safetyAttempts.length >= CHECKUP_AFTER && checkupDue(checkups),
		checkupToday: (await getSetting<string>('checkupDay', '')) === day,
		basicsDone: await getSetting<string[]>('basicsDone', []),
		courseProgress: await getCourseProgress(),
		endgameStars: Object.fromEntries((await db.endgames.toArray()).map((e) => [e.id, e.stars])),
		rulesKnown: profile?.rules ?? null,
		focus: profile?.focus ?? null,
		dailyGoal: await dailyGoal(recipe),
		gameToReview: lastPracticeGame?.id ?? lastMistake?.gameId ?? null,
		reviewedGames: await getSetting<number[]>('reviewedGames', []),
		// Lernpartien zählen: gewertetes Rapid und Partien in Rookie (ohne Konto spielt man gegen Bots)
		daysSinceGame: lastPractice ? daysBetween(lastPractice, now) : null,
		gamesToday: practice.filter((g) => g.date >= start.getTime()).length,
		strength: strength?.value ?? null,
		minutes,
		week: {
			games: practice.filter((g) => g.date >= ws).length,
			target: recipe.games,
			daysLeft: 7 - Math.floor((now - ws) / 86_400_000),
			safety: recipe.safety,
			scan: recipe.scan
		}
	};
}

/** ganze Kalendertage zwischen zwei Zeitpunkten (Ortszeit) */
function daysBetween(a: number, b: number): number {
	const d = (x: number) => {
		const t = new Date(x);
		t.setHours(0, 0, 0, 0);
		return t.getTime();
	};
	return Math.round((d(b) - d(a)) / 86_400_000);
}

/** Puzzles pro Tag: eigene Einstellung, sonst die Dosis des Coachs */
export async function dailyGoal(recipe?: Recipe): Promise<number> {
	const own = await getSetting<number | null>('dailyGoal', null);
	if (own !== null) return own;
	const r =
		recipe ??
		recipeFor(
			(await currentStrength())?.value ?? null,
			await getSetting('minutesPerDay', DEFAULT_MINUTES)
		);
	return r.puzzles;
}

/** der eine Schwerpunkt aus eigenen Partien und Puzzles (siehe focus.ts) */
function focusFrom(stats: GameStats, attempts: PuzzleAttemptRow[]): Focus | null {
	return pickFocus({
		motifs: stats.motifs,
		weakTheme: weakest(themeStats(attempts), 1)[0]?.theme ?? null
	});
}

/** Schwerpunkt für Seiten außerhalb des Tagesplans (Coach) */
export async function currentFocus(): Promise<Focus | null> {
	const games = await db.games.toArray();
	const rapid = games.filter(isTargetGame);
	return focusFrom(computeStats(rapid.length ? rapid : games), await db.puzzleAttempts.toArray());
}

/** Plan für heute – einmal erzeugt, danach bis Mitternacht gleich */
export async function todayPlan(ctx: PlanContext): Promise<StoredPlan> {
	const stored = await getSetting<StoredPlan | null>('dailyPlan', null);
	const rulesPending = needsBasics(ctx);
	const reviewAfterRapid = ctx.gamesToday ? ctx.gameToReview : null;
	if (
		stored?.day === ctx.day &&
		stored.revision === 1 &&
		stored.rulesPending === rulesPending &&
		stored.reviewAfterRapid === reviewAfterRapid
	) {
		return stored;
	}
	const plan: StoredPlan = {
		...buildPlan(ctx),
		revision: 1,
		reviewAfterRapid,
		rulesPending,
		initial: {
			dueReview: ctx.dueReview,
			dueRepertoire: ctx.dueRepertoire,
			dueMistakes: ctx.dueMistakes
		}
	};
	await setSetting('dailyPlan', plan);
	return plan;
}

/** die eine Spielstärke der App (Lichess-Skala): Start, Coach, Lernen, Profil und Tagesplan nutzen sie */
export async function currentStrength(savedGames?: GameRow[]): Promise<Strength | null> {
	const games = savedGames ?? (await db.games.toArray());
	const rapid = targetRating(games);
	if (rapid !== null) {
		return { value: rapid, confidence: 0, parts: [{ source: 'online', value: rapid }] };
	}
	const beatenIds = await getSetting<string[]>('botsBeaten', []);
	return estimateStrength({
		games: gameLevel(games.filter((g) => g.source === 'pgn' || g.source === 'friend')),
		puzzle:
			(await db.puzzleAttempts.filter((a) => a.source === 'lichess').count()) >= 5
				? await getPuzzleRating()
				: null,
		botsBeaten: BOTS.filter((b) => beatenIds.includes(b.id)).map((b) => b.elo)
	});
}

// ───────── Die Woche des Coachs (lib/training/prescription.ts) ─────────

/** Lernpartie: gewertetes Lichess-Rapid oder eine beendete Partie in Rookie (Bot, Freund) ab zehn Zügen */
export function isPracticeGame(g: GameRow): boolean {
	return (
		isTargetGame(g) ||
		((g.source === 'bot' || g.source === 'friend') && g.result !== '*' && g.moves.length >= 20)
	);
}

/** Patzer je 30 Züge aus den letzten zehn analysierten Lernpartien (wie der Trainingsindex) */
export function recentBlunders(games: GameRow[]): number | null {
	const analysed = games
		.filter((g) => isPracticeGame(g) && g.analysis?.done)
		.sort((a, b) => b.date - a.date)
		.slice(0, 10);
	return blundersPer30(analysed);
}

interface LessonLogEntry {
	id: string;
	date: number;
}

/** Lektion als erledigt mit Datum vermerken (für die Wochendosis; Einträge älter als 60 Tage fallen weg) */
export async function logLesson(id: string, now = Date.now()): Promise<void> {
	const log = await getSetting<LessonLogEntry[]>('lessonLog', []);
	await setSetting('lessonLog', [
		...log.filter((x) => now - x.date < 60 * 86_400_000),
		{ id, date: now }
	]);
}

/** verschiedene Lektionen seit `from`: Regeln/Taktik/Stellungsspiel (Log), Endspiele, Eröffnungslinien */
async function lessonsSince(from: number): Promise<number> {
	const ids = new Set<string>();
	for (const x of await getSetting<LessonLogEntry[]>('lessonLog', []))
		if (x.date >= from) ids.add(`basic:${x.id}`);
	for (const e of await db.endgames.toArray()) if (e.date >= from) ids.add(`endgame:${e.id}`);
	for (const [course, lines] of Object.entries(await getCourseProgress()))
		for (const [line, r] of Object.entries(lines))
			if (r.date >= from) ids.add(`course:${course}:${line}`);
	return ids.size;
}

export interface CoachWeek {
	recipe: Recipe;
	progress: WeekProgress;
	path: Path | null;
	adjustment: Adjustment;
	/** Tage bis Sonntagabend (inklusive heute) */
	daysLeft: number;
	/** Lichess-Konto verknüpft – sonst spielt man die Lernpartien gegen Bots */
	online: boolean;
	/** jüngste noch nicht besprochene Lernpartie der letzten 14 Tage */
	toReview: number | null;
}

export async function loadCoachWeek(now = Date.now()): Promise<CoachWeek> {
	const [games, attempts, activity, reviewed, minutes, strength] = await Promise.all([
		db.games.toArray(),
		db.puzzleAttempts
			.where('date')
			.aboveOrEqual(now - 14 * 86_400_000)
			.toArray(),
		db.activity.toArray(),
		getSetting<number[]>('reviewedGames', []),
		getSetting('minutesPerDay', DEFAULT_MINUTES),
		currentStrength()
	]);
	const elo = strength?.value ?? null;
	const start = weekStart(now);
	const base = recipeFor(elo, minutes);
	const practice = games.filter(isPracticeGame);
	const path = pathTo1600(elo, recentBlunders(games));
	const last14 = practice.filter((g) => g.date >= now - 14 * 86_400_000);
	const ratings = games
		.filter(isTargetGame)
		.map((g) => ({ date: g.date, rating: ratingAfter(g) }))
		.filter((r): r is { date: number; rating: number } => r.rating !== null)
		.sort((a, b) => a.date - b.date);
	// erst urteilen, wenn Rookie die Spielerin oder den Spieler schon zwei Wochen kennt
	const known = practice.some((g) => g.date < now - 14 * 86_400_000);
	const adjustment: Adjustment = known
		? adjust({
				recipe: base,
				games14: last14.length,
				reviewed14: last14.filter((g) => reviewed.includes(g.id!)).length,
				ratings,
				path,
				now
			})
		: { kind: 'none' };
	// Stillstand mit vielen Patzern: langsamer spielen (15+10); Partienzahl und Dosis bleiben
	const recipe = adjustment.kind === 'slow-down' ? recipeFor(elo, minutes, true) : base;
	const startDay = today(new Date(start));
	const progress = weekProgress(recipe, {
		games: practice.filter((g) => g.date >= start).map((g) => ({ id: g.id!, date: g.date })),
		reviewed,
		puzzles: activity.filter((a) => a.day >= startDay).reduce((s, a) => s + a.puzzles, 0),
		safety: attempts.filter((a) => a.source === 'safety' && a.date >= start).length,
		lessons: await lessonsSince(start)
	});
	return {
		recipe,
		progress,
		path,
		adjustment,
		daysLeft: 7 - Math.floor((now - start) / 86_400_000),
		online: games.some((g) => g.source === 'lichess'),
		toReview:
			[...last14].sort((a, b) => b.date - a.date).find((g) => !reviewed.includes(g.id!))?.id ?? null
	};
}
