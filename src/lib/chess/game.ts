import { Chess } from 'chessops/chess';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci, makeUci, makeSquare, parseSquare } from 'chessops/util';
import { chessgroundDests } from 'chessops/compat';
import {
	parsePgn,
	startingPosition,
	makePgn,
	defaultGame,
	ChildNode,
	type PgnNodeData
} from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import type { Color, Role, NormalMove, Outcome } from 'chessops/types';

export type Key = ReturnType<typeof makeSquare>;

export interface PlayedMove {
	uci: string;
	san: string;
	/** FEN nach dem Zug */
	fen: string;
	from: Key;
	to: Key;
	captured?: Role;
}

export type GameEnd =
	| { kind: 'checkmate'; winner: Color }
	| { kind: 'stalemate' }
	| { kind: 'insufficient' }
	| { kind: 'threefold' }
	| { kind: 'fifty' }
	| { kind: 'resign'; winner: Color }
	| { kind: 'timeout'; winner: Color };

export { INITIAL_FEN };

function setupFromFen(fen: string): Chess {
	return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
}

/**
 * Eine Partie als Zugfolge ab einer Startstellung.
 * Bewusst nicht reaktiv: Svelte-Komponenten lesen `version`, um neu zu rendern.
 */
export class Game {
	readonly startFen: string;
	moves: PlayedMove[] = [];
	private pos: Chess;
	private history: string[] = [];
	resigned: { winner: Color } | null = null;
	timedOut: { winner: Color } | null = null;

	constructor(startFen: string = INITIAL_FEN) {
		this.startFen = startFen;
		this.pos = setupFromFen(startFen);
		this.history = [this.repetitionKey()];
	}

	static fromUciMoves(moves: string[], startFen: string = INITIAL_FEN): Game {
		const g = new Game(startFen);
		for (const m of moves) if (!g.play(m)) throw new Error(`Illegaler Zug: ${m}`);
		return g;
	}

	static fromPgn(pgn: string): Game {
		const [parsed] = parsePgn(pgn);
		if (!parsed) throw new Error('Kein PGN gefunden');
		const start = startingPosition(parsed.headers).unwrap() as Chess;
		const g = new Game(makeFen(start.toSetup()));
		for (const node of parsed.moves.mainline()) {
			const move = parseSan(g.pos, node.san);
			if (!move) throw new Error(`Ungültiger Zug im PGN: ${node.san}`);
			g.play(makeUci(move));
		}
		return g;
	}

	get fen(): string {
		return makeFen(this.pos.toSetup());
	}

	get turn(): Color {
		return this.pos.turn;
	}

	get ply(): number {
		return this.moves.length;
	}

	get lastMove(): [Key, Key] | undefined {
		const m = this.moves.at(-1);
		return m ? [m.from, m.to] : undefined;
	}

	get isCheck(): boolean {
		return this.pos.isCheck();
	}

	/** Mögliche Züge im chessground-Format */
	dests(): Map<Key, Key[]> {
		if (this.end()) return new Map();
		return chessgroundDests(this.pos) as Map<Key, Key[]>;
	}

	legalUcis(): string[] {
		const out: string[] = [];
		for (const [from, tos] of this.dests()) {
			for (const to of tos) {
				const uci = from + to;
				if (this.isPromotion(from, to)) for (const r of ['q', 'r', 'b', 'n']) out.push(uci + r);
				else out.push(uci);
			}
		}
		return out;
	}

	/** Schlagzüge (inkl. en passant) als UCI */
	captureUcis(): Set<string> {
		const out = new Set<string>();
		for (const uci of this.legalUcis()) {
			const to = parseSquare(uci.slice(2, 4) as Key);
			const from = parseSquare(uci.slice(0, 2) as Key);
			const isEp = this.pos.epSquare === to && this.pos.board.get(from)?.role === 'pawn';
			if (this.pos.board.get(to) || isEp) out.add(uci);
		}
		return out;
	}

	/** Geschlagene Figuren je Farbe (die Figuren, die diese Farbe verloren hat) */
	capturedPieces(): { white: Role[]; black: Role[] } {
		const res: { white: Role[]; black: Role[] } = { white: [], black: [] };
		this.moves.forEach((m, i) => {
			if (!m.captured) return;
			// Zug i von Weiß, wenn Startseite Weiß und i gerade
			const moverIsWhite = (turnFromFen(this.startFen) === 'white') === (i % 2 === 0);
			(moverIsWhite ? res.black : res.white).push(m.captured);
		});
		return res;
	}

	isPromotion(from: Key, to: Key): boolean {
		const piece = this.pos.board.get(parseSquare(from));
		if (piece?.role !== 'pawn') return false;
		return to[1] === '8' || to[1] === '1';
	}

	isLegal(uci: string): boolean {
		const move = parseUci(uci);
		return !!move && this.pos.isLegal(move);
	}

	/** Spielt einen Zug (UCI). Gibt den Zug zurück oder null, wenn illegal. */
	play(uci: string): PlayedMove | null {
		const move = parseUci(uci) as NormalMove | undefined;
		if (!move || !this.pos.isLegal(move) || this.end()) return null;
		const san = makeSan(this.pos, move);
		const captured = this.pos.board.get(move.to)?.role ?? (san.includes('x') ? 'pawn' : undefined);
		this.pos.play(move);
		const played: PlayedMove = {
			uci: makeUci(move),
			san,
			fen: this.fen,
			from: makeSquare(move.from),
			to: makeSquare(move.to),
			captured
		};
		this.moves.push(played);
		this.history.push(this.repetitionKey());
		return played;
	}

	/** Nimmt `n` Halbzüge zurück */
	undo(n = 1): void {
		const keep = Math.max(0, this.moves.length - n);
		const ucis = this.moves.slice(0, keep).map((m) => m.uci);
		this.pos = setupFromFen(this.startFen);
		this.moves = [];
		this.history = [this.repetitionKey()];
		this.resigned = null;
		this.timedOut = null;
		for (const u of ucis) this.play(u);
	}

	fenAt(ply: number): string {
		return ply === 0 ? this.startFen : this.moves[ply - 1].fen;
	}

	resign(loser: Color): void {
		this.resigned = { winner: loser === 'white' ? 'black' : 'white' };
	}

	timeout(loser: Color): void {
		this.timedOut = { winner: loser === 'white' ? 'black' : 'white' };
	}

	end(): GameEnd | null {
		if (this.resigned) return { kind: 'resign', winner: this.resigned.winner };
		if (this.timedOut) return { kind: 'timeout', winner: this.timedOut.winner };
		if (this.pos.isCheckmate())
			return { kind: 'checkmate', winner: this.pos.turn === 'white' ? 'black' : 'white' };
		if (this.pos.isStalemate()) return { kind: 'stalemate' };
		if (this.pos.isInsufficientMaterial()) return { kind: 'insufficient' };
		if (this.pos.halfmoves >= 100) return { kind: 'fifty' };
		const key = this.history.at(-1);
		if (key && this.history.filter((k) => k === key).length >= 3) return { kind: 'threefold' };
		return null;
	}

	outcome(): Outcome | undefined {
		const e = this.end();
		if (!e) return undefined;
		return 'winner' in e ? { winner: e.winner } : { winner: undefined };
	}

	/** PGN mit Kopfzeilen */
	toPgn(headers: Record<string, string> = {}): string {
		const game = defaultGame<PgnNodeData>(() => new Map(Object.entries(headers)));
		if (this.startFen !== INITIAL_FEN) {
			game.headers.set('SetUp', '1');
			game.headers.set('FEN', this.startFen);
		}
		const o = this.outcome();
		game.headers.set(
			'Result',
			!o ? '*' : o.winner === 'white' ? '1-0' : o.winner === 'black' ? '0-1' : '1/2-1/2'
		);
		let node = game.moves;
		for (const m of this.moves) {
			const child = new ChildNode<PgnNodeData>({ san: m.san });
			node.children.push(child);
			node = child;
		}
		return makePgn(game);
	}

	/** Grober Materialstand (Weiß − Schwarz) in Bauerneinheiten */
	/** Figurentyp auf einem Feld (oder null) */
	pieceAt(square: string): Role | null {
		const sq = parseSquare(square);
		return sq === undefined ? null : (this.pos.board.get(sq)?.role ?? null);
	}

	materialBalance(): number {
		const v: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
		let s = 0;
		for (const [, p] of this.pos.board) s += (p.color === 'white' ? 1 : -1) * v[p.role];
		return s;
	}

	position(): Chess {
		return this.pos.clone();
	}

	private repetitionKey(): string {
		// FEN ohne Zugzähler
		return this.fen.split(' ').slice(0, 4).join(' ');
	}
}

export function turnFromFen(fen: string): Color {
	return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function sanForUci(fen: string, uci: string): string {
	const pos = setupFromFen(fen);
	const move = parseUci(uci);
	return move ? makeSan(pos, move) : uci;
}

export function positionFromFen(fen: string): Chess {
	return setupFromFen(fen);
}
