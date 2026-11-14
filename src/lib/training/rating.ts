import { db, getSetting, setSetting } from '#lib/db/db.js';
import { BEGINNER_RATING, updateForPuzzle, type Rating } from './glicko2.js';

export async function getPuzzleRating(): Promise<Rating> {
	return getSetting<Rating>('puzzleRating', BEGINNER_RATING);
}

/** @param solved true/false oder Punktzahl (½ = mit Hinweis gelöst) */
export async function applyPuzzleResult(
	puzzleRating: number,
	solved: boolean | number
): Promise<{ before: Rating; after: Rating }> {
	const before = await getPuzzleRating();
	const after = updateForPuzzle(before, puzzleRating, solved);
	await setSetting('puzzleRating', after);
	await db.ratings.add({ area: 'puzzle', date: Date.now(), rating: Math.round(after.rating) });
	return { before, after };
}

/** Ist das Rating noch unsicher (wenige Puzzles)? */
export function isProvisional(r: Rating): boolean {
	return r.rd > 110;
}

/** Jüngste Ergebnisse gewerteter Lichess-Puzzles (für die Schwierigkeits-Regelung), älteste zuerst */
export async function recentPuzzleResults(n = 20): Promise<boolean[]> {
	const rows = await db.puzzleAttempts
		.orderBy('date')
		.reverse()
		.limit(n * 3)
		.toArray();
	return rows
		.filter((a) => a.source === 'lichess')
		.slice(0, n)
		.map((a) => a.solved && !a.hinted)
		.reverse();
}
