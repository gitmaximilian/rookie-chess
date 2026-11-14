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
	// zwei Linien: so erkennt die Bewertung, wenn es mehrere gleich gute Züge gibt (classify.ts)
	const res = await engine.analyse({ fen, depth: 11, multipv: 2, signal });
	const top = res.lines[0];
	const alt = res.lines[1];
	const score = top ? toWhite({ cp: top.cp, mate: top.mate }, turnFromFen(fen)) : { cp: 0 };
	const e: PlyEval = { ...score, best: res.bestmove ?? undefined, pv: top?.pv.slice(0, 8) };
	if (alt) e.second = toWhite({ cp: alt.cp, mate: alt.mate }, turnFromFen(fen));
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

// ───────────────────────── Drohungen erkennen ─────────────────────────

export interface Threat {
	kind: 'mate' | 'material';
	/** Zug, den der Gegner androht (UCI) */
	uci: string;
	san: string;
	/** bedrohte Figur bei Materialdrohung */
	role?: Role;
	mateIn?: number;
}

/**
 * „Was würde der Gegner tun, wenn ich jetzt passe?“ – klassische Trainerfrage.
 * Nullzug: gleiche Stellung, aber der Gegner ist am Zug. Nicht bei Schach.
 */
export async function findThreat(fen: string, signal?: AbortSignal): Promise<Threat | null> {
	const g = new Game(fen);
	if (g.isCheck || g.end()) return null;
	const parts = fen.split(' ');
	parts[1] = parts[1] === 'w' ? 'b' : 'w';
	parts[3] = '-';
	const nullFen = parts.join(' ');
	let ng: Game;
	try {
		ng = new Game(nullFen);
	} catch {
		return null;
	}
	// eigener König stünde im Schach → ungültige Nullzug-Stellung
	if (ng.legalUcis().length === 0) return null;
	const res = await engine.analyse({ fen: nullFen, depth: 10, multipv: 1, signal });
	if (signal?.aborted) return null;
	const top = res.lines[0];
	const uci = res.bestmove;
	if (!top || !uci) return null;
	const san = figurine(sanForUci(nullFen, uci));
	if (top.mate !== undefined && top.mate > 0 && top.mate <= 3)
		return { kind: 'mate', uci, san, mateIn: top.mate };
	// Materialdrohung: der Zug schlägt etwas und die Bewertung kippt deutlich
	const target = ng.pieceAt(uci.slice(2, 4));
	if (!target || VALUE[target] < 3) return null;
	const now = await evalFen(fen, signal);
	if (signal?.aborted) return null;
	const me = g.turn;
	const nowCp = (me === 'white' ? 1 : -1) * scoreCp(now);
	const threatCp = -(top.mate !== undefined ? (top.mate > 0 ? 10000 : -10000) : (top.cp ?? 0));
	if (nowCp - threatCp < 150) return null;
	return { kind: 'material', uci, san, role: target };
}

function scoreCp(e: PlyEval): number {
	if (e.mate !== undefined) return e.mate > 0 ? 10000 : -10000;
	return e.cp ?? 0;
}

// ───────────────────────── Eröffnungsprinzipien ─────────────────────────

/**
 * Freundlicher Hinweis auf Eröffnungsgrundsätze – auch wenn der Zug nach Engine „okay“ ist.
 * `history` = alle bisherigen Züge (UCI) ab Grundstellung, ohne den aktuellen.
 */
export function principleTip(fenBefore: string, uci: string, history: string[]): string {
	const pos = positionFromFen(fenBefore);
	const mover = pos.turn;
	const moveNo = Math.floor(history.length / 2) + 1;
	if (moveNo > 10) return '';
	const mv = parseUci(uci) as NormalMove;
	const piece = pos.board.get(mv.from);
	if (!piece) return '';
	const captures = pos.board.get(mv.to) !== undefined;
	const fromSq = makeSquare(mv.from);
	const toSq = makeSquare(mv.to);
	const myMoves = history.filter((_, i) => (i % 2 === 0) === (mover === 'white'));

	if (piece.role === 'queen' && moveNo <= 5 && !captures) return t('coach.tip.queenEarly');
	if (piece.role === 'king' && Math.abs(mv.to - mv.from) !== 2 && !captures)
		return t('coach.tip.kingWalk');
	if (piece.role === 'knight' && /^[ah]/.test(toSq) && moveNo <= 8) return t('coach.tip.rimKnight');
	if (piece.role === 'pawn' && fromSq[0] === 'f' && moveNo <= 6 && !captures)
		return t('coach.tip.fPawn');
	// gleiche Figur zweimal, obwohl noch Leichtfiguren auf der Grundreihe stehen
	const back = mover === 'white' ? '1' : '8';
	const undeveloped = ['b', 'c', 'f', 'g'].filter((f) => {
		const p = pos.board.get(squareIndex(`${f}${back}`));
		return p && p.color === mover && (p.role === 'knight' || p.role === 'bishop');
	}).length;
	if (
		!captures &&
		moveNo <= 8 &&
		undeveloped >= 2 &&
		piece.role !== 'pawn' &&
		myMoves.some((m) => m.slice(2, 4) === fromSq)
	)
		return t('coach.tip.samePiece');
	if (moveNo >= 9 && piece.role !== 'king') {
		const castled = myMoves.some(
			(m) => /^e1(g1|c1|h1|a1)$|^e8(g8|c8|h8|a8)$/.test(m) && m[1] === back
		);
		const kingHome = pos.board.get(squareIndex(`e${back}`))?.role === 'king';
		if (!castled && kingHome && moveNo === 9) return t('coach.tip.castle');
	}
	return '';
}

function squareIndex(sq: string): number {
	return sq.charCodeAt(0) - 97 + (Number(sq[1]) - 1) * 8;
}

// ───────────────────────── Hinweis in Stufen ─────────────────────────

/** Stufe 1: Idee ohne Zug · Stufe 2: welche Figur · Stufe 3: Zug als Pfeil */
export async function coachHint(
	fen: string,
	signal?: AbortSignal
): Promise<{ idea: string; piece: string; uci: string } | null> {
	const e = await evalFen(fen, signal);
	if (signal?.aborted || !e.best) return null;
	const uci = e.best;
	const g = new Game(fen);
	const role = g.pieceAt(uci.slice(0, 2));
	const captured = g.pieceAt(uci.slice(2, 4));
	const after = new Game(fen);
	after.play(uci);
	let idea: string;
	if (after.end()?.kind === 'checkmate') idea = t('coach.hint.mate');
	else if (e.mate !== undefined && Math.abs(e.mate) <= 4 && e.mate > 0 === (g.turn === 'white'))
		idea = t('coach.hint.mateSoon');
	else if (captured) idea = t('coach.hint.capture');
	else if (after.isCheck) idea = t('coach.hint.check');
	else if (role === 'king' && Math.abs(uci.charCodeAt(0) - uci.charCodeAt(2)) >= 2)
		idea = t('coach.hint.castle');
	else if (threats(fen).length) idea = t('coach.hint.defend');
	else if ((role === 'knight' || role === 'bishop') && /[18]$/.test(uci.slice(0, 2)))
		idea = t('coach.hint.develop');
	else if (role === 'pawn' && /^[de]/.test(uci) && Number(fen.split(' ')[5] ?? 1) <= 10)
		idea = t('coach.hint.centre');
	else idea = t('coach.hint.improve');
	return {
		idea,
		piece: role
			? t('coach.hint.piece', { piece: t(`pieces.Poss.${role}`), sq: uci.slice(0, 2) })
			: '',
		uci
	};
}

/** Antwort des Gegners auf einen Fehler (erster Zug der besten Variante) */
export async function punishment(fenAfter: string, signal?: AbortSignal): Promise<string | null> {
	const e = await evalFen(fenAfter, signal);
	return e.best ?? null;
}
