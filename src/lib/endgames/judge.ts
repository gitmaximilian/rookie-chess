import type { Game } from '#lib/chess/game.js';
import type { Lesson } from './lessons.js';
import type { TbResult } from './tablebase.js';

export type Verdict =
	| { status: 'continue' }
	| { status: 'success'; message: string }
	| { status: 'fail'; message: string };

const CONTINUE: Verdict = { status: 'continue' };

/**
 * Prüft die Stellung nach dem eigenen Zug.
 * @param tb Tablebase-Ergebnis der neuen Stellung (Gegner am Zug), falls vorhanden
 */
export function afterPlayerMove(
	lesson: Lesson,
	game: Game,
	playerMoves: number,
	tb: TbResult | null
): Verdict {
	const end = game.end();
	const win = lesson.goal !== 'draw';
	if (end) {
		if (end.kind === 'checkmate') return { status: 'success', message: 'Schachmatt – perfekt!' };
		if (end.kind === 'stalemate')
			return win
				? {
						status: 'fail',
						message:
							'Patt! Der gegnerische König hat kein Feld mehr, steht aber nicht im Schach – nur remis.'
					}
				: { status: 'success', message: 'Patt – remis gehalten!' };
		if (win) return { status: 'fail', message: 'Remis – der Gewinn ist weg.' };
		return { status: 'success', message: 'Remis – sauber verteidigt!' };
	}

	const last = game.moves.at(-1);
	if (lesson.goal === 'promote' && last && /[qrbn]$/.test(last.uci) && last.uci.length === 5) {
		if (!tb || tb.category === 'loss' || tb.category === 'unknown')
			return { status: 'success', message: 'Umgewandelt – die neue Dame entscheidet die Partie!' };
	}

	if (tb && tb.source === 'tablebase') {
		if (win && tb.category === 'draw')
			return {
				status: 'fail',
				message: 'Dieser Zug verschenkt den Sieg – die Stellung ist jetzt nur noch remis.'
			};
		if (tb.category === 'win')
			return { status: 'fail', message: 'Nach diesem Zug gewinnt dein Gegner.' };
	}

	if (lesson.goal === 'draw' && playerMoves >= lesson.maxMoves)
		return { status: 'success', message: `${lesson.maxMoves} Züge überstanden – remis gehalten!` };
	if (win && playerMoves >= lesson.maxMoves)
		return {
			status: 'fail',
			message: `Ziel nicht in ${lesson.maxMoves} Zügen erreicht. Versuch es effizienter!`
		};
	return CONTINUE;
}

/** Prüft die Stellung nach dem Gegnerzug */
export function afterOpponentMove(lesson: Lesson, game: Game): Verdict {
	const end = game.end();
	if (!end) {
		// Bauer geschlagen → Gewinnversuch vorbei bzw. Verteidigung geschafft
		if (lesson.goal === 'draw' && game.materialBalance() === 0 && lesson.id === 'square')
			return { status: 'success', message: 'Bauer erwischt – remis!' };
		return CONTINUE;
	}
	if (end.kind === 'checkmate') return { status: 'fail', message: 'Du wurdest mattgesetzt.' };
	if (lesson.goal === 'draw') return { status: 'success', message: 'Remis – geschafft!' };
	return { status: 'fail', message: 'Remis – der Gewinn ist weg.' };
}

/** Sterne: 3 = effizient ohne Hilfe, 2 = geschafft, 1 = mit vielen Tipps */
export function stars(
	lesson: Lesson,
	playerMoves: number,
	hints: number,
	startDtm: number | null
): number {
	if (hints >= 3) return 1;
	const optimal = startDtm ? Math.ceil(Math.abs(startDtm) / 2) : null;
	const efficient = lesson.goal === 'draw' || !optimal || playerMoves <= optimal + 4;
	if (hints === 0 && efficient) return 3;
	return 2;
}
