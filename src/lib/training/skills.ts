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
/** Patzer pro Partie: 0 → 100, 2,5 → 50, 5 oder mehr → 0 */
export const safetyScore = (blundersPerGame: number) => clamp(100 - blundersPerGame * 20);
/** Taktische Fehler pro Partie (hängende Figuren, Gabeln, verpasste Gewinne/Matts): 0 → 100, 4+ → 0 */
export const tacticsScore = (errorsPerGame: number) => clamp(100 - errorsPerGame * 25);

/** Mindestanzahl analysierter Partien, bevor Taktik und Sicherheit gezeigt werden */
export const MIN_GAMES = 3;

/**
 * Alle fünf Werte stammen nur aus deinen analysierten Partien – keine Puzzles, keine Schätzung.
 */
export function skillProfile(
	stats: Pick<GameStats, 'phaseAccuracy' | 'perGame' | 'analysed' | 'motifs'>
): SkillValue[] {
	const phase = (p: 'opening' | 'middlegame' | 'endgame'): SkillValue => {
		const a = stats.phaseAccuracy[p];
		return { skill: p, score: a === null ? null : accuracyScore(a), raw: a };
	};
	const enough = stats.analysed >= MIN_GAMES;
	const tactical = stats.motifs
		.filter((m) => m.motif !== 'positional')
		.reduce((sum, m) => sum + m.n, 0);
	const tpg = enough ? Math.round((tactical / stats.analysed) * 10) / 10 : null;
	const bpg = enough ? stats.perGame.blunders : null;
	return [
		phase('opening'),
		phase('middlegame'),
		{ skill: 'tactics', score: tpg === null ? null : tacticsScore(tpg), raw: tpg },
		phase('endgame'),
		{ skill: 'safety', score: bpg === null ? null : safetyScore(bpg), raw: bpg }
	];
}

/** Die schwächste Fähigkeit mit Daten – für den Hinweis unter dem Radar */
export function weakestSkill(values: SkillValue[]): SkillValue | null {
	const known = values.filter((v) => v.score !== null);
	return known.length >= 2 ? known.reduce((a, b) => (b.score! < a.score! ? b : a)) : null;
}
