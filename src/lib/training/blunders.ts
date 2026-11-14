/**
 * Eine Patzer-Zahl für die ganze App – dieselbe Definition wie die Penta-Ecke „Sicherheit“ (skills.ts)
 * und ihre Lichess-Eichung: Ein Patzer kostet mindestens 30 Prozentpunkte Gewinnchance; gezählt werden nur
 * eigene Züge in noch offenen Stellungen (vorher ≥ 20 % Gewinnchance). Wer schon verloren steht, „patzt“
 * nicht mehr im Sinne des Trainings.
 *
 * Bis v0.6 zählten Fortschrittskarte und Profil anders (alle Züge, Zugbewertung mit „entschieden“-Regel):
 * Mit denselben Partien standen 1,5 und 3,1 „Patzer je 30 Züge“ auf einer Seite (Produkt-Review 14.11.2026).
 *
 * Dazu „Verwerten“: Wie oft gewinnst du eine Partie, in der du klar auf Gewinn standst (≥ 85 %)?
 * Lichess-Spieler von 400 bis 1400 schaffen das nur in 65–70 % – fast jede dritte Gewinnstellung geht
 * verloren (docs/research-2026-11-13.md, Nachtrag 14.11.).
 */
import { Game } from '#lib/chess/game.js';
import type { GameRow } from '#lib/db/db.js';
import { whiteWin, type PlyEval } from '#lib/analysis/classify.js';

/** Verlust an Gewinnchance (0..1-Skala, doppelt wie Lichess), ab dem ein Zug ein Patzer ist */
export const BLUNDER_LOSS = 0.3;
/** offene Stellung: vorher mindestens so viel Gewinnchance */
export const LIVE_FROM = 0.2;
/** klar auf Gewinn */
export const WINNING = 0.85;
/** erst ab diesem Halbzug zählt eine Gewinnstellung (Eröffnungsfallen des Gegners nicht mitgezählt) */
export const WIN_FROM_PLY = 10;
/** Lichess 400–1400: Anteil verwerteter Gewinnstellungen (gemessen, 2 944 Spieler-Partien) */
export const CONVERT_REFERENCE = 69;

const turnOf = (fen: string): 'white' | 'black' => (fen.split(' ')[1] === 'b' ? 'black' : 'white');

export interface GameSafety {
	/** eigene Züge in offener Stellung */
	live: number;
	/** davon Patzer */
	blunders: number;
	/** erster eigener Halbzug (ab WIN_FROM_PLY) mit klarer Gewinnstellung, sonst null */
	wonAt: number | null;
}

/** Patzer in offener Stellung und erste Gewinnstellung einer analysierten Partie (null = nicht auswertbar) */
export function gameSafety(g: GameRow): GameSafety | null {
	if (!g.analysis?.done || g.analysis.evals.length < 3) return null;
	let game: Game;
	try {
		game = Game.fromUciMoves(g.moves, g.startFen);
	} catch {
		return null;
	}
	const evals = g.analysis.evals as PlyEval[];
	const first = turnOf(game.fenAt(0));
	const n = Math.min(game.moves.length, evals.length - 1);
	const out: GameSafety = { live: 0, blunders: 0, wonAt: null };
	for (let i = 0; i < n; i++) {
		const mover = i % 2 === 0 ? first : first === 'white' ? 'black' : 'white';
		if (mover !== g.myColor) continue;
		const win = (e: PlyEval) => (mover === 'white' ? whiteWin(e) : 1 - whiteWin(e));
		const before = win(evals[i]);
		const loss =
			game.moves[i].uci === evals[i].best ? 0 : Math.max(0, before - win(evals[i + 1])) * 2;
		if (before >= LIVE_FROM) {
			out.live++;
			if (loss >= BLUNDER_LOSS) out.blunders++;
		}
		if (out.wonAt === null && i >= WIN_FROM_PLY && before >= WINNING) out.wonAt = i;
	}
	return out;
}

/** Patzer je 30 Züge über mehrere Partien (null = weniger als `min` Züge in offener Stellung) */
export function blundersPer30(games: GameRow[], min = 30): number | null {
	let live = 0;
	let blunders = 0;
	for (const g of games) {
		const s = gameSafety(g);
		if (!s) continue;
		live += s.live;
		blunders += s.blunders;
	}
	return live >= min ? Math.round((blunders / live) * 300) / 10 : null;
}

/** Punkte aus Partien, in denen du klar auf Gewinn standst (Sieg 1, Remis ½) */
export function conversion(games: GameRow[]): { won: number; of: number; pct: number } | null {
	let of = 0;
	let points = 0;
	for (const g of games) {
		if (g.result === '*') continue;
		const s = gameSafety(g);
		if (!s || s.wonAt === null) continue;
		of++;
		const mine = g.myColor === 'white' ? '1-0' : '0-1';
		points += g.result === mine ? 1 : g.result === '1/2-1/2' ? 0.5 : 0;
	}
	if (of < 3) return null;
	return { won: points, of, pct: Math.round((points / of) * 100) };
}
