/**
 * Was auf deinem Niveau zählt: vier Stufen auf dem Weg zu 1600 (und darüber).
 *
 * Die Gewichtung je Stufe kommt aus den Lichess-Daten (lib/training/skills.ts `shareAt`): Welcher Anteil
 * des Abstands zu Spielern, die 200 Elo stärker sind, geht auf welche Fähigkeit zurück? Ergebnis:
 * - unter 800: Sicherheit ~50–60 %, Taktik ~20–30 % – Figuren nicht einstellen, Grundmatts
 * - 800–1200: Taktik ~25–45 %, Sicherheit ~40–55 % – das Brett sehen (Schachs, Schlagzüge, Angriffe)
 * - 1200–1600: Sicherheit bleibt ~55–63 %, Eröffnung ~10–18 %, Strategie wächst (~9–15 % um 1500)
 * - ab 1600: Endspiel und Strategie werden spürbar (~10 % und mehr)
 * Wo die Daten schweigen (z. B. welche Lektion zuerst), folgt die Stufe gängiger Trainer-Erfahrung.
 */
import { shareAt, SKILLS, type Skill } from './skills.js';

export type StageId = 'foundation' | 'vision' | 'solid' | 'plans';

export interface Stage {
	id: StageId;
	from: number;
	to: number;
	/** was in dieser Stufe trainiert wird (i18n: levels.focus.<id>.<key>), mit Ziel in der App */
	focus: { key: string; href: string }[];
}

export const STAGES: Stage[] = [
	{
		id: 'foundation',
		from: 0,
		to: 800,
		focus: [
			{ key: 'hanging', href: '/puzzles/scan?mode=hanging' },
			{ key: 'safety', href: '/puzzles/safety' },
			{ key: 'mates', href: '/learn/endgame' },
			{ key: 'tactics', href: '/puzzles' }
		]
	},
	{
		id: 'vision',
		from: 800,
		to: 1200,
		focus: [
			{ key: 'cca', href: '/puzzles/scan?mode=opponent' },
			{ key: 'motifs', href: '/learn' },
			{ key: 'punish', href: '/puzzles' },
			{ key: 'principles', href: '/learn/basics?id=principles' }
		]
	},
	{
		id: 'solid',
		from: 1200,
		to: 1600,
		focus: [
			{ key: 'safety', href: '/puzzles/safety' },
			{ key: 'repertoire', href: '/learn/openings' },
			{ key: 'positional', href: '/learn/basics?set=positional' },
			{ key: 'endgames', href: '/learn/endgame' }
		]
	},
	{
		id: 'plans',
		from: 1600,
		to: 2000,
		focus: [
			{ key: 'positional', href: '/learn/basics?set=positional' },
			{ key: 'rookEndgames', href: '/learn/endgame' },
			{ key: 'calculation', href: '/puzzles' },
			{ key: 'review', href: '/analysis' }
		]
	}
];

export function stageFor(elo: number | null): Stage {
	const e = elo ?? 600;
	return STAGES.find((s) => e < s.to) ?? STAGES[STAGES.length - 1];
}

/** Fähigkeiten nach Wichtigkeit für den nächsten Schritt (Anteil 0..1, absteigend) */
export function priorities(elo: number | null): { skill: Skill; share: number }[] {
	// geglättet über die Stufe: Mittel der Anteile bei elo−100, elo, elo+100
	const e = elo ?? 600;
	const avg = SKILLS.map((k) => ({
		skill: k,
		share: [e - 100, e, e + 100].reduce((s, x) => s + shareAt(Math.max(500, x))[k], 0) / 3
	}));
	return avg.sort((a, b) => b.share - a.share);
}
