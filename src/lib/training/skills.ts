/**
 * Spielerprofil für das Coach-Radar: fünf Fähigkeiten auf einer Skala 0–100.
 * Reine Funktion – testbar, ohne Datenbank.
 */
import type { GameStats } from './gamestats.js';

export type Skill = 'opening' | 'middlegame' | 'endgame' | 'tactics' | 'safety';

export const SKILLS: Skill[] = ['opening', 'middlegame', 'tactics', 'endgame', 'safety'];

export interface SkillValue {
	skill: Skill;
	/** 0–100, null = noch keine Daten */
	score: number | null;
	/** Rohwert für die Anzeige (z. B. 78 % Genauigkeit, 1,2 Patzer) */
	raw: number | null;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Genauigkeit 50 % → 0, 75 % → 50, 100 % → 100 (Anfänger liegen meist bei 60–85 %) */
export const accuracyScore = (acc: number) => clamp((acc - 50) * 2);
/** 0 Patzer pro Partie → 100, 3 oder mehr → 0 */
export const safetyScore = (blundersPerGame: number) => clamp(100 - (blundersPerGame * 100) / 3);
/** Puzzle-Wertung 400 → 0, 1200 → 50, 2000 → 100 */
export const tacticsScore = (rating: number) => clamp((rating - 400) / 16);

export function skillProfile(
	stats: Pick<GameStats, 'phaseAccuracy' | 'perGame' | 'analysed'>,
	puzzle: { rating: number; attempts: number }
): SkillValue[] {
	const phase = (p: 'opening' | 'middlegame' | 'endgame'): SkillValue => {
		const a = stats.phaseAccuracy[p];
		return { skill: p, score: a === null ? null : accuracyScore(a), raw: a };
	};
	const bpg = stats.analysed ? stats.perGame.blunders : null;
	return [
		phase('opening'),
		phase('middlegame'),
		{
			skill: 'tactics',
			score: puzzle.attempts >= 5 ? tacticsScore(puzzle.rating) : null,
			raw: puzzle.attempts >= 5 ? Math.round(puzzle.rating) : null
		},
		phase('endgame'),
		{ skill: 'safety', score: bpg === null ? null : safetyScore(bpg), raw: bpg }
	];
}

/** Die schwächste Fähigkeit mit Daten – für den Hinweis unter dem Radar */
export function weakestSkill(values: SkillValue[]): SkillValue | null {
	const known = values.filter((v) => v.score !== null);
	return known.length >= 2 ? known.reduce((a, b) => (b.score! < a.score! ? b : a)) : null;
}
