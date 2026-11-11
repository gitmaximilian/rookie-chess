import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, unlocked, type AchievementData } from './achievements';

const zero: AchievementData = {
	puzzlesSolved: 0,
	streak: 0,
	botsBeaten: 0,
	botsTotal: 8,
	mateWins: 0,
	basicsDone: 0,
	basicsTotal: 15,
	courseLines: 0,
	coursesComplete: 0,
	endgameLessons: 0,
	endgameTotal: 7,
	endgameThreeStars: 0,
	puzzleRating: 500,
	stormBest: 0,
	planDays: 0,
	gamesReviewed: 0,
	friendGames: 0
};

describe('Erfolge', () => {
	it('neu: nichts freigeschaltet, IDs eindeutig', () => {
		expect(unlocked(zero)).toEqual([]);
		expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
	});
	it('schaltet nach Daten frei', () => {
		const ids = unlocked({
			...zero,
			puzzlesSolved: 60,
			streak: 3,
			botsBeaten: 8,
			puzzleRating: 1010
		});
		expect(ids).toEqual(
			expect.arrayContaining([
				'firstPuzzle',
				'puzzles50',
				'streak3',
				'firstWin',
				'bots4',
				'botsAll',
				'rating1000'
			])
		);
		expect(ids).not.toContain('puzzles250');
	});
	it('Fortschritt ist anteilig', () => {
		const a = ACHIEVEMENTS.find((x) => x.id === 'puzzles50')!;
		expect(a.progress({ ...zero, puzzlesSolved: 25 })).toBe(0.5);
	});
});
