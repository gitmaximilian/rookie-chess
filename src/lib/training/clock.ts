/**
 * Bedenkzeit aus dem PGN (%clk-Kommentare von Lichess und Chess.com): Zeitnot, Zeitverluste und Eröffnungstempo.
 *
 * Messung (docs/research-2026-11-13.md, Nachtrag 21.11.2026; scripts/research/clock-study.mjs, Lichess-Holdout
 * Okt. 2025, je Spieler 10–30 Partien, Kreuzvalidierung leave-one-out):
 * - Zeitnot (< 10 % der Grundzeit) erklärt nur 1 % (Rapid), 5 % (Blitz) und 7 % (Bullet) aller Patzer.
 * - Das Eröffnungstempo (Anteil der Grundzeit, verbraucht bis zum eigenen 10. Zug) sagt die Wertung in Blitz
 *   (r −0,63) und Bullet (r −0,85) stark voraus, in Rapid kaum (r −0,12). Starke Spieler kennen ihre Eröffnung.
 * - Blitz: Penta + Tempo trifft die Wertung auf ±234 Elo (Penta allein ±288, Raten ±481), 58 Spieler.
 * - Bullet: Tempo allein ±267 (Penta ±449, Raten ±503), 64 Spieler – erst die Uhr macht Bullet messbar.
 * - Zeitverluste je Partie: Bullet 21–49 %, Blitz 7–15 %, Rapid 1–6 %.
 */
import { parsePgn } from 'chessops/pgn';
import type { PentaSpeed } from '#lib/import/ratings.js';

export interface ClockTrack {
	/** Grundzeit in Sekunden */
	base: number;
	/** Inkrement in Sekunden */
	inc: number;
	/** Restzeit nach jedem Halbzug (Sekunden), null wenn unbekannt */
	clocks: (number | null)[];
	/** wer auf Zeit verloren hat */
	flagged: 'white' | 'black' | null;
}

/** Zeitnot: vor dem Zug weniger als dieser Anteil der Grundzeit auf der Uhr */
export const TIME_TROUBLE = 0.1;
/** Eröffnungstempo wird nach dem eigenen 10. Zug gemessen */
export const TEMPO_MOVE = 10;
/** so viele Partien mit Uhr braucht die Karte (wie das Spielniveau) */
export const CLOCK_MIN_GAMES = 10;

const header = (pgn: string, key: string) =>
	pgn.match(new RegExp(`\\[${key}\\s+"([^"]*)"\\]`))?.[1];

export function clockTrack(pgn: string): ClockTrack | null {
	if (!pgn.includes('%clk')) return null;
	const tc = header(pgn, 'TimeControl')?.match(/^(\d+)(?:\+(\d+))?$/);
	if (!tc || Number(tc[1]) <= 0) return null;
	const [game] = parsePgn(pgn);
	if (!game) return null;
	const clocks: (number | null)[] = [];
	for (const node of game.moves.mainline()) {
		const m = (node.comments ?? []).join(' ').match(/%clk (\d+):(\d+):(\d+(?:\.\d+)?)/);
		clocks.push(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null);
	}
	if (!clocks.some((c) => c !== null)) return null;
	const result = header(pgn, 'Result');
	const onTime = /time/i.test(header(pgn, 'Termination') ?? '');
	return {
		base: Number(tc[1]),
		inc: Number(tc[2] ?? 0),
		clocks,
		flagged: onTime && result === '1-0' ? 'black' : onTime && result === '0-1' ? 'white' : null
	};
}

export interface GameClockStats {
	/** eigene Züge mit bekannter Zeit */
	moves: number;
	/** davon in Zeitnot */
	tt: number;
	/** Züge in offener Stellung (Nenner der Patzerquote) und Patzer darunter, jeweils in Zeitnot */
	ttLive: number;
	ttBlunders: number;
	/** Anteil der Grundzeit, verbraucht bis zum eigenen 10. Zug (ohne Inkrement) – null bei kürzeren Partien */
	used10: number | null;
	flagged: boolean;
}

/** Restzeit vor meinem Zug in Halbzug i (Uhr nach meinem vorigen Zug, am Anfang die Grundzeit) */
export function clockBefore(track: ClockTrack, i: number): number | null {
	return i >= 2 ? track.clocks[i - 2] : track.base;
}

export function inTimeTrouble(track: ClockTrack, i: number): boolean {
	const before = clockBefore(track, i);
	return before !== null && before < TIME_TROUBLE * track.base;
}

/** Eröffnungstempo aus der Uhr nach meinem 10. Zug; `firstPly` = Halbzug meines ersten Zugs (0 oder 1) */
export function used10(track: ClockTrack, firstPly: number): number | null {
	const c = track.clocks[firstPly + 2 * (TEMPO_MOVE - 1)];
	if (c === null || c === undefined) return null;
	return Math.max(0, Math.min(1, 1 - (c - TEMPO_MOVE * track.inc) / track.base));
}

/** Uhr einer Partie ohne Analyse (Zeitnot-Patzer fehlen dann) – Tempo und Zeitverluste brauchen keine Engine */
export function gameClockStats(g: {
	pgn: string;
	myColor: 'white' | 'black';
	startFen?: string;
}): GameClockStats | null {
	const track = clockTrack(g.pgn);
	if (!track) return null;
	const whiteFirst = (g.startFen?.split(' ')[1] ?? 'w') === 'w';
	const firstPly = whiteFirst === (g.myColor === 'white') ? 0 : 1;
	let moves = 0;
	let tt = 0;
	for (let i = firstPly; i < track.clocks.length; i += 2) {
		if (track.clocks[i] === null) continue;
		moves++;
		if (inTimeTrouble(track, i)) tt++;
	}
	return {
		moves,
		tt,
		ttLive: 0,
		ttBlunders: 0,
		used10: used10(track, firstPly),
		flagged: track.flagged === g.myColor
	};
}

export interface ClockSummary {
	games: number;
	/** davon analysiert (nur dort sind Patzer bekannt) */
	analysed: number;
	/** Anteil eigener Züge in Zeitnot */
	ttShare: number;
	/** Anteil der Partien, die auf Zeit verloren gingen */
	flagRate: number;
	/** mittleres Eröffnungstempo (0–1), null ohne Partien mit 10 Zügen */
	used10: number | null;
	blunders: number;
	ttBlunders: number;
}

export function poolClock(
	stats: { clock?: GameClockStats | null; blunders: number | null }[]
): ClockSummary | null {
	const withClock = stats.filter((s) => s.clock);
	if (withClock.length < CLOCK_MIN_GAMES) return null;
	let moves = 0;
	let tt = 0;
	let flagged = 0;
	let used = 0;
	let usedN = 0;
	let blunders = 0;
	let ttBlunders = 0;
	let analysed = 0;
	for (const s of withClock) {
		const c = s.clock!;
		moves += c.moves;
		tt += c.tt;
		if (c.flagged) flagged++;
		if (c.used10 !== null) {
			used += c.used10;
			usedN++;
		}
		if (s.blunders !== null) {
			analysed++;
			blunders += s.blunders;
			ttBlunders += c.ttBlunders;
		}
	}
	return {
		games: withClock.length,
		analysed,
		ttShare: moves ? tt / moves : 0,
		flagRate: flagged / withClock.length,
		used10: usedN >= CLOCK_MIN_GAMES ? used / usedN : null,
		blunders,
		ttBlunders
	};
}

/**
 * Typische Werte von Lichess-Spielern um 1600 (Band 1600–1999, Holdout Okt. 2025): Eröffnungstempo und
 * Zeitverluste je Partie – Vergleichsmaß der Karte, kein Sollwert.
 */
export const TYPICAL_1600: Record<PentaSpeed, { used10: number; flagRate: number }> = {
	rapid: { used10: 0.09, flagRate: 0.06 },
	classical: { used10: 0.09, flagRate: 0.06 },
	blitz: { used10: 0.1, flagRate: 0.09 },
	bullet: { used10: 0.14, flagRate: 0.26 }
};

/**
 * Elo-Entsprechung mit Uhr (lineare Modelle, kreuzvalidiert): Blitz aus Penta-Gesamtniveau und Tempo, Bullet aus
 * dem Tempo allein. Rapid/Klassisch: die Uhr verbessert nichts (±288 statt ±274) – dort null.
 */
export function clockLevel(
	speed: PentaSpeed,
	overall: number | null,
	tempo: number | null
): number | null {
	if (tempo === null) return null;
	let elo: number;
	if (speed === 'blitz') {
		if (overall === null) return null;
		elo = 1149 + 0.564 * overall - 3150 * tempo;
	} else if (speed === 'bullet') elo = 2466 - 4294 * tempo;
	else return null;
	return Math.round(Math.max(400, Math.min(2700, elo)) / 25) * 25;
}

/** Fehler der Schätzung im Holdout (mittlere Abweichung, Elo) */
export const CLOCK_LEVEL_MAE: Partial<Record<PentaSpeed, number>> = { blitz: 234, bullet: 267 };

export type ClockAdvice = 'tempo' | 'flag' | 'fine';

/** Nächster Schritt: Eröffnungstempo zuerst (stärkster Zusammenhang), dann Zeitverluste, sonst kein Engpass */
export function clockAdvice(speed: PentaSpeed, s: ClockSummary): ClockAdvice {
	const ref = TYPICAL_1600[speed];
	if (s.used10 !== null && s.used10 > ref.used10 + 0.08) return 'tempo';
	if (s.flagRate > ref.flagRate * 2 && s.flagRate >= 0.1) return 'flag';
	return 'fine';
}
