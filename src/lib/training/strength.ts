import type { Rating } from './glicko2.js';

export interface StrengthInput {
	puzzle?: Rating | null;
	/** Elo der besiegten Bots */
	botsBeaten?: number[];
	/** jüngste Online-Wertung (Lichess/Chess.com), falls vorhanden */
	online?: { rating: number; source: 'lichess' | 'chesscom' } | null;
	/** Gesamtniveau aus den eigenen analysierten Partien (Skill-Penta) und wie viele Partien einflossen */
	games?: { elo: number; games: number } | null;
}

export type StrengthSource = 'online' | 'games' | 'puzzle' | 'bots';

export interface Strength {
	/** geschätzte Spielstärke auf der Lichess-Skala (Rapid/Classical), gerundet auf 25 */
	value: number;
	/** wie sicher: 0 = Bauchgefühl … 1 = belastbar */
	confidence: number;
	/** woraus die Zahl besteht (für „aus Partien ≈ …, Puzzles ≈ …“) */
	parts: { source: StrengthSource; value: number }[];
}

/**
 * Umrechnung auf die **Lichess-Skala** – an ihr sind Skill-Penta, Stufen und alle Schwellen geeicht
 * (Lichess-Partien je Wertungsband). Bis v0.6 rechnete Rookie „FIDE-ähnlich“ (Lichess −150); dadurch lagen
 * Spielstärke und Penta bei denselben Daten ~150 auseinander. Die Abstände der Quellen bleiben gleich:
 * - Chess.com-Wertungen liegen unter Lichess-Wertungen (+150)
 * - Puzzle-Wertungen liegen über der Partie-Stärke (−50 gegenüber Lichess, früher −200 gegenüber FIDE)
 * - Bot-Angaben sind Schätzungen (siehe unten), wie bisher +150 zur alten Skala
 */
export const OFFSET = { lichess: 0, chesscom: 150, puzzle: -50, bots: 150 } as const;

/**
 * Spielstärke aus allem, was Rookie weiß.
 * - Online-Wertung: die echte Messung, stärkstes Gewicht
 * - eigene Partien (Penta-Gesamtniveau): geprüft an echten Spielern ±230 Elo ab ~12 Partien (Holdout,
 *   docs/research-2026-11-13.md) – Gewicht wächst mit der Zahl der Partien
 * - Puzzle-Wertung: nach Sicherheit (RD) gewichtet
 * - ein besiegter Bot ist nur ein schwaches Indiz: Die Bot-Stärken sind Schätzungen; gemessen
 *   (scripts/research/bot-ladder.mjs, bot-human.mjs) weichen die Abstände untereinander deutlich von
 *   den Angaben ab, und Bots patzen anders als Menschen. Deshalb kleines Gewicht und keine Untergrenze.
 */
export function estimateStrength(input: StrengthInput): Strength | null {
	const parts: { source: StrengthSource; v: number; w: number }[] = [];
	if (input.online) {
		parts.push({
			source: 'online',
			v: input.online.rating + OFFSET[input.online.source],
			w: 1.5
		});
	}
	if (input.games && input.games.games >= 5) {
		parts.push({ source: 'games', v: input.games.elo, w: Math.min(1.5, input.games.games / 10) });
	}
	if (input.puzzle && input.puzzle.rd < 300) {
		const w = Math.max(0.2, 1 - input.puzzle.rd / 300);
		parts.push({ source: 'puzzle', v: input.puzzle.rating + OFFSET.puzzle, w });
	}
	const best = input.botsBeaten?.length ? Math.max(...input.botsBeaten) : null;
	if (best !== null) parts.push({ source: 'bots', v: best + OFFSET.bots, w: 0.3 });
	if (!parts.length) return null;
	const total = parts.reduce((s, p) => s + p.w, 0);
	const value = parts.reduce((s, p) => s + p.v * p.w, 0) / total;
	return {
		value: Math.max(100, Math.round(value / 25) * 25),
		confidence: Math.min(1, total / 2.5),
		parts: parts.map((p) => ({ source: p.source, value: Math.round(p.v / 25) * 25 }))
	};
}

/** Ziel der App: Einsteiger auf 1600 – in Etappen, damit das nächste Ziel erreichbar wirkt */
export const GOAL = 1600;
export const MILESTONES = [800, 1000, 1200, 1400, 1600];

/** nächstes Etappenziel und Fortschritt dorthin (0..1) ab dem vorigen */
export function nextMilestone(value: number): { goal: number; from: number; progress: number } {
	const goal = MILESTONES.find((m) => m > value) ?? GOAL;
	const i = MILESTONES.indexOf(goal);
	const from = i > 0 ? MILESTONES[i - 1] : Math.min(value, goal - 200);
	const progress = value >= goal ? 1 : Math.max(0, Math.min(1, (value - from) / (goal - from)));
	return { goal, from, progress };
}
