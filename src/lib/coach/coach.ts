import { attacks } from 'chessops/attacks';
import { makeSquare, parseUci } from 'chessops/util';
import type { NormalMove, Role } from 'chessops/types';
import { engine } from '#lib/engine/engine.js';
import { toWhite } from '#lib/engine/uci.js';
import { Game, positionFromFen, sanForUci, turnFromFen } from '#lib/chess/game.js';
import { figurine, VALUE } from '#lib/chess/notation.js';
import { judge, type Judgement, type PlyEval } from '#lib/analysis/classify.js';
import { explain } from '#lib/analysis/explain.js';
import { autoNote } from '#lib/openings/courses.js';
import { t } from '#lib/i18n/i18n.svelte.js';

export interface CoachNote {
	judgement: Judgement;
	title: string;
	text: string;
	/** besserer Zug (UCI), wenn der eigene Zug ein Fehler war */
	better?: string;
	/** Fehler, bei dem der Coach anbietet, den Zug zurückzunehmen */
	serious: boolean;
}

const cache = new Map<string, PlyEval>();

async function evalFen(fen: string, signal?: AbortSignal): Promise<PlyEval> {
	const hit = cache.get(fen);
	if (hit) return hit;
	const g = new Game(fen);
	const end = g.end();
	if (end?.kind === 'checkmate') return { cp: g.turn === 'white' ? -10000 : 10000 };
	if (end) return { cp: 0 };
	const res = await engine.analyse({ fen, depth: 11, multipv: 1, signal });
	const top = res.lines[0];
	const score = top ? toWhite({ cp: top.cp, mate: top.mate }, turnFromFen(fen)) : { cp: 0 };
	const e: PlyEval = { ...score, best: res.bestmove ?? undefined, pv: top?.pv.slice(0, 8) };
	if (cache.size > 400) cache.clear();
	cache.set(fen, e);
	return e;
}

/** Bewertet den gerade gespielten eigenen Zug wie ein Trainer */
export async function assessMove(
	fenBefore: string,
	uci: string,
	signal?: AbortSignal
): Promise<CoachNote | null> {
	const g = new Game(fenBefore);
	const mover = g.turn;
	if (!g.play(uci)) return null;
	const before = await evalFen(fenBefore, signal);
	const after = await evalFen(g.fen, signal);
	if (signal?.aborted) return null;
	const { judgement } = judge(before, after, mover, uci);
	const san = figurine(sanForUci(fenBefore, uci));

	if (g.end()?.kind === 'checkmate')
		return {
			judgement: 'best',
			title: t('coach.mateTitle'),
			text: t('coach.mateText'),
			serious: false
		};

	if (judgement === 'best' || judgement === 'good') {
		const why = autoNote(fenBefore, uci);
		return {
			judgement,
			title: judgement === 'best' ? t('coach.bestTitle', { san }) : t('coach.goodTitle', { san }),
			text: why || (judgement === 'best' ? t('coach.bestText') : t('coach.goodText')),
			serious: false
		};
	}

	const ex = explain(fenBefore, uci, before, after, judgement);
	const better = before.best;
	return {
		judgement,
		title: ex?.title ?? t(`judgement.${judgement}`),
		text: ex?.text ?? t('coach.worseText'),
		better,
		serious: judgement === 'mistake' || judgement === 'blunder'
	};
}

/** Nach dem Gegnerzug: eigene Figuren, die angegriffen und nicht ausreichend gedeckt sind */
export function threats(fen: string): { role: Role; square: string }[] {
	const pos = positionFromFen(fen);
	const me = pos.turn;
	const them = me === 'white' ? 'black' : 'white';
	const occ = pos.board.occupied;
	const out: { role: Role; square: string }[] = [];
	for (const sq of pos.board[me]) {
		const piece = pos.board.get(sq)!;
		if (piece.role === 'king') continue;
		let cheapestAttacker = Infinity;
		let defended = false;
		for (const from of pos.board[them]) {
			const p = pos.board.get(from)!;
			if (attacks(p, from, occ).has(sq))
				cheapestAttacker = Math.min(cheapestAttacker, VALUE[p.role] || 100);
		}
		if (cheapestAttacker === Infinity) continue;
		for (const from of pos.board[me]) {
			if (from === sq) continue;
			const p = pos.board.get(from)!;
			if (attacks(p, from, occ).has(sq)) defended = true;
		}
		// hängt (ungedeckt) oder wird von einer billigeren Figur angegriffen
		if (!defended || cheapestAttacker < VALUE[piece.role])
			out.push({ role: piece.role, square: makeSquare(sq) });
	}
	return out.sort((a, b) => VALUE[b.role] - VALUE[a.role]);
}

/** Was der letzte Gegnerzug bezweckt – nur einfache, sichere Aussagen */
export function opponentIdea(fenBefore: string, uci: string): string {
	const pos = positionFromFen(fenBefore);
	const mv = parseUci(uci) as NormalMove;
	const piece = pos.board.get(mv.from);
	if (!piece) return '';
	const g = new Game(fenBefore);
	g.play(uci);
	if (g.isCheck) return t('coach.oppCheck');
	return autoNote(fenBefore, uci);
}
