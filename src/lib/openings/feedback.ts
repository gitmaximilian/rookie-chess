import { engine } from '#lib/engine/engine.js';
import { toWhite } from '#lib/engine/uci.js';
import { Game, turnFromFen } from '#lib/chess/game.js';
import { judge, type PlyEval } from '#lib/analysis/classify.js';
import { explain } from '#lib/analysis/explain.js';
import { t } from '#lib/i18n/i18n.svelte.js';

export interface MoveFeedback {
	/** playable = kaum schlechter, aber nicht der Kurszug; dubious = ungenau; bad = Fehler */
	kind: 'playable' | 'dubious' | 'bad';
	title: string;
	text: string;
}

const cache = new Map<string, PlyEval>();

async function evalFen(fen: string, signal?: AbortSignal): Promise<PlyEval> {
	const hit = cache.get(fen);
	if (hit) return hit;
	const g = new Game(fen);
	const end = g.end();
	if (end?.kind === 'checkmate') return { cp: g.turn === 'white' ? -10000 : 10000 };
	if (end) return { cp: 0 };
	const res = await engine.analyse({ fen, depth: 12, multipv: 1, signal });
	const top = res.lines[0];
	const score = top ? toWhite({ cp: top.cp, mate: top.mate }, turnFromFen(fen)) : { cp: 0 };
	const e: PlyEval = { ...score, best: res.bestmove ?? undefined, pv: top?.pv.slice(0, 8) };
	cache.set(fen, e);
	return e;
}

/**
 * Bewertet einen Zug, der nicht im Kurs/Repertoire steht – mit Stockfish und
 * denselben Erklärungsregeln wie die Partieanalyse.
 */
export async function feedbackFor(
	fen: string,
	uci: string,
	signal?: AbortSignal
): Promise<MoveFeedback | null> {
	const g = new Game(fen);
	const mover = g.turn;
	if (!g.play(uci)) return null;
	const [before, after] = [await evalFen(fen, signal), await evalFen(g.fen, signal)];
	if (signal?.aborted) return null;
	const { judgement } = judge(before, after, mover, uci);
	if (judgement === 'best' || judgement === 'good')
		return {
			kind: 'playable',
			title: t('course.fb.playableTitle'),
			text: t('course.fb.playableText')
		};
	const ex = explain(fen, uci, before, after, judgement);
	return {
		kind: judgement === 'inaccuracy' ? 'dubious' : 'bad',
		title: ex?.title ?? t('course.fb.dubiousTitle'),
		text: ex?.text ?? t('course.fb.dubiousText')
	};
}
