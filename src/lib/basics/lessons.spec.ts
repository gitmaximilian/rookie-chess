import { describe, expect, it } from 'vitest';
import { BASICS, TACTICS, soloDests, soloFen } from './lessons';
import { Game } from '#lib/chess/game.js';

describe('Grundlagen-Lektionen', () => {
	for (const l of [...BASICS, ...TACTICS])
		it(`${l.id}: Stellungen gültig, Aufgaben lösbar`, () => {
			for (const s of l.steps) {
				if (s.kind === 'info') {
					// reine Illustrationen (z. B. nur eine Figur) brauchen keine gültige Stellung
					const board = s.fen.split(' ')[0];
					if (board.includes('K') && board.includes('k'))
						expect(() => new Game(s.fen)).not.toThrow();
				} else if (s.kind === 'find') {
					const g = new Game(s.fen);
					const legal = g.legalUcis();
					const ok = legal.filter((u) => {
						const t = new Game(s.fen);
						t.play(u);
						if (s.accept === 'check') return t.isCheck;
						if (s.accept === 'mate') return t.end()?.kind === 'checkmate';
						return s.accept.includes(u);
					});
					expect(ok.length, `${l.id}: ${s.fen}`).toBeGreaterThan(0);
				} else {
					// Sterne: per Breitensuche alle erreichbar (Reihenfolge egal)
					const seen = new Set([s.start]);
					const queue = [s.start];
					while (queue.length) {
						const sq = queue.shift()!;
						for (const d of soloDests(s.role, sq).get(sq)!)
							if (!seen.has(d)) {
								seen.add(d);
								queue.push(d);
							}
					}
					for (const star of s.stars) expect(seen.has(star), `${l.id} ${star}`).toBe(true);
					expect(soloFen(s.role, s.start)).toMatch(/ w - - 0 1$/);
				}
			}
		});

	it('Taktik: jede Lektion hat ein echtes Puzzle-Thema', () => {
		for (const l of TACTICS) expect(l.theme).toBeTruthy();
	});

	it('soloFen setzt die Figur richtig', () => {
		expect(soloFen('rook', 'a1')).toBe('8/8/8/8/8/8/8/R7 w - - 0 1');
		expect(soloFen('knight', 'g1')).toBe('8/8/8/8/8/8/8/6N1 w - - 0 1');
		expect(soloDests('knight', 'b1').get('b1')!.sort()).toEqual(['a3', 'c3', 'd2']);
	});
});
