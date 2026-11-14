/**
 * Hilfe ausschleichen (Rookie-Lernmodell, Grundsatz 5).
 *
 * Ein Coach, der jede Drohung ankündigt, nimmt dem Spieler genau den Blunder-Check ab, den er lernen soll:
 * Rückmeldung bei jedem Versuch hebt die Leistung im Training, schadet aber dem Behalten, weil man sich
 * auf die Hilfe verlässt (Guidance-Hypothese; Salmoni, Schmidt & Walter 1984; Winstein & Schmidt 1990).
 *
 * - „warn“: Der Coach warnt vor angegriffenen Figuren und Drohungen und zeigt Fehler sofort mit Pfeilen.
 * - „check“: Der Coach fragt nur („Dein Blunder-Check: Was droht?“) und zeigt die Drohung auf Wunsch.
 *   Bei einem Patzer sagt er „Halt – nicht sicher“, ohne die Lösung zu verraten; erst „Zeig warum“ erklärt.
 *
 * Automatisch: die ersten Partien mit Warnungen, danach „selbst prüfen“.
 */
export type CoachLevel = 'warn' | 'check';
export type CoachPref = 'auto' | CoachLevel;

/** so viele Partien mit Coach warnt er, bevor er nur noch fragt */
export const GUIDED_GAMES = 3;

export function coachLevel(pref: CoachPref, coachedGames: number): CoachLevel {
	if (pref !== 'auto') return pref;
	return coachedGames < GUIDED_GAMES ? 'warn' : 'check';
}
