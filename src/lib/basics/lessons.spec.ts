import { describe, expect, it } from 'vitest';
import { BASICS, POSITIONAL, TACTICS, soloDests, soloFen } from './lessons';
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

	// Eine Lösung darf die gezogene Figur nicht einfach einstellen (Fund aus dem Review 14.11.2026:
	// „Dazwischenziehen“ akzeptierte ♘b1, wo der Turm den Springer schlägt)
	it('keine akzeptierte Lösung stellt die gezogene Figur ungedeckt ein', () => {
		const loose: string[] = [];
		for (const l of [...BASICS, ...TACTICS, ...POSITIONAL])
			for (const s of l.steps) {
				if (s.kind !== 'find' || !Array.isArray(s.accept)) continue;
				for (const u of s.accept) {
					const t = new Game(s.fen);
					const dest = u.slice(2, 4);
					// Schlagzüge sind Tausch, kein Einstellen
					if (t.pieceAt(dest)) continue;
					t.play(u);
					if (t.end()) continue;
					for (const c of t.legalUcis().filter((x) => x.slice(2, 4) === dest)) {
						const t2 = new Game(t.fen);
						t2.play(c);
						if (!t2.legalUcis().some((x) => x.slice(2, 4) === dest)) loose.push(`${l.id} ${u}`);
					}
				}
			}
		expect(loose).toEqual([]);
	});

	it('Taktik: jede Lektion hat ein echtes Puzzle-Thema', () => {
		for (const l of TACTICS) expect(l.theme).toBeTruthy();
	});

	it('soloFen setzt die Figur richtig', () => {
		expect(soloFen('rook', 'a1')).toBe('8/8/8/8/8/8/8/R7 w - - 0 1');
		expect(soloFen('knight', 'g1')).toBe('8/8/8/8/8/8/8/6N1 w - - 0 1');
		expect(soloDests('knight', 'b1').get('b1')!.sort()).toEqual(['a3', 'c3', 'd2']);
	});

	// Abrufübung: Lektionen mit Erklärung enden mit einer eigenen Entscheidung in einer neuen Stellung
	it('Lektionen mit Erklärung enden mit einer Aufgabe, Abrufaufgaben in neuer Stellung', () => {
		for (const l of [...BASICS, ...TACTICS, ...POSITIONAL]) {
			if (l.id === 'board') continue; // reine Einführung ins Brett
			expect(l.steps.at(-1)?.kind, l.id).not.toBe('info');
			l.steps.forEach((s, i) => {
				if (s.kind !== 'find' || !s.transfer) return;
				const seen = l.steps.slice(0, i).flatMap((x) => ('fen' in x ? [x.fen.split(' ')[0]] : []));
				expect(seen, `${l.id}: Abrufstellung kam schon vor`).not.toContain(s.fen.split(' ')[0]);
			});
		}
	});
});
