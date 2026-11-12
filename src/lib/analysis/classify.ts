import { scoreToCp, winChance, type Score } from '#lib/engine/uci.js';
import { t } from '#lib/i18n/i18n.svelte.js';

export type Judgement = 'blunder' | 'mistake' | 'inaccuracy' | 'good' | 'best';

export interface PlyEval extends Score {
	/** bester Zug in dieser Stellung (UCI) */
	best?: string;
	/** Hauptvariante */
	pv?: string[];
	/** Bewertung des zweitbesten Zugs (für „einziger guter Zug“) – erst ab Analyse-Version 2 */
	second?: Score;
}

export const MARK: Record<Judgement, '??' | '?' | '?!' | '' | '!'> = {
	blunder: '??',
	mistake: '?',
	inaccuracy: '?!',
	good: '',
	best: ''
};

export function judgementLabel(j: Judgement): string {
	return t(`judgement.${j}`);
}

/** Gewinnchance (0..1) aus Sicht von Weiß */
export function whiteWin(e: Score): number {
	return winChance(scoreToCp(e));
}

/**
 * Bewertet den Zug, der von Stellung `before` zu `after` führt.
 * Beide Bewertungen aus Sicht von Weiß. Schwellen wie bei Lichess.
 */
export function judge(
	before: PlyEval,
	after: PlyEval,
	mover: 'white' | 'black',
	played: string
): { judgement: Judgement; loss: number } {
	const sign = mover === 'white' ? 1 : -1;
	const wBefore = mover === 'white' ? whiteWin(before) : 1 - whiteWin(before);
	const wAfter = mover === 'white' ? whiteWin(after) : 1 - whiteWin(after);
	// Lichess-Skala (−1..1) → doppelte Differenz der 0..1-Gewinnchance
	const loss = Math.max(0, wBefore - wAfter) * 2;

	// Matt verpasst, obwohl erzwungen → mindestens Fehler
	const hadMate = before.mate !== undefined && sign * before.mate > 0;
	const stillMate = after.mate !== undefined && sign * after.mate > 0;

	if (played === before.best) return { judgement: 'best', loss };
	// Matt zugelassen, das vorher nicht drohte → immer ein Patzer (auch in verlorener Stellung)
	const allowsMate = after.mate !== undefined && sign * after.mate < 0;
	const wasMated = before.mate !== undefined && sign * before.mate < 0;
	if (allowsMate && !wasMated) return { judgement: 'blunder', loss };
	if (loss >= 0.3) return { judgement: 'blunder', loss };
	if (loss >= 0.2 || (hadMate && !stillMate && loss >= 0.05)) return { judgement: 'mistake', loss };
	if (loss >= 0.1) return { judgement: 'inaccuracy', loss };
	return { judgement: 'good', loss };
}

/** Genauigkeit 0–100 aus dem durchschnittlichen Verlust an Gewinnchance (vereinfacht nach Lichess) */
export function accuracy(losses: number[]): number {
	if (!losses.length) return 100;
	// Verlust in Prozentpunkten der 0..1-Gewinnchance
	const avg = (losses.reduce((a, b) => a + b, 0) / losses.length) * 50;
	const acc = 103.1668 * Math.exp(-0.04354 * avg) - 3.1669;
	return Math.max(0, Math.min(100, Math.round(acc)));
}
