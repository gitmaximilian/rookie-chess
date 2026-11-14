import { describe, expect, it } from 'vitest';
import { PERSONAS, simulateWeek, formatWeek } from './personas';

/**
 * Prüfstand für den Tagesplan (Annahmen in personas.ts). Mit PERSONA_LOG=1 wird das Wochenprotokoll ausgegeben.
 * Die Zielwerte stammen aus dem Ziel-Wochenplan in docs/research-2026-11-13.md.
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
		expect(s.share.playing).toBeLessThanOrEqual(40);
		// Blunder-Check jeden Tag
		expect(s.blunderChecks).toBeGreaterThanOrEqual(30);
		// eigene Fehler werden geübt – höchstens ein Drittel bleibt in der ersten Woche liegen
		expect(s.ownMistakesNeverPractised).toBeLessThanOrEqual(Math.ceil(s.ownMistakesCreated / 3));
		// Taktik im Zielbereich (Simulation: grob 70–95 %)
		expect(s.puzzleSuccess).toBeGreaterThanOrEqual(65);
		// Zeitbudget eingehalten (+ 1 min Rundung je Tag)
		for (const d of w.days) expect(d.minutes).toBeLessThanOrEqual(p.minutesPerDay + 3);
	});
});
