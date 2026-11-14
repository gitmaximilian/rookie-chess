import { parseUci, makeSquare } from 'chessops/util';
import { attacks } from 'chessops/attacks';
import { makeSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import type { NormalMove, Role } from 'chessops/types';
import { positionFromFen } from '#lib/chess/game.js';
import { figurine, VALUE } from '#lib/chess/notation.js';
import { t } from '#lib/i18n/i18n.svelte.js';
import { whiteWin, type Judgement, type PlyEval } from './classify.js';
import type { Explanation } from './explain.js';
import { formatScore, type Score } from '#lib/engine/uci.js';
import type { Component } from 'svelte';
import Star from '@lucide/svelte/icons/star';
import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
import Check from '@lucide/svelte/icons/check';
import BookOpen from '@lucide/svelte/icons/book-open';
import X from '@lucide/svelte/icons/x';

/**
 * Feinere Zugarten für die Partie-Besprechung (Anzeige am Brett, Kommentar, Zusammenfassung).
 * `Judgement` bleibt die grobe Einteilung für Statistik und Fehler-Puzzles.
 */
export type Kind =
	| 'brilliant'
	| 'great'
	| 'best'
	| 'excellent'
	| 'good'
	| 'book'
	| 'inaccuracy'
	| 'mistake'
	| 'miss'
	| 'blunder';

export const KINDS: Kind[] = [
	'brilliant',
	'great',
	'best',
	'excellent',
	'good',
	'book',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
];

/** Zeichen im Abzeichen (leer = Symbol aus KIND_ICON); Farben als CSS-Variablen (--k-<kind>) */
export const KIND_GLYPH: Record<Kind, string> = {
	brilliant: '!!',
	great: '!',
	best: '',
	excellent: '',
	good: '',
	book: '',
	inaccuracy: '?!',
	mistake: '?',
	miss: '',
	blunder: '??'
};

export const KIND_ICON: Partial<Record<Kind, Component>> = {
	best: Star,
	excellent: ThumbsUp,
	good: Check,
	book: BookOpen,
	miss: X
};

export const kindColor = (k: Kind) => `var(--k-${k})`;

export function isBad(k: Kind): boolean {
	return k === 'inaccuracy' || k === 'mistake' || k === 'miss' || k === 'blunder';
}

/** Gewinnchance (0..1) aus Sicht von `side` */
function winFor(s: Score, side: 'white' | 'black'): number {
	const w = whiteWin(s);
	return side === 'white' ? w : 1 - w;
}

/**
 * Opfer: Eine Figur (kein Bauer) zieht auf ein Feld, auf dem sie geschlagen werden kann,
 * und der Gegner gewinnt dabei Material (schwächerer Angreifer oder ungedeckt).
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
	const pos = positionFromFen(fenBefore);
	const mv = parseUci(uci) as NormalMove | undefined;
	if (!mv || !('from' in mv)) return false;
	const piece = pos.board.get(mv.from);
	if (!piece || piece.role === 'pawn' || piece.role === 'king') return false;
	const captured = pos.board.get(mv.to);
	const gain = captured ? VALUE[captured.role] : 0;
	if (VALUE[piece.role] - gain < 2) return false;
	const after = pos.clone();
	after.play(mv);
	let cheapest = Infinity;
	for (const [from, dests] of after.allDests()) {
		if (!dests.has(mv.to)) continue;
		const p = after.board.get(from);
		if (p) cheapest = Math.min(cheapest, VALUE[p.role]);
	}
	if (cheapest === Infinity) return false;
	let defended = false;
	for (const sq of after.board[piece.color]) {
		if (sq === mv.to) continue;
		const p = after.board.get(sq);
		if (p && attacks(p, sq, after.board.occupied).has(mv.to)) {
			defended = true;
			break;
		}
	}
	return !defended || cheapest < VALUE[piece.role];
}

export interface KindInput {
	judgement: Judgement;
	loss: number;
	played: string;
	before: PlyEval;
	after: PlyEval;
	mover: 'white' | 'black';
	fenBefore: string;
	book: boolean;
	explanation: Explanation | null;
}

export function moveKind(i: KindInput): Kind {
	if (i.book && !isBad(fromJudgement(i.judgement))) return 'book';
	const wBefore = winFor(i.before, i.mover);
	const wAfter = winFor(i.after, i.mover);
	if (i.judgement === 'blunder' || i.judgement === 'mistake') {
		// Chance verpasst: man stand klar besser und hat den Gewinn liegen gelassen, ohne zu verlieren
		const missed = i.explanation?.motif === 'missed-win' || i.explanation?.motif === 'mate-missed';
		if (missed && wAfter >= 0.4) return 'miss';
		return i.judgement;
	}
	if (i.judgement === 'inaccuracy') return 'inaccuracy';
	if (i.played === i.before.best) {
		// Einziger guter Zug: die zweitbeste Fortsetzung wäre deutlich schlechter
		const second = i.before.second ? winFor(i.before.second, i.mover) : null;
		const only = second !== null && wBefore - second >= 0.15 && wBefore < 0.97 && wBefore > 0.2;
		if ((only || wAfter >= 0.5) && wAfter >= 0.45 && isSacrifice(i.fenBefore, i.played))
			return 'brilliant';
		if (only) return 'great';
		return 'best';
	}
	return i.loss < 0.04 ? 'excellent' : 'good';
}

function fromJudgement(j: Judgement): Kind {
	return j === 'good' ? 'good' : j;
}

// ───────────── Kommentar ─────────────

function sanOf(fen: string, uci: string): string {
	const pos = positionFromFen(fen);
	const m = parseUci(uci);
	return m && pos.isLegal(m) ? figurine(makeSan(pos, m)) : uci;
}

function afterFen(fen: string, uci: string): string | null {
	const pos = positionFromFen(fen);
	const m = parseUci(uci);
	if (!m || !pos.isLegal(m)) return null;
	pos.play(m);
	return makeFen(pos.toSetup());
}

/** SAN-Züge einer Variante (bricht bei ungültigen Zügen ab) */
export function sanMoves(fen: string, pv: string[], n = 6): string[] {
	const pos = positionFromFen(fen);
	const out: string[] = [];
	for (const u of pv.slice(0, n)) {
		const m = parseUci(u);
		if (!m || !pos.isLegal(m)) break;
		out.push(figurine(makeSan(pos, m)));
		pos.play(m);
	}
	return out;
}

/** Was der Zug auf dem Brett tut – für gute Züge, damit jeder Zug einen echten Kommentar hat */
function whatItDoes(fenBefore: string, uci: string, ply: number): string {
	const pos = positionFromFen(fenBefore);
	const mv = parseUci(uci) as NormalMove;
	const piece = pos.board.get(mv.from);
	if (!piece) return '';
	const target = pos.board.get(mv.to);
	const san = makeSan(pos, mv);
	if (san.startsWith('O-O')) return t('review.does.castle');
	if (mv.promotion) return t('review.does.promote');
	const after = pos.clone();
	after.play(mv);
	if (san.includes('#')) return t('review.does.mate');
	const parts: string[] = [];
	if (target) parts.push(t('review.does.capture', { piece: t(`pieces.acc.${target.role}`) }));
	if (san.includes('+')) parts.push(t('review.does.check'));
	if (!parts.length) {
		// greift die gezogene Figur eine wertvollere oder ungedeckte gegnerische Figur an?
		const att = attacks(piece, mv.to, after.board.occupied);
		let best: { role: Role; sq: number } | null = null;
		for (const sq of att) {
			const p = after.board.get(sq);
			if (!p || p.color === piece.color || p.role === 'king') continue;
			if (VALUE[p.role] > VALUE[piece.role] && (!best || VALUE[p.role] > VALUE[best.role]))
				best = { role: p.role, sq };
		}
		if (best)
			parts.push(
				t('review.does.attack', {
					piece: t(`pieces.acc.${best.role}`),
					sq: makeSquare(best.sq)
				})
			);
	}
	if (!parts.length && ply <= 20) {
		const backRank = piece.color === 'white' ? mv.from < 8 : mv.from >= 56;
		if ((piece.role === 'knight' || piece.role === 'bishop') && backRank)
			return t('review.does.develop', { piece: t(`pieces.acc.${piece.role}`) });
		const to = makeSquare(mv.to);
		if (piece.role === 'pawn' && ['d4', 'e4', 'd5', 'e5', 'c4', 'c5'].includes(to))
			return t('review.does.center');
	}
	return parts.join(' ');
}

export interface Comment {
	/** z. B. „♘f3 ist der beste Zug“ */
	headline: string;
	text: string;
}

export function commentFor(a: {
	fenBefore: string;
	played: string;
	kind: Kind;
	ply: number;
	before: PlyEval;
	explanation: Explanation | null;
	opening?: string | null;
	/** Zug des Nutzers? Sonst sprechen die Erklärungen den Gegner nicht mit „dein“ an */
	mine?: boolean;
	/** Bewertung nach dem Zug (beste Antwort des anderen) */
	after?: PlyEval;
}): Comment {
	const san = sanOf(a.fenBefore, a.played);
	const headline = t(`review.head.${a.kind}`, { san });
	const bestSan = a.before.best ? sanOf(a.fenBefore, a.before.best) : '';
	const idea =
		a.before.pv && a.before.pv.length > 1
			? sanMoves(a.fenBefore, a.before.pv, 4).join(' ')
			: bestSan;
	let text: string;
	switch (a.kind) {
		case 'book':
			text = a.opening ? t('review.text.book', { name: a.opening }) : t('review.text.bookPlain');
			break;
		case 'brilliant':
			text = t('review.text.brilliant', { line: idea });
			break;
		case 'great':
			text = t('review.text.great');
			break;
		case 'best':
		case 'excellent':
		case 'good': {
			const does = whatItDoes(a.fenBefore, a.played, a.ply);
			// kein Tadel: auch der zweit- oder drittbeste Zug ist oft völlig in Ordnung
			const alt =
				a.kind !== 'best' && bestSan
					? ' ' +
						t(a.kind === 'excellent' ? 'review.text.altEqual' : 'review.text.alt', { san: bestSan })
					: '';
			text = (does || t(`review.text.${a.kind}`)) + alt;
			break;
		}
		default:
			if (a.mine === false) {
				// Fehler des Gegners: was war los, und wie nutzt man ihn aus?
				const fenAfter = afterFen(a.fenBefore, a.played);
				const reply = a.after?.best && fenAfter ? sanOf(fenAfter, a.after.best) : '';
				const parts = [a.explanation?.title ?? t(`review.kind.${a.kind}`)];
				if (reply) parts.push(t('review.text.punish', { san: reply }));
				else if (bestSan) parts.push(t('explain.better', { san: bestSan }));
				text = parts.join(' – ');
			} else
				text = a.explanation
					? a.explanation.motif === 'positional'
						? a.explanation.text
						: `${a.explanation.title}: ${a.explanation.text}`
					: bestSan
						? t('explain.better', { san: bestSan })
						: '';
	}
	return { headline, text };
}

/** Kurze Einordnung der Stellung („Weiß steht besser“) */
export function verdict(s: Score | null | undefined): string {
	if (!s) return '';
	if (s.mate !== undefined) {
		if (s.mate === 0) return t('review.verdict.mated');
		return t(s.mate > 0 ? 'review.verdict.whiteMates' : 'review.verdict.blackMates', {
			n: Math.abs(s.mate)
		});
	}
	const cp = s.cp ?? 0;
	const side = cp > 0 ? 'white' : 'black';
	const a = Math.abs(cp);
	if (a < 40) return t('review.verdict.equal');
	const level = a < 120 ? 'slightly' : a < 300 ? 'better' : 'winning';
	return t(`review.verdict.${level}`, { side: t(`common.${side}`) });
}

export { formatScore };
