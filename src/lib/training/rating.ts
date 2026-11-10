import { db, getSetting, setSetting } from '#lib/db/db.js';
import { BEGINNER_RATING, updateForPuzzle, type Rating } from './glicko2.js';

export async function getPuzzleRating(): Promise<Rating> {
	return getSetting<Rating>('puzzleRating', BEGINNER_RATING);
}

export async function applyPuzzleResult(
	puzzleRating: number,
	solved: boolean
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
