/** Seiten melden Fortschritt (Sieg, Lektion, Puzzle …) – die Erfolgs-Meldung prüft dann sofort. */
export function notifyProgress(): void {
	if (typeof window !== 'undefined') window.dispatchEvent(new Event('rookie:progress'));
}
