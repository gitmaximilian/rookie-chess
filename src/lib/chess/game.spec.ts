import { describe, expect, it } from 'vitest';
import { Game, INITIAL_FEN, sanForUci } from './game';

describe('Game', () => {
	it('spielt legale Züge und erzeugt SAN', () => {
		const g = new Game();
		expect(g.play('e2e4')?.san).toBe('e4');
		expect(g.play('e7e5')?.san).toBe('e5');
		expect(g.play('g1f3')?.san).toBe('Nf3');
		expect(g.turn).toBe('black');
		expect(g.lastMove).toEqual(['g1', 'f3']);
	});

	it('lehnt illegale Züge ab', () => {
		const g = new Game();
		expect(g.play('e2e5')).toBeNull();
		expect(g.ply).toBe(0);
	});

	it('erkennt Schäfermatt', () => {
		const g = Game.fromUciMoves(['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
		expect(g.end()).toEqual({ kind: 'checkmate', winner: 'white' });
		expect(g.dests().size).toBe(0);
	});

	it('nimmt Züge zurück', () => {
		const g = Game.fromUciMoves(['e2e4', 'e7e5', 'g1f3']);
		g.undo(2);
		expect(g.ply).toBe(1);
		expect(g.turn).toBe('black');
		g.undo(5);
		expect(g.fen).toBe(INITIAL_FEN);
	});

	it('erkennt Bauernumwandlung', () => {
		const g = new Game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
		expect(g.isPromotion('a7', 'a8')).toBe(true);
		expect(g.legalUcis()).toContain('a7a8q');
		expect(g.play('a7a8q')?.san).toBe('a8=Q');
	});

	it('PGN hin und zurück', () => {
		const g = Game.fromUciMoves(['e2e4', 'c7c5', 'g1f3']);
		const pgn = g.toPgn({ White: 'Ich', Black: 'Bot' });
		expect(pgn).toContain('1. e4 c5 2. Nf3');
		const back = Game.fromPgn(pgn);
		expect(back.moves.map((m) => m.uci)).toEqual(['e2e4', 'c7c5', 'g1f3']);
	});

	it('erkennt dreifache Stellungswiederholung', () => {
		const g = Game.fromUciMoves(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
		expect(g.end()?.kind).toBe('threefold');
	});

	it('Materialbilanz und SAN-Helfer', () => {
		const g = Game.fromUciMoves(['e2e4', 'd7d5', 'e4d5']);
		expect(g.materialBalance()).toBe(1);
		expect(g.moves[2].captured).toBe('pawn');
		expect(sanForUci(INITIAL_FEN, 'b1c3')).toBe('Nc3');
	});
});
