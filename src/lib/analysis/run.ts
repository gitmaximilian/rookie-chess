import { createEmptyCard } from 'ts-fsrs';
import { t } from '#lib/i18n/i18n.svelte.js';
import { engine } from '#lib/engine/engine.js';
import { toWhite } from '#lib/engine/uci.js';
import { Game, turnFromFen } from '#lib/chess/game.js';
import { db, type GameRow } from '#lib/db/db.js';
import { judge, type PlyEval, type Judgement } from './classify.js';
import { explain, type Explanation } from './explain.js';
import { moveKind, type Kind } from './kinds.js';
import { isBookLine } from '#lib/data/openings.js';
import type { Puzzle } from '#lib/training/puzzles.js';

export interface MoveReview {
	ply: number;
	mover: 'white' | 'black';
	judgement: Judgement;
	/** feinere Zugart für die Besprechung */
	kind: Kind;
	loss: number;
	explanation: Explanation | null;
}

function searchDepth(): number {
	const mobile =
		typeof navigator !== 'undefined' && /iPhone|iPad|Android/.test(navigator.userAgent);
	return mobile ? 11 : 13;
}

/**
 * Analysiert alle Stellungen einer Partie (setzt bei Abbruch fort).
 * Speichert regelmäßig in der Datenbank.
 */
export async function analyseGame(
	row: GameRow,
	onProgress: (done: number, total: number, evals: PlyEval[]) => void,
	signal?: AbortSignal
): Promise<PlyEval[]> {
	const game = Game.fromUciMoves(row.moves, row.startFen);
	const total = game.ply + 1;
	const depth = searchDepth();
	const evals: PlyEval[] = row.analysis?.evals ? [...row.analysis.evals] : [];

	for (let ply = evals.length; ply < total; ply++) {
		if (signal?.aborted) break;
		const fen = game.fenAt(ply);
		const turn = turnFromFen(fen);
		const g = Game.fromUciMoves(row.moves.slice(0, ply), row.startFen);
		const end = g.end();
		let e: PlyEval;
		if (end?.kind === 'checkmate') {
			// Matt auf dem Brett: die Seite am Zug ist matt
			e = { cp: turn === 'white' ? -10000 : 10000 };
		} else if (end) {
			e = { cp: 0 };
		} else {
			// zwei Varianten: die zweite zeigt, ob der beste Zug der einzige gute war
			const res = await engine.analyse({ fen, depth, multipv: 2, signal });
			const top = res.lines[0];
			const alt = res.lines[1];
			const score = top ? toWhite({ cp: top.cp, mate: top.mate }, turn) : { cp: 0 };
			e = { ...score, best: res.bestmove ?? undefined, pv: top?.pv.slice(0, 8) };
			if (alt) e.second = toWhite({ cp: alt.cp, mate: alt.mate }, turn);
		}
		evals[ply] = e;
		onProgress(ply + 1, total, evals);
		if (ply % 6 === 0 && row.id) {
			await db.games.update(row.id, { analysis: { evals, depth, done: false } });
		}
	}

	const done = evals.length === total;
	if (row.id) await db.games.update(row.id, { analysis: { evals, depth, done } });
	return evals;
}

/** Bewertet jeden Zug anhand der Stellungsbewertungen */
export function reviewMoves(row: GameRow, evals: PlyEval[]): MoveReview[] {
	const game = Game.fromUciMoves(row.moves, row.startFen);
	const out: MoveReview[] = [];
	const standard = row.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
	let inBook = standard;
	for (let i = 0; i < game.moves.length; i++) {
		const before = evals[i];
		const after = evals[i + 1];
		if (!before || !after) break;
		const fen = game.fenAt(i);
		const mover = turnFromFen(fen);
		const uci = game.moves[i].uci;
		const { judgement, loss } = judge(before, after, mover, uci);
		// Buchzug: liegt auf einer bekannten Eröffnungsvariante (solange die Partie im Buch ist)
		inBook = inBook && i < 30 && isBookLine(game.moves.slice(0, i + 1).map((m) => m.uci));
		const explanation = explain(fen, uci, before, after, judgement);
		out.push({
			ply: i + 1,
			mover,
			judgement,
			kind: moveKind({
				judgement,
				loss,
				played: uci,
				before,
				after,
				mover,
				fenBefore: fen,
				book: inBook,
				explanation
			}),
			loss,
			explanation
		});
	}
	return out;
}

/**
 * Macht aus eigenen Fehlern und Patzern Übungs-Puzzles (sofort fällig).
 * Gibt die Anzahl neu angelegter Puzzles zurück.
 */
export async function createMistakePuzzles(row: GameRow, evals: PlyEval[]): Promise<number> {
	if (!row.id) return 0;
	const game = Game.fromUciMoves(row.moves, row.startFen);
	const reviews = reviewMoves(row, evals);
	let created = 0;
	for (const r of reviews) {
		if (r.mover !== row.myColor) continue;
		if (r.judgement !== 'blunder' && r.judgement !== 'mistake') continue;
		const before = evals[r.ply - 1];
		if (!before?.best) continue;
		const id = `${row.source}-${row.id}-${r.ply}`;
		if (await db.mistakes.get(id)) continue;
		const fen = game.fenAt(r.ply - 1);
		const puzzle: Puzzle = {
			id,
			fen,
			moves: ['', before.best, ...(before.pv?.slice(1, 3) ?? [])],
			rating: 0,
			themes: [],
			source: 'mistake',
			note: t('puzzles.mistakeNote', {
				what: r.explanation?.title ?? t('judgement.mistake'),
				opp: row.opponent
			})
		};
		// Nur der erste Lösungszug ist sicher; Folgezüge nur bei Matt/klaren Varianten behalten
		if (!(before.mate !== undefined)) puzzle.moves = ['', before.best];
		await db.mistakes.put({
			id,
			gameId: row.id,
			fen,
			solution: before.best,
			played: game.moves[r.ply - 1].uci,
			ply: r.ply,
			date: Date.now(),
			label: r.explanation?.title ?? t('judgement.mistake')
		});
		const card = createEmptyCard(new Date());
		await db.reviewCards.put({
			id: `mistake:${id}`,
			kind: 'mistake',
			card,
			due: Date.now(),
			data: puzzle
		});
		created++;
	}
	return created;
}
