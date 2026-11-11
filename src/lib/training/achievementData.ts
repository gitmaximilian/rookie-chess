import { db, getSetting } from '#lib/db/db.js';
import { computeStreak } from './streak.js';
import { getPuzzleRating } from './rating.js';
import { getCourseProgress } from '#lib/openings/progress.js';
import { COURSES } from '#lib/openings/courses.js';
import { BASICS } from '#lib/basics/lessons.js';
import { LESSONS } from '#lib/endgames/lessons.js';
import { BOTS } from '#lib/bots/bots.js';
import { Game } from '#lib/chess/game.js';
import type { AchievementData } from './achievements.js';

export async function loadAchievementData(): Promise<AchievementData> {
	const progress = await getCourseProgress();
	const endgames = await db.endgames.toArray();
	const botGames = await db.games.where('source').equals('bot').toArray();
	let mateWins = 0;
	for (const g of botGames.slice(-200)) {
		const won =
			(g.result === '1-0') === (g.myColor === 'white') &&
			g.result !== '1/2-1/2' &&
			g.result !== '*';
		if (!won) continue;
		try {
			if (Game.fromUciMoves(g.moves, g.startFen).end()?.kind === 'checkmate') mateWins++;
		} catch {
			/* ungültig */
		}
	}
	return {
		puzzlesSolved: await db.puzzleAttempts.filter((a) => a.solved).count(),
		streak: computeStreak(await db.activity.toArray()).days,
		botsBeaten: (await getSetting<string[]>('botsBeaten', [])).length,
		botsTotal: BOTS.length,
		mateWins,
		basicsDone: (await getSetting<string[]>('basicsDone', [])).length,
		basicsTotal: BASICS.length,
		courseLines: Object.values(progress).reduce((s, c) => s + Object.keys(c).length, 0),
		coursesComplete: COURSES.filter((c) => c.lines.every((l) => progress[c.id]?.[l.id])).length,
		endgameLessons: endgames.filter((e) => e.stars > 0).length,
		endgameTotal: LESSONS.length,
		endgameThreeStars: endgames.filter((e) => e.stars >= 3).length,
		puzzleRating: Math.round((await getPuzzleRating()).rating),
		stormBest: await getSetting<number>('stormBest', 0),
		planDays: (await getSetting<string[]>('planDaysDone', [])).length,
		gamesReviewed: (await getSetting<number[]>('reviewedGames', [])).length,
		friendGames: await getSetting<number>('friendGames', 0)
	};
}
