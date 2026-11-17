import { Game } from '#lib/chess/game.js';
import { engine } from '#lib/engine/engine.js';
import { scoreToCp, winChance } from '#lib/engine/uci.js';

export interface DecisionPosition {
	id: string;
	fen: string;
}

const positions = (prefix: string, fens: string[]): DecisionPosition[] =>
	fens.map((fen, i) => ({ id: `${prefix}:${i + 1}`, fen }));

// Quiet opening positions alternate with hanging pieces and mating threats.
export const DECISION_PRACTICE = positions('decision-v1', [
	'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
	'4R3/pp5k/3p2p1/3P4/P1r2bP1/2r5/P1B5/1KR5 w - - 0 38',
	'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2',
	'8/2b5/8/2k2p2/1p3Pp1/1P2N1P1/3K4/8 b - - 15 62',
	'rnbqkb1r/pppppppp/5n2/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 1 2',
	'rn4k1/pp3ppp/2p1r3/8/1P1bpq2/PQ6/2P2PPP/1K1R1B1R b - - 1 18'
]);

// Fixed one-time form. Never offered in practice. Keep the IDs and FENs stable.
export const DECISION_TRANSFER = positions('transfer-v1', [
	'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2',
	'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
	'5rk1/5ppp/8/8/8/4Q3/5PPP/3R2K1 w - - 0 1',
	'rnbqkb1r/pp2pppp/2p2n2/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 2 4',
	'6k1/5ppp/8/8/2b5/2N5/5PPP/4R1K1 b - - 0 1',
	'8/3k4/3p4/1PpPp3/2P1P3/8/4K3/8 w - - 0 1'
]);

interface Assessment {
	good: boolean;
	example: string;
}

async function positionScore(game: Game, signal: AbortSignal) {
	const end = game.end();
	if (end) return { score: end.kind === 'checkmate' ? -1000 : 0, example: '', mateInOne: false };
	const result = await engine.analyse({ fen: game.fen, depth: 11, signal });
	const line = result.lines[0];
	if (!line || !result.bestmove || signal.aborted) throw new Error('Decision analysis incomplete');
	return { score: scoreToCp(line), example: result.bestmove, mateInOne: line.mate === 1 };
}

async function assess(game: Game, uci: string, signal: AbortSignal): Promise<Assessment> {
	const after = new Game(game.fen);
	if (!after.play(uci)) throw new Error('Illegal decision move');
	const best = await positionScore(game, signal);
	if (best.example === uci) return { good: true, example: uci };
	const followup = await positionScore(after, signal);
	return {
		good: best.mateInOne
			? after.end()?.kind === 'checkmate'
			: winChance(best.score) - winChance(-followup.score) <= 0.1,
		example: best.example
	};
}

export async function assessDecision(
	fen: string,
	candidate: string,
	reply: string | null,
	signal: AbortSignal
) {
	const front = new Game(fen);
	const own = await assess(front, candidate, signal);
	const back = Game.fromUciMoves([candidate], fen);
	const opponent = back.end() ? null : await assess(back, reply ?? '', signal);
	return { own, opponent };
}
