import { parseUci, makeSquare } from 'chessops/util';
import { attacks } from 'chessops/attacks';
import { makeSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import type { NormalMove, Role } from 'chessops/types';
import { positionFromFen } from '#lib/chess/game.js';
import { figurine, VALUE } from '#lib/chess/notation.js';
import { t } from '#lib/i18n/i18n.svelte.js';
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

	const better = bestSan ? ' ' + t('explain.better', { san: bestSan }) : '';

	// 1) Matt übersehen
	if (
		before.mate !== undefined &&
		sign * before.mate > 0 &&
		!(after.mate !== undefined && sign * after.mate > 0)
	) {
		const n = Math.abs(before.mate);
		return {
			title: t('explain.mateMissedTitle', { n }),
			text: t('explain.mateMissedText', {
				line: sanLine(fenBefore, before.pv ?? (best ? [best] : []), n * 2 - 1)
			}),
			motif: 'mate-missed'
		};
	}

	const mv = parseUci(played) as NormalMove;
	const afterPos = pos.clone();
	afterPos.play(mv);
	const fenAfter = fenFrom(afterPos);

	// 2) Matt zugelassen
	if (after.mate !== undefined && sign * after.mate < 0) {
		const n = Math.abs(after.mate);
		const line = after.pv?.length
			? sanLine(fenAfter, after.pv, n * 2 - 1)
			: after.best
				? san(fenAfter, after.best)
				: '';
		return {
			title: t('explain.mateAllowedTitle'),
			text: t('explain.mateAllowedText', { n, line }) + better,
			motif: 'mate-allowed'
		};
	}

	const reply = after.best ? (parseUci(after.best) as NormalMove) : undefined;

	// 3) Figur hängt: beste Antwort schlägt eine eigene Figur
	if (reply) {
		const victim = afterPos.board.get(reply.to);
		if (victim && victim.color === me && victim.role !== 'pawn') {
			const params = {
				piece: t(`pieces.poss.${victim.role}`),
				Piece: t(`pieces.Poss.${victim.role}`),
				pron: t(`pieces.pron.${victim.role}`),
				name: t(`pieces.name.${victim.role}`),
				sq: makeSquare(reply.to),
				reply: san(fenAfter, after.best!)
			};
			const justMoved = reply.to === mv.to;
			// fachlich genau: „ungeschützt“ nur, wenn die Figur wirklich ungedeckt ist – sonst wird sie
			// von einer billigeren Figur geschlagen, und Zurückschlagen gleicht den Verlust nicht aus
			const defended = isDefended(afterPos, reply.to, me);
			const attacker = afterPos.board.get(reply.from);
			const cheaper = !!attacker && defended && VALUE[attacker.role] < VALUE[victim.role];
			const textKey = cheaper
				? 'explain.cheaperText'
				: justMoved
					? 'explain.blunderedText'
					: 'explain.hangingText';
			return {
				title: t(justMoved ? 'explain.blunderedTitle' : 'explain.hangingTitle', params),
				text:
					t(textKey, {
						...params,
						attacker: attacker ? t(`pieces.name.${attacker.role}`) : ''
					}) + better,
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
				const p = replyPos.board.get(sq);
				if (
					p &&
					p.color === me &&
					(p.role === 'king' || VALUE[p.role] > VALUE[replyPiece.role] || VALUE[p.role] >= 3)
				) {
					targets.push(p.role);
				}
			}
			if (targets.length >= 2) {
				const [a, b] = targets
					.sort((x, y) => VALUE[y] - VALUE[x])
					.slice(0, 2)
					.map((r) => acc(r));
				return {
					title: t('explain.forkTitle'),
					text: t('explain.forkText', { reply: san(fenAfter, after.best!), a, b }) + better,
					motif: 'fork'
				};
			}
		}
	}

	// 5) Gewinn verpasst: bester Zug hätte eine Figur geschlagen
	if (best) {
		const b = parseUci(best) as NormalMove;
		const target = pos.board.get(b.to);
		if (target && target.color !== me && VALUE[target.role] >= 3 && winsMaterial(pos, b)) {
			return {
				title: t('explain.missedTitle'),
				text: t('explain.missedText', {
					best: bestSan,
					piece: t(`pieces.enemy.${target.role}`),
					sq: makeSquare(b.to)
				}),
				motif: 'missed-win'
			};
		}
	}

	// 6) Allgemein
	return {
		title: t(judgement === 'inaccuracy' ? 'explain.inaccuracyTitle' : 'explain.worseTitle'),
		text: t('explain.positionalText', {
			best: bestSan,
			// Fortsetzung nach dem besseren Zug (ohne ihn zu wiederholen)
			idea:
				before.pv && before.pv.length > 1
					? sanLine(fenBefore, before.pv, 3).split(' ').slice(1).join(' ')
					: ''
		}),
		motif: 'positional'
	};
}

/**
 * Gewinnt das Schlagen wirklich Material? Nein, wenn der Gegner gleich- oder höherwertig
 * zurückschlagen kann (das wäre nur ein Abtausch).
 */
function winsMaterial(pos: ReturnType<typeof positionFromFen>, mv: NormalMove): boolean {
	const capturer = pos.board.get(mv.from);
	const target = pos.board.get(mv.to);
	if (!capturer || !target) return false;
	const after = pos.clone();
	after.play(mv);
	for (const [from, dests] of after.allDests()) {
		if (dests.has(mv.to) && after.board.get(from)) {
			return VALUE[target.role] > VALUE[capturer.role];
		}
	}
	return true;
}

/** Ist das Feld von einer eigenen Figur gedeckt (ohne die Figur darauf selbst)? */
function isDefended(pos: ReturnType<typeof positionFromFen>, sq: number, color: 'white' | 'black') {
	for (const from of pos.board[color]) {
		if (from === sq) continue;
		const p = pos.board.get(from);
		if (p && attacks(p, from, pos.board.occupied).has(sq)) return true;
	}
	return false;
}

/** Akkusativ mit Possessiv: „deinen Springer“ / „your knight“ */
function acc(r: Role): string {
	const poss = t(`pieces.poss.${r}`);
	// Deutsch: „dein Springer“ → „deinen Springer“ (Dame bleibt „deine Dame“)
	return poss.replace(/^dein /, 'deinen ');
}

function fenFrom(pos: ReturnType<typeof positionFromFen>): string {
	return makeFen(pos.toSetup());
}
