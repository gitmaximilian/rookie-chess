import { expect, test } from 'vitest';
import { fromChessCom, toChessCom } from './platforms';

test('Chess.com liegt unter Lichess – bei Einsteigern weiter als oben', () => {
	expect(toChessCom(1000)).toBe(600);
	expect(toChessCom(1600)).toBe(1325);
	expect(1000 - toChessCom(1000)).toBeGreaterThan(1600 - toChessCom(1600));
	// Hin und zurück bleibt (bis auf Rundung) gleich
	expect(Math.abs(fromChessCom(toChessCom(1400)) - 1400)).toBeLessThan(25);
	expect(toChessCom(300)).toBe(100);
});
