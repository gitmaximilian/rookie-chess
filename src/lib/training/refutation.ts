/**
 * Blunder-Check: Eine Widerlegung zählt auch dann, wenn sie nicht die gespeicherte ist, aber genauso viel
 * bringt (z. B. die hängende Dame mit dem Springer statt mit dem Turm schlagen). Sonst springt eine
 * richtige Antwort zurück, und es wirkt, als ließen sich die Figuren des Gegners nicht ziehen.
 */
import { Game } from '#lib/chess/game.js';
import { engine } from '#lib/engine/engine.js';
import { scoreToCp, winChance } from '#lib/engine/uci.js';

/** so viel Gewinnchance darf eine andere Widerlegung schlechter sein als die gespeicherte */
export const REFUTE_TOLERANCE = 0.1;
/** und so klar muss sie den Gegner (den Spieler mit dem Patzer) bestrafen */
export const REFUTE_MIN = 0.7;

/** Gewinnchance (0..1) der Seite, die gerade gezogen hat, nach `uci` – null bei unzulässigem Zug */
async function chanceAfter(fen: string, uci: string, signal?: AbortSignal): Promise<number | null> {
	const g = new Game(fen);
	if (!g.play(uci)) return null;
	const end = g.end();
	if (end) return end.kind === 'checkmate' ? 1 : 0.5;
	const r = await engine.analyse({ fen: g.fen, depth: 10, signal });
	const line = r.lines[0];
	if (!line) return null;
	// Bewertung aus Sicht der Seite am Zug (des Patzers) → umdrehen
	return 1 - winChance(scoreToCp(line));
}

/**
 * Ist `uci` (Zug des Gegners in `fen`, also nach dem geplanten Patzer) eine gleichwertige Widerlegung
 * zur gespeicherten `reply`? Schach-Matt zählt immer.
 */
export async function sameRefutation(
	fen: string,
	reply: string,
	uci: string,
	signal?: AbortSignal
): Promise<boolean> {
	const mine = await chanceAfter(fen, uci, signal);
	if (mine === null) return false;
	if (mine === 1) return true;
	const stored = await chanceAfter(fen, reply, signal);
	if (stored === null) return false;
	return mine >= REFUTE_MIN && mine >= stored - REFUTE_TOLERANCE;
}
