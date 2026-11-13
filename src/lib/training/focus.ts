/**
 * Der eine Schwerpunkt: Woran Rookie dich gerade arbeiten lässt.
 * Start (Tagesplan) und Coach nutzen dieselbe Quelle, damit sie nie Verschiedenes empfehlen.
 *
 * Vorrang hat, was in deinen eigenen Partien wirklich passiert (z. B. hängende Figuren);
 * erst ohne solche Daten zählt das schwächste Puzzle-Thema.
 */
import type { Motif } from './gamestats.js';

/** Puzzle-Thema, mit dem man eine typische Fehlerart trainiert */
export const MOTIF_THEME: Partial<Record<Motif, string>> = {
	hanging: 'hangingPiece',
	fork: 'fork',
	'mate-missed': 'mateIn2',
	'mate-allowed': 'mateIn2',
	'missed-win': 'hangingPiece'
};

export interface Focus {
	/** Puzzle-Thema zum Üben */
	theme: string;
	/** woher der Schwerpunkt kommt */
	source: 'games' | 'puzzles';
	/** bei `games`: die Fehlerart und wie oft sie vorkam */
	motif?: Motif;
	n?: number;
}

/** ab so vielen gleichen Fehlern in eigenen Partien gilt es als Muster */
export const MIN_MOTIF = 2;

export function pickFocus(input: {
	motifs: { motif: Motif; n: number }[];
	weakTheme: string | null;
}): Focus | null {
	const top = input.motifs.find((m) => m.motif !== 'positional' && MOTIF_THEME[m.motif]);
	if (top && top.n >= MIN_MOTIF)
		return { theme: MOTIF_THEME[top.motif]!, source: 'games', motif: top.motif, n: top.n };
	if (input.weakTheme) return { theme: input.weakTheme, source: 'puzzles' };
	return null;
}
