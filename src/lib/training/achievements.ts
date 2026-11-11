/** Erfolge: werden aus vorhandenen Daten berechnet – nichts muss extra mitgezählt werden. */
export interface AchievementData {
	puzzlesSolved: number;
	streak: number;
	botsBeaten: number;
	botsTotal: number;
	mateWins: number;
	basicsDone: number;
	basicsTotal: number;
	courseLines: number;
	coursesComplete: number;
	endgameLessons: number;
	endgameTotal: number;
	endgameThreeStars: number;
	puzzleRating: number;
	stormBest: number;
	planDays: number;
	gamesReviewed: number;
	friendGames: number;
}

export interface Achievement {
	id: string;
	icon: string;
	/** Fortschritt 0..1 */
	progress: (d: AchievementData) => number;
}

const at = (v: number, goal: number) => Math.min(1, v / goal);

export const ACHIEVEMENTS: Achievement[] = [
	{ id: 'firstPuzzle', icon: '🧩', progress: (d) => at(d.puzzlesSolved, 1) },
	{ id: 'puzzles50', icon: '🎯', progress: (d) => at(d.puzzlesSolved, 50) },
	{ id: 'puzzles250', icon: '🏹', progress: (d) => at(d.puzzlesSolved, 250) },
	{ id: 'rating1000', icon: '📈', progress: (d) => at(d.puzzleRating, 1000) },
	{ id: 'rating1500', icon: '🚀', progress: (d) => at(d.puzzleRating, 1500) },
	{ id: 'streak3', icon: '🔥', progress: (d) => at(d.streak, 3) },
	{ id: 'streak7', icon: '📅', progress: (d) => at(d.streak, 7) },
	{ id: 'streak30', icon: '🏆', progress: (d) => at(d.streak, 30) },
	{ id: 'firstWin', icon: '♟️', progress: (d) => at(d.botsBeaten, 1) },
	{ id: 'firstMate', icon: '👑', progress: (d) => at(d.mateWins, 1) },
	{ id: 'bots4', icon: '🤖', progress: (d) => at(d.botsBeaten, 4) },
	{ id: 'botsAll', icon: '🦾', progress: (d) => at(d.botsBeaten, d.botsTotal) },
	{ id: 'basicsAll', icon: '🎓', progress: (d) => at(d.basicsDone, d.basicsTotal) },
	{ id: 'firstLine', icon: '📖', progress: (d) => at(d.courseLines, 1) },
	{ id: 'firstCourse', icon: '📚', progress: (d) => at(d.coursesComplete, 1) },
	{ id: 'endgameFirst', icon: '🏁', progress: (d) => at(d.endgameLessons, 1) },
	{ id: 'endgameAll', icon: '♚', progress: (d) => at(d.endgameLessons, d.endgameTotal) },
	{ id: 'endgamePerfect', icon: '⭐', progress: (d) => at(d.endgameThreeStars, d.endgameTotal) },
	{ id: 'storm20', icon: '⚡', progress: (d) => at(d.stormBest, 20) },
	{ id: 'plan7', icon: '✅', progress: (d) => at(d.planDays, 7) },
	{ id: 'analyst', icon: '🔍', progress: (d) => at(d.gamesReviewed, 1) },
	{ id: 'friends', icon: '🤝', progress: (d) => at(d.friendGames, 1) }
];

export function unlocked(d: AchievementData): string[] {
	return ACHIEVEMENTS.filter((a) => a.progress(d) >= 1).map((a) => a.id);
}
