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
/** Patzer je 30 eigene Züge: 0 → 100, 2,5 → 50, 5 oder mehr → 0 */
export const safetyScore = (blundersPer30: number) => clamp(100 - blundersPer30 * 20);
/** Anteil genutzter Chancen (Fehler des Gegners sofort bestraft) in Prozent = Punkte */
export const tacticsScore = (takenPct: number) => clamp(takenPct);

/** Mindestanzahl analysierter Partien, bevor Sicherheit gezeigt wird */
export const MIN_GAMES = 3;
/** Mindestanzahl an Gelegenheiten (Fehler des Gegners), bevor Taktik gezeigt wird */
export const MIN_CHANCES = 5;

/**
 * Alle fünf Werte stammen nur aus deinen analysierten Partien – keine Puzzles, keine Schätzung.
 * Jede Ecke misst etwas Eigenes:
 * - Eröffnung, Mittelspiel, Endspiel: Genauigkeit deiner Züge in dieser Phase (Phase nach Material)
 * - Taktik: wie oft du einen Fehler des Gegners sofort bestrafst
 * - Sicherheit: wie selten du patzt (je 30 eigene Züge, unabhängig von der Partielänge)
 */
export function skillProfile(
	stats: Pick<GameStats, 'phaseAccuracy' | 'analysed' | 'blundersPer30' | 'chances'>
): SkillValue[] {
	const phase = (p: 'opening' | 'middlegame' | 'endgame'): SkillValue => {
		const a = stats.phaseAccuracy[p];
		return { skill: p, score: a === null ? null : accuracyScore(a), raw: a };
	};
	const c = stats.chances;
	const taken = c.total >= MIN_CHANCES ? Math.round((c.taken / c.total) * 100) : null;
	const bp30 = stats.analysed >= MIN_GAMES ? stats.blundersPer30 : null;
	return [
		phase('opening'),
		phase('middlegame'),
		{ skill: 'tactics', score: taken === null ? null : tacticsScore(taken), raw: taken },
		phase('endgame'),
		{ skill: 'safety', score: bp30 === null ? null : safetyScore(bp30), raw: bp30 }
	];
}

/** Die schwächste Fähigkeit mit Daten – für den Hinweis unter dem Radar */
export function weakestSkill(values: SkillValue[]): SkillValue | null {
	const known = values.filter((v) => v.score !== null);
	return known.length >= 2 ? known.reduce((a, b) => (b.score! < a.score! ? b : a)) : null;
}
