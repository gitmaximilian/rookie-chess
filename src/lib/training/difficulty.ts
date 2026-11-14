/**
 * Richtige Schwierigkeit: Übungen sollen zu etwa 80 % gelingen.
 *
 * Ein Puzzle genau auf der eigenen Wertung löst man laut Glicko-Skala nur zu 50 % – für Einsteiger zu schwer:
 * Man sieht dann meist die Lösung, statt sie selbst zu finden. Lernen ist am schnellsten bei hoher, aber
 * nicht perfekter Trefferquote (Wilson et al. 2019: ~85 % für einfache Aufgaben; Bjork: Schwierigkeit hilft
 * nur, wenn man die Aufgabe grundsätzlich lösen kann). Rookie zielt deshalb auf 80 % und regelt nach:
 * Wer gerade öfter scheitert, bekommt leichtere Aufgaben, wer fast alles löst, schwerere.
 *
 * Reine Funktionen – die Wertung selbst bleibt unverfälscht (Glicko rechnet mit der echten Puzzle-Wertung).
 */

/** Ziel-Erfolgsquote im Training */
export const TARGET_SUCCESS = 0.8;

/** Wertungsabstand, bei dem die Elo-Formel die Erfolgsquote p ergibt (0,8 → ≈ 241) */
export function offsetFor(p: number): number {
	return 400 * Math.log10(p / (1 - p));
}

/** Erwartete Lösungswahrscheinlichkeit nach Elo-Formel */
export function expectedScore(player: number, puzzle: number): number {
	return 1 / (1 + Math.pow(10, (puzzle - player) / 400));
}

/** so viele jüngste Ergebnisse fließen in die Nachregelung ein */
export const WINDOW = 20;
/** erst ab so vielen Ergebnissen wird nachgeregelt */
export const MIN_RESULTS = 8;

/**
 * Abstand zur eigenen Wertung, auf den Puzzles zielen.
 * @param recent jüngste Ergebnisse (true = gelöst), neueste zuletzt
 */
export function targetOffset(recent: boolean[]): number {
	const base = offsetFor(TARGET_SUCCESS);
	const xs = recent.slice(-WINDOW);
	if (xs.length < MIN_RESULTS) return Math.round(base);
	const rate = xs.filter(Boolean).length / xs.length;
	// je 10 Prozentpunkte unter dem Ziel 60 Punkte leichter, darüber 60 Punkte schwerer
	const adjusted = base + (TARGET_SUCCESS - rate) * 600;
	return Math.round(Math.max(100, Math.min(450, adjusted)));
}

/** Ziel-Wertung für das nächste Puzzle */
export function puzzleTarget(rating: number, recent: boolean[]): number {
	return Math.max(400, Math.round(rating - targetOffset(recent)));
}

/**
 * Ergebnis eines Puzzles für die Wertung: gelöst = 1, mit Hinweis gelöst = ½, verfehlt = 0.
 * Ein Hinweis ist Hilfe – das Puzzle zählt dann nicht als selbst gefunden.
 */
export function puzzleScore(solved: boolean, hinted: boolean): number {
	return solved ? (hinted ? 0.5 : 1) : 0;
}
