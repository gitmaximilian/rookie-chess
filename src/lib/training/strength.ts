import type { Rating } from './glicko2.js';

export interface StrengthInput {
	puzzle?: Rating | null;
	/** Elo der besiegten Bots */
	botsBeaten?: number[];
	/** jüngste Online-Wertung (Lichess/Chess.com), falls vorhanden */
	online?: { rating: number; source: 'lichess' | 'chesscom' } | null;
}

export interface Strength {
	/** geschätzte Spielstärke (Elo-ähnlich), gerundet auf 25 */
	value: number;
	/** wie sicher: 0 = Bauchgefühl … 1 = belastbar */
	confidence: number;
}

/**
 * Grobe Schätzung der Spielstärke aus allem, was Rookie weiß.
 * - Puzzle-Wertungen liegen erfahrungsgemäß deutlich über der Partie-Stärke (−200)
 * - Lichess-Wertungen liegen über Chess.com/FIDE-ähnlichen Werten (−150)
 * - ein besiegter Bot zeigt eine Untergrenze
 */
export function estimateStrength(input: StrengthInput): Strength | null {
	const parts: { v: number; w: number }[] = [];
	if (input.puzzle && input.puzzle.rd < 300) {
		const w = Math.max(0.2, 1 - input.puzzle.rd / 300);
		parts.push({ v: input.puzzle.rating - 200, w });
	}
	if (input.online) {
		const v = input.online.rating - (input.online.source === 'lichess' ? 150 : 0);
		parts.push({ v, w: 1.5 });
	}
	const best = input.botsBeaten?.length ? Math.max(...input.botsBeaten) : null;
	if (best !== null) parts.push({ v: best + 50, w: 0.6 });
	if (!parts.length) return null;
	const total = parts.reduce((s, p) => s + p.w, 0);
	let value = parts.reduce((s, p) => s + p.v * p.w, 0) / total;
	if (best !== null) value = Math.max(value, best);
	return {
		value: Math.max(100, Math.round(value / 25) * 25),
		confidence: Math.min(1, total / 2.5)
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
