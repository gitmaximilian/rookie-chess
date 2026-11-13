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
import { BOTS } from '#lib/bots/bots.js';
import { estimateStrength, type Strength } from './strength.js';
import { buildPlan, type DailyPlan, type PlanContext } from './plan.js';
import { computeStats, outcomeOf } from './gamestats.js';
import { pickFocus, type Focus } from './focus.js';

interface StoredPlan extends DailyPlan {
	initial: { dueReview: number; dueRepertoire: number };
}

export async function loadPlanContext(): Promise<PlanContext> {
	const day = today();
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const attempts = await db.puzzleAttempts.toArray();
	const games = await db.games.toArray();
	const focus = focusFrom(games, attempts);
	const lastGame = games.reduce((m, g) => Math.max(m, g.date), 0);
	const profile = await getProfile();
	const lastMistake = await db.mistakes.orderBy('date').last();
	return {
		day,
		dueReview: await countDue('puzzle'),
		dueRepertoire: await countDue('repertoire'),
		weakTheme: focus?.theme ?? null,
		puzzlesToday: (await db.activity.get(day))?.puzzles ?? 0,
		basicsDone: await getSetting<string[]>('basicsDone', []),
		courseProgress: await getCourseProgress(),
		endgameStars: Object.fromEntries((await db.endgames.toArray()).map((e) => [e.id, e.stars])),
		rulesKnown: profile?.rules ?? null,
		focus: profile?.focus ?? null,
		dailyGoal: await getSetting('dailyGoal', 5),
		gameToReview: lastMistake?.gameId ?? null,
		reviewedGames: await getSetting<number[]>('reviewedGames', []),
		daysSinceGame: lastGame ? Math.floor((Date.now() - lastGame) / 86_400_000) : null,
		gamesToday: games.filter(
			(g) => g.source === 'bot' && g.date >= start.getTime() && outcomeOf(g) !== null
		).length
	};
}

/** der eine Schwerpunkt aus eigenen Partien und Puzzles (siehe focus.ts) */
function focusFrom(games: GameRow[], attempts: PuzzleAttemptRow[]): Focus | null {
	return pickFocus({
		motifs: computeStats(games).motifs,
		weakTheme: weakest(themeStats(attempts), 1)[0]?.theme ?? null
	});
}

/** Schwerpunkt für Seiten außerhalb des Tagesplans (Coach) */
export async function currentFocus(): Promise<Focus | null> {
	return focusFrom(await db.games.toArray(), await db.puzzleAttempts.toArray());
}

/** Plan für heute – einmal erzeugt, danach bis Mitternacht gleich */
export async function todayPlan(ctx: PlanContext): Promise<StoredPlan> {
	const stored = await getSetting<StoredPlan | null>('dailyPlan', null);
	if (stored?.day === ctx.day) return stored;
	const plan: StoredPlan = {
		...buildPlan(ctx),
		initial: { dueReview: ctx.dueReview, dueRepertoire: ctx.dueRepertoire }
	};
	await setSetting('dailyPlan', plan);
	return plan;
}

export async function currentStrength(): Promise<Strength | null> {
	const beatenIds = await getSetting<string[]>('botsBeaten', []);
	const online = (await db.games.orderBy('date').reverse().toArray()).find(
		(g) => g.myRating && (g.source === 'lichess' || g.source === 'chesscom')
	);
	return estimateStrength({
		puzzle: (await db.puzzleAttempts.count()) >= 5 ? await getPuzzleRating() : null,
		botsBeaten: BOTS.filter((b) => beatenIds.includes(b.id)).map((b) => b.elo),
		online: online
			? { rating: online.myRating!, source: online.source as 'lichess' | 'chesscom' }
			: null
	});
}
