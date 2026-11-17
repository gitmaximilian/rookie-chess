import { describe, expect, it } from 'vitest';
import { PERSONAS, simulateWeek, formatWeek } from './personas';

/**
 * Prüfstand für den Tagesplan (Annahmen in personas.ts). Mit PERSONA_LOG=1 wird das Wochenprotokoll ausgegeben.
 * Prüft die Budget- und Abwechslungsregeln unter festen Simulationsannahmen.
 */
describe('Persona-Woche', () => {
	it.each(PERSONAS)('$name', (p) => {
		const w = simulateWeek(p);
		if (process.env.PERSONA_LOG) console.log(formatWeek(w));
		const s = w.summary;
		expect(w.days).toHaveLength(7);
		// Abrufen überwiegt, Lesen ist Nebensache, Spielen höchstens ~40 %
		expect(s.share.retrieval).toBeGreaterThanOrEqual(55);
		expect(s.share.reading).toBeLessThanOrEqual(15);
		expect(s.share.playing).toBeLessThanOrEqual(45);
		// Sicherheit jeden Tag: Blunder-Check, unter 1200 dazu Brett-Scan
		expect(s.blunderChecks).toBeGreaterThanOrEqual(25);
		if (p.strength < 1200) expect(s.scans).toBeGreaterThanOrEqual(9);
		// Eigene Fehler kommen tatsächlich zur Übung, auch wenn schneller neue Karten entstehen.
		expect(s.ownMistakesPractised).toBeGreaterThanOrEqual(Math.floor(s.ownMistakesCreated / 2));
		// Die kleinen simulierten Aufgabensätze bleiben lösbar.
		expect(s.puzzleSuccess).toBeGreaterThanOrEqual(60);
		// Zeitbudget eingehalten (+ 1 min Rundung je Tag)
		for (const d of w.days) expect(d.minutes).toBeLessThanOrEqual(p.minutesPerDay + 3);
	});
});
