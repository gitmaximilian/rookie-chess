/**
 * Brett-Scan („das Brett sehen“): die Denkroutine Schachs – Schlagzüge – Angriffe (CCA:
 * checks, captures, attacks) als Übung. Vor jedem Zug soll man in Sekunden sehen, welche forcierenden
 * Züge es gibt – für sich und für den Gegner – und welche Figuren ungeschützt sind.
 *
 * Beleglage: Die Routine ist Trainer-Erfahrung (Heisman u. a.), keine Studie. Ihr Zweck ergibt sich aber
 * direkt aus den Lichess-Daten: Unter 1000 ist über die Hälfte der Patzer ein Figuren- oder Mattverlust in
 * ≤ 2 Zügen – genau das, was ein CCA-Scan findet. Geübt wird als Abruf (selbst finden, dann Auflösung).
 *
 * Alle Antworten folgen aus den Regeln (chessops) – keine Engine nötig, beliebig viele echte Stellungen.
 */
import { attacks } from 'chessops/attacks';
import { makeSquare, parseSquare } from 'chessops/util';
import type { Role } from 'chessops/types';
import { positionFromFen } from '#lib/chess/game.js';
import { VALUE } from '#lib/chess/notation.js';

export type ScanMode = 'checks' | 'captures' | 'hanging' | 'opponent';

export const SCAN_MODES: ScanMode[] = ['hanging', 'checks', 'captures', 'opponent'];

/** Züge als „von-nach“ (Umwandlungen zählen einmal) */
function movesOf(
	fen: string,
	keep: (pos: ReturnType<typeof positionFromFen>, from: number, to: number) => boolean
) {
	const pos = positionFromFen(fen);
	const out = new Set<string>();
	for (const [from, dests] of pos.allDests())
		for (const to of dests) if (keep(pos, from, to)) out.add(makeSquare(from) + makeSquare(to));
	return [...out].sort();
}

/** alle Züge der Seite am Zug, die Schach geben */
export function checksOf(fen: string): string[] {
	return movesOf(fen, (pos, from, to) => {
		const p = pos.clone();
		const piece = p.board.get(from);
		const promo = piece?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0);
		p.play({ from, to, ...(promo ? { promotion: 'queen' as Role } : {}) });
		return p.isCheck();
	});
}

/** alle Schlagzüge der Seite am Zug (auch en passant) */
export function capturesOf(fen: string): string[] {
	return movesOf(fen, (pos, from, to) => {
		if (pos.board.get(to)) return true;
		const piece = pos.board.get(from);
		return piece?.role === 'pawn' && (from & 7) !== (to & 7);
	});
}

/**
 * Hängende Figuren beider Seiten (ohne Bauern und Könige): angegriffen und entweder ungedeckt oder von
 * einer billigeren Figur angegriffen – wie die Warnung des Coachs (lib/coach/coach.ts `threats`).
 */
export function hangingOf(fen: string): string[] {
	const pos = positionFromFen(fen);
	const occ = pos.board.occupied;
	const out: string[] = [];
	for (const sq of occ) {
		const piece = pos.board.get(sq)!;
		if (piece.role === 'king' || piece.role === 'pawn') continue;
		const them = piece.color === 'white' ? 'black' : 'white';
		let cheapest = Infinity;
		for (const from of pos.board[them]) {
			const p = pos.board.get(from)!;
			if (attacks(p, from, occ).has(sq)) cheapest = Math.min(cheapest, VALUE[p.role] || 100);
		}
		if (cheapest === Infinity) continue;
		let defended = false;
		for (const from of pos.board[piece.color]) {
			if (from === sq) continue;
			const p = pos.board.get(from)!;
			if (attacks(p, from, occ).has(sq)) {
				defended = true;
				break;
			}
		}
		if (!defended || cheapest < VALUE[piece.role]) out.push(makeSquare(sq));
	}
	return out.sort();
}

/**
 * Stellung aus Sicht des Gegners (er wäre am Zug) – für „Was kann der Gegner?“.
 * null, wenn das nicht geht (z. B. weil der Gegner dann schon im Schach stünde – wir stünden am Zug).
 */
export function flipped(fen: string): string | null {
	const parts = fen.split(' ');
	parts[1] = parts[1] === 'w' ? 'b' : 'w';
	parts[3] = '-';
	const f = parts.join(' ');
	try {
		const pos = positionFromFen(f);
		// die Seite, die jetzt nicht zieht, darf nicht im Schach stehen
		const me = pos.turn === 'white' ? 'black' : 'white';
		const king = pos.board.kingOf(me);
		if (king === undefined) return null;
		for (const from of pos.board[pos.turn]) {
			const p = pos.board.get(from)!;
			if (attacks(p, from, pos.board.occupied).has(king)) return null;
		}
		return f;
	} catch {
		return null;
	}
}

/** Die gesuchten Antworten für eine Stellung und einen Modus */
export function targetsOf(fen: string, mode: ScanMode): string[] | null {
	switch (mode) {
		case 'checks':
			return checksOf(fen);
		case 'captures':
			return capturesOf(fen);
		case 'hanging':
			return hangingOf(fen);
		case 'opponent': {
			const f = flipped(fen);
			if (!f) return null;
			return [...new Set([...checksOf(f), ...capturesOf(f)])].sort();
		}
	}
}

/** taugt die Stellung für den Modus? (nicht leer, aber auch nicht zu viele zum Suchen) */
export function suitable(targets: string[] | null, mode: ScanMode): boolean {
	if (!targets) return false;
	const max = mode === 'hanging' ? 4 : 7;
	return targets.length >= 1 && targets.length <= max;
}

export interface ScanScore {
	found: string[];
	missed: string[];
	/** falsch angegebene Züge/Felder */
	wrong: number;
	/** 0..1: gefundene Anteil, je Fehlgriff ein Abzug von ¼ Treffer */
	score: number;
}

export function scoreScan(targets: string[], found: string[], wrong: number): ScanScore {
	const ok = found.filter((x) => targets.includes(x));
	const score = targets.length
		? Math.max(0, (ok.length - wrong * 0.25) / targets.length)
		: wrong
			? 0
			: 1;
	return {
		found: ok,
		missed: targets.filter((x) => !ok.includes(x)),
		wrong,
		score: Math.round(score * 100) / 100
	};
}

/** Feld gültig? (für Tipp-Eingaben) */
export const isSquare = (s: string) => parseSquare(s) !== undefined;
