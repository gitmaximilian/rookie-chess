import type { Game } from '#lib/chess/game.js';
import type { Lesson } from './lessons.js';
import type { TbResult } from './tablebase.js';

export type Verdict =
	| { status: 'continue' }
	| { status: 'success'; message: string; params?: Record<string, number> }
	| { status: 'fail'; message: string; params?: Record<string, number> };

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
		if (end.kind === 'checkmate') return { status: 'success', message: 'endgame.msg.mate' };
		if (end.kind === 'stalemate')
			return win
				? {
						status: 'fail',
						message: 'endgame.msg.stalemateFail'
					}
				: { status: 'success', message: 'endgame.msg.stalemateOk' };
		if (win) return { status: 'fail', message: 'endgame.msg.drawFail' };
		return { status: 'success', message: 'endgame.msg.drawOk' };
	}

	const last = game.moves.at(-1);
	if (lesson.goal === 'promote' && last && /[qrbn]$/.test(last.uci) && last.uci.length === 5) {
		if (!tb || tb.category === 'loss' || tb.category === 'unknown')
			return { status: 'success', message: 'endgame.msg.promoted' };
	}

	if (tb && tb.source === 'tablebase') {
		if (win && tb.category === 'draw')
			return {
				status: 'fail',
				message: 'endgame.msg.throwsWin'
			};
		if (tb.category === 'win') return { status: 'fail', message: 'endgame.msg.oppWins' };
	}

	if (lesson.goal === 'draw' && playerMoves >= lesson.maxMoves)
		return { status: 'success', message: 'endgame.msg.survived', params: { n: lesson.maxMoves } };
	if (win && playerMoves >= lesson.maxMoves)
		return {
			status: 'fail',
			message: 'endgame.msg.tooSlow',
			params: { n: lesson.maxMoves }
		};
	return CONTINUE;
}

/** Prüft die Stellung nach dem Gegnerzug */
export function afterOpponentMove(lesson: Lesson, game: Game): Verdict {
	const end = game.end();
	if (!end) {
		// Bauer geschlagen → Gewinnversuch vorbei bzw. Verteidigung geschafft
		if (lesson.goal === 'draw' && game.materialBalance() === 0 && lesson.id === 'square')
			return { status: 'success', message: 'endgame.msg.pawnCaught' };
		return CONTINUE;
	}
	if (end.kind === 'checkmate') return { status: 'fail', message: 'endgame.msg.mated' };
	if (lesson.goal === 'draw') return { status: 'success', message: 'endgame.msg.drawn' };
	return { status: 'fail', message: 'endgame.msg.drawFail' };
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
