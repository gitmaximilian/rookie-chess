import { parseUci, makeSquare } from 'chessops/util';
import { attacks } from 'chessops/attacks';
import { makeSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import type { NormalMove, Role } from 'chessops/types';
import { positionFromFen } from '#lib/chess/game.js';
import { figurine, rolePoss, roleAcc, VALUE } from '#lib/chess/notation.js';
import type { PlyEval, Judgement } from './classify.js';

export interface Explanation {
	/** kurzer Titel, z. B. „Figur eingestellt“ */
	title: string;
	/** ein bis zwei Sätze in einfachem Deutsch */
	text: string;
	/** Stichwort für Statistik/Training */
	motif: 'mate-missed' | 'mate-allowed' | 'hanging' | 'fork' | 'missed-win' | 'positional';
}

function san(fen: string, uci: string): string {
	const pos = positionFromFen(fen);
	const m = parseUci(uci);
	return m ? figurine(makeSan(pos, m)) : uci;
}

function sanLine(fen: string, pv: string[], n = 4): string {
	const pos = positionFromFen(fen);
	const out: string[] = [];
	for (const u of pv.slice(0, n)) {
		const m = parseUci(u);
		if (!m || !pos.isLegal(m)) break;
		out.push(figurine(makeSan(pos, m)));
		pos.play(m);
	}
	return out.join(' ');
}

/**
 * Erklärt einen ungenauen Zug.
 * @param fenBefore Stellung vor dem Zug
 * @param played gespielter Zug (UCI)
 * @param before Bewertung vor dem Zug (mit best/pv)
 * @param after Bewertung nach dem Zug (mit best = beste Antwort des Gegners)
 */
export function explain(
	fenBefore: string,
	played: string,
	before: PlyEval,
	after: PlyEval,
	judgement: Judgement
): Explanation | null {
	if (judgement === 'good' || judgement === 'best') return null;
	const pos = positionFromFen(fenBefore);
	const me = pos.turn;
	const sign = me === 'white' ? 1 : -1;
	const best = before.best;
	const bestSan = best ? san(fenBefore, best) : '';

	// 1) Matt übersehen
	if (
		before.mate !== undefined &&
		sign * before.mate > 0 &&
		!(after.mate !== undefined && sign * after.mate > 0)
	) {
		const n = Math.abs(before.mate);
		return {
			title: n === 1 ? 'Matt in 1 übersehen' : `Matt in ${n} übersehen`,
			text: `Du hattest ein erzwungenes Matt: ${sanLine(fenBefore, before.pv ?? (best ? [best] : []), n * 2 - 1)}.`,
			motif: 'mate-missed'
		};
	}

	const mv = parseUci(played) as NormalMove;
	const movedRole = pos.board.get(mv.from)?.role ?? 'pawn';
	const afterPos = pos.clone();
	afterPos.play(mv);
	const fenAfter = fenFrom(afterPos);

	// 2) Matt zugelassen
	if (after.mate !== undefined && sign * after.mate < 0) {
		const n = Math.abs(after.mate);
		const reply = after.pv?.length
			? sanLine(fenAfter, after.pv, n * 2 - 1)
			: after.best
				? san(fenAfter, after.best)
				: '';
		return {
			title: 'Matt zugelassen',
			text: `Nach diesem Zug kann dein Gegner in ${n} Zug${n === 1 ? '' : 'en'} mattsetzen${reply ? ` (${reply})` : ''}. ${bestSan ? `Besser war ${bestSan}.` : ''}`.trim(),
			motif: 'mate-allowed'
		};
	}

	const reply = after.best ? (parseUci(after.best) as NormalMove) : undefined;

	// 3) Figur hängt: beste Antwort schlägt eine eigene Figur
	if (reply) {
		const victim = afterPos.board.get(reply.to);
		if (victim && victim.color === me && victim.role !== 'pawn') {
			const replySan = san(fenAfter, after.best!);
			const sq = makeSquare(reply.to);
			const justMoved = reply.to === mv.to;
			return {
				title: justMoved ? 'Figur eingestellt' : 'Figur hängt',
				text: justMoved
					? `${cap(rolePoss(victim.role))} auf ${sq} ist ungeschützt – ${replySan} schlägt ${victim.role === 'queen' ? 'sie' : 'ihn'}. ${bestSan ? `Besser war ${bestSan}.` : ''}`.trim()
					: `Nach deinem Zug hängt ${rolePoss(victim.role)} auf ${sq}: ${replySan}. ${bestSan ? `Besser war ${bestSan}.` : ''}`.trim(),
				motif: 'hanging'
			};
		}

		// 4) Gabel zugelassen: Antwortfigur greift danach ≥2 wertvolle Figuren an
		const replyPos = afterPos.clone();
		const replyPiece = replyPos.board.get(reply.from);
		if (replyPiece && replyPos.isLegal(reply)) {
			replyPos.play(reply);
			const att = attacks(replyPiece, reply.to, replyPos.board.occupied);
			const targets: Role[] = [];
			for (const sq of att) {
				const t = replyPos.board.get(sq);
				if (
					t &&
					t.color === me &&
					(t.role === 'king' || VALUE[t.role] > VALUE[replyPiece.role] || VALUE[t.role] >= 3)
				) {
					targets.push(t.role);
				}
			}
			if (targets.length >= 2) {
				const names = targets
					.sort((a, b) => VALUE[b] - VALUE[a])
					.slice(0, 2)
					.map((r) =>
						r === 'king'
							? 'deinen König'
							: roleAcc(r).replace(/^(den|die) /, (a) => (a === 'die ' ? 'deine ' : 'deinen '))
					);
				return {
					title: 'Gabel zugelassen',
					text: `Dein Gegner hat ${san(fenAfter, after.best!)} – damit greift er ${names.join(' und ')} gleichzeitig an. ${bestSan ? `Besser war ${bestSan}.` : ''}`.trim(),
					motif: 'fork'
				};
			}
		}
	}

	// 5) Gewinn verpasst: bester Zug hätte eine Figur geschlagen
	if (best) {
		const b = parseUci(best) as NormalMove;
		const target = pos.board.get(b.to);
		if (target && target.color !== me && VALUE[target.role] >= 3) {
			return {
				title: 'Chance verpasst',
				text: `Mit ${bestSan} hättest du ${roleAcc(target.role).replace(/^den /, 'den gegnerischen ').replace(/^die /, 'die gegnerische ')} auf ${makeSquare(b.to)} gewinnen können.`,
				motif: 'missed-win'
			};
		}
	}

	// 6) Allgemein
	const movedName = movedRole === 'pawn' ? 'Bauernzug' : `${roleNameShort(movedRole)}zug`;
	return {
		title: judgement === 'inaccuracy' ? 'Nicht der beste Zug' : 'Stellung verschlechtert',
		text: `Dieser ${movedName} gibt Vorteil ab. ${bestSan ? `Stärker war ${bestSan}${before.pv && before.pv.length > 1 ? ` mit der Idee ${sanLine(fenBefore, before.pv, 3)}` : ''}.` : ''}`.trim(),
		motif: 'positional'
	};
}

function roleNameShort(r: Role): string {
	return {
		pawn: 'Bauern',
		knight: 'Springer',
		bishop: 'Läufer',
		rook: 'Turm',
		queen: 'Damen',
		king: 'Königs'
	}[r];
}

function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function fenFrom(pos: ReturnType<typeof positionFromFen>): string {
	return makeFen(pos.toSetup());
}
