import { attacks } from 'chessops/attacks';
import { parseSquare, makeSquare } from 'chessops/util';
import { SquareSet } from 'chessops/squareSet';
import type { Role } from 'chessops/types';
import type { L } from '#lib/openings/courses.js';

const N = (en: string, de: string): L => ({ en, de });
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Erklärung mit Brett */
export interface InfoStep {
	kind: 'info';
	text: L;
	fen: string;
	shapes?: { orig: string; dest?: string; brush: 'good' | 'bad' | 'info' }[];
}

/** Eine Figur allein auf dem Brett sammelt alle Sterne ein */
export interface StarsStep {
	kind: 'stars';
	text: L;
	role: Exclude<Role, 'pawn'>;
	start: string;
	stars: string[];
}

/** Echte Stellung: finde einen Zug, der die Aufgabe erfüllt */
export interface FindStep {
	kind: 'find';
	text: L;
	fen: string;
	/** erlaubte Züge (UCI) – oder eine Regel */
	accept: string[] | 'check' | 'mate';
	/** Erklärung nach dem richtigen Zug */
	done: L;
}

export type BasicStep = InfoStep | StarsStep | FindStep;

export interface BasicLesson {
	id: string;
	icon: 'board' | Role | 'capture' | 'check' | 'mate' | 'castle' | 'promote' | 'draw' | 'rules';
	title: L;
	steps: BasicStep[];
}

export const BASICS: BasicLesson[] = [
	{
		id: 'board',
		icon: 'board',
		title: N('The board', 'Das Brett'),
		steps: [
			{
				kind: 'info',
				text: N(
					'The board has 64 squares. Columns are called files (a–h), rows are ranks (1–8). Every square has a name, like e4.',
					'Das Brett hat 64 Felder. Die Spalten heißen Linien (a–h), die Reihen heißen Reihen (1–8). Jedes Feld hat einen Namen, zum Beispiel e4.'
				),
				fen: '8/8/8/8/8/8/8/8 w - - 0 1',
				shapes: [{ orig: 'e4', brush: 'good' }]
			},
			{
				kind: 'info',
				text: N(
					'At the start each side has 16 pieces. White always moves first. Tip: the bottom-right square is always a light one.',
					'Zu Beginn hat jede Seite 16 Figuren. Weiß zieht immer zuerst. Merkhilfe: Das Feld unten rechts ist immer hell.'
				),
				fen: START,
				shapes: [{ orig: 'h1', brush: 'info' }]
			}
		]
	},
	{
		id: 'rook',
		icon: 'rook',
		title: N('The rook', 'Der Turm'),
		steps: [
			{
				kind: 'info',
				text: N(
					'The rook moves in straight lines – up, down, left and right – as far as it likes.',
					'Der Turm zieht gerade – nach oben, unten, links und rechts – so weit er will.'
				),
				fen: '8/8/8/8/3R4/8/8/8 w - - 0 1',
				shapes: [
					{ orig: 'd4', dest: 'd8', brush: 'good' },
					{ orig: 'd4', dest: 'h4', brush: 'good' },
					{ orig: 'd4', dest: 'd1', brush: 'good' },
					{ orig: 'd4', dest: 'a4', brush: 'good' }
				]
			},
			{
				kind: 'stars',
				text: N('Collect all the stars with the rook.', 'Sammle mit dem Turm alle Sterne ein.'),
				role: 'rook',
				start: 'a1',
				stars: ['a5', 'e5', 'e8']
			},
			{
				kind: 'stars',
				text: N('One more – find the shortest way.', 'Noch einmal – finde den kürzesten Weg.'),
				role: 'rook',
				start: 'h1',
				stars: ['h6', 'c6', 'c2', 'f2']
			}
		]
	},
	{
		id: 'bishop',
		icon: 'bishop',
		title: N('The bishop', 'Der Läufer'),
		steps: [
			{
				kind: 'info',
				text: N(
					'The bishop moves diagonally, as far as it likes. It always stays on squares of one colour.',
					'Der Läufer zieht diagonal, so weit er will. Er bleibt immer auf Feldern einer Farbe.'
				),
				fen: '8/8/8/8/3B4/8/8/8 w - - 0 1',
				shapes: [
					{ orig: 'd4', dest: 'h8', brush: 'good' },
					{ orig: 'd4', dest: 'a7', brush: 'good' },
					{ orig: 'd4', dest: 'a1', brush: 'good' },
					{ orig: 'd4', dest: 'g1', brush: 'good' }
				]
			},
			{
				kind: 'stars',
				text: N('Collect the stars with the bishop.', 'Sammle die Sterne mit dem Läufer.'),
				role: 'bishop',
				start: 'c1',
				stars: ['f4', 'h6', 'f8', 'b4']
			}
		]
	},
	{
		id: 'queen',
		icon: 'queen',
		title: N('The queen', 'Die Dame'),
		steps: [
			{
				kind: 'info',
				text: N(
					'The queen is the strongest piece: she moves like a rook and a bishop together.',
					'Die Dame ist die stärkste Figur: Sie zieht wie Turm und Läufer zusammen.'
				),
				fen: '8/8/8/8/3Q4/8/8/8 w - - 0 1',
				shapes: [
					{ orig: 'd4', dest: 'd8', brush: 'good' },
					{ orig: 'd4', dest: 'h8', brush: 'good' },
					{ orig: 'd4', dest: 'h4', brush: 'good' },
					{ orig: 'd4', dest: 'a1', brush: 'good' },
					{ orig: 'd4', dest: 'a7', brush: 'good' }
				]
			},
			{
				kind: 'stars',
				text: N('Collect the stars with the queen.', 'Sammle die Sterne mit der Dame.'),
				role: 'queen',
				start: 'd1',
				stars: ['d7', 'a4', 'h4', 'e5', 'b8']
			}
		]
	},
	{
		id: 'king',
		icon: 'king',
		title: N('The king', 'Der König'),
		steps: [
			{
				kind: 'info',
				text: N(
					'The king moves one square in any direction. He is the most important piece: if he is trapped, the game is lost.',
					'Der König zieht ein Feld in jede Richtung. Er ist die wichtigste Figur: Ist er gefangen, ist die Partie verloren.'
				),
				fen: '8/8/8/8/3K4/8/8/8 w - - 0 1',
				shapes: ['c5', 'd5', 'e5', 'c4', 'e4', 'c3', 'd3', 'e3'].map((sq) => ({
					orig: 'd4',
					dest: sq,
					brush: 'good' as const
				}))
			},
			{
				kind: 'stars',
				text: N('Walk the king to all the stars.', 'Führe den König zu allen Sternen.'),
				role: 'king',
				start: 'e1',
				stars: ['e3', 'f4', 'd5', 'c4']
			}
		]
	},
	{
		id: 'knight',
		icon: 'knight',
		title: N('The knight', 'Der Springer'),
		steps: [
			{
				kind: 'info',
				text: N(
					'The knight jumps in an “L”: two squares in one direction, then one to the side. It is the only piece that can jump over others.',
					'Der Springer springt in einem „L“: zwei Felder in eine Richtung, dann eins zur Seite. Als einzige Figur kann er über andere springen.'
				),
				fen: '8/8/8/8/3N4/8/8/8 w - - 0 1',
				shapes: ['c6', 'e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5'].map((sq) => ({
					orig: 'd4',
					dest: sq,
					brush: 'good' as const
				}))
			},
			{
				kind: 'stars',
				text: N('Jump to all the stars.', 'Spring zu allen Sternen.'),
				role: 'knight',
				start: 'b1',
				stars: ['c3', 'e4', 'f6']
			},
			{
				kind: 'stars',
				text: N('A longer jump route.', 'Ein längerer Sprungweg.'),
				role: 'knight',
				start: 'g1',
				stars: ['h3', 'g5', 'e6', 'd8']
			}
		]
	},
	{
		id: 'pawn',
		icon: 'pawn',
		title: N('The pawn', 'Der Bauer'),
		steps: [
			{
				kind: 'info',
				text: N(
					'Pawns move straight forward, one square at a time. From their starting square they may move two squares. They never move backwards.',
					'Bauern ziehen geradeaus nach vorn, immer ein Feld. Vom Startfeld aus dürfen sie zwei Felder ziehen. Rückwärts geht es nie.'
				),
				fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
				shapes: [{ orig: 'e2', dest: 'e4', brush: 'good' }]
			},
			{
				kind: 'info',
				text: N(
					'Careful: pawns capture differently – diagonally forward, one square.',
					'Achtung: Bauern schlagen anders – schräg nach vorn, ein Feld.'
				),
				fen: '8/8/8/3p1p2/4P3/8/8/8 w - - 0 1',
				shapes: [
					{ orig: 'e4', dest: 'd5', brush: 'good' },
					{ orig: 'e4', dest: 'f5', brush: 'good' }
				]
			},
			{
				kind: 'find',
				text: N(
					'Capture the black pawn with your pawn.',
					'Schlag den schwarzen Bauern mit deinem Bauern.'
				),
				fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
				accept: ['e4d5'],
				done: N('Exactly – diagonally forward.', 'Genau – schräg nach vorn.')
			}
		]
	},
	{
		id: 'capture',
		icon: 'capture',
		title: N('Capturing & piece values', 'Schlagen & Figurenwerte'),
		steps: [
			{
				kind: 'info',
				text: N(
					'You capture by moving onto an enemy piece. Rough values: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is priceless.',
					'Du schlägst, indem du auf eine gegnerische Figur ziehst. Grobe Werte: Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Der König ist unbezahlbar.'
				),
				fen: START
			},
			{
				kind: 'find',
				text: N(
					'The black knight is unprotected. Capture it!',
					'Der schwarze Springer ist ungedeckt. Schlag ihn!'
				),
				fen: 'rnbqkb1r/pppppppp/8/8/6n1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3',
				accept: ['f3g4'],
				done: N(
					'A free piece – always check what you can capture.',
					'Eine Figur gratis – schau immer, was du schlagen kannst.'
				)
			}
		]
	},
	{
		id: 'check',
		icon: 'check',
		title: N('Check', 'Schach'),
		steps: [
			{
				kind: 'info',
				text: N(
					'When the king is attacked, it is “in check”. The player must get out of check immediately.',
					'Wird der König angegriffen, steht er „im Schach“. Dann muss man das Schach sofort beenden.'
				),
				fen: '4k3/8/8/8/8/8/8/R3K3 b - - 0 1',
				shapes: [{ orig: 'a1', dest: 'a8', brush: 'info' }]
			},
			{
				kind: 'find',
				text: N('Give check to the black king.', 'Gib dem schwarzen König Schach.'),
				fen: 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
				accept: 'check',
				done: N('Check! The king is attacked.', 'Schach! Der König wird angegriffen.')
			},
			{
				kind: 'info',
				text: N(
					'Three ways out of check: move the king, block the attack, or capture the attacker.',
					'Drei Wege aus dem Schach: König wegziehen, dazwischenziehen oder den Angreifer schlagen.'
				),
				fen: '4k3/8/8/8/8/2N5/5PPP/r3K3 w - - 0 1',
				shapes: [{ orig: 'a1', dest: 'e1', brush: 'bad' }]
			},
			{
				kind: 'find',
				text: N(
					'You are in check. Block it with your knight!',
					'Du stehst im Schach. Zieh mit dem Springer dazwischen!'
				),
				fen: '4k3/8/8/8/8/2N5/5PPP/r3K3 w - - 0 1',
				accept: ['c3b1', 'c3d1'],
				done: N(
					'Blocked – the king is safe again.',
					'Dazwischengezogen – der König ist wieder sicher.'
				)
			},
			{
				kind: 'find',
				text: N(
					'In check again. This time: capture the attacker!',
					'Wieder Schach. Diesmal: schlag den Angreifer!'
				),
				fen: '4k3/8/8/8/8/8/1Q3PPP/r3K3 w - - 0 1',
				accept: ['b2a1'],
				done: N('The attacker is gone.', 'Der Angreifer ist weg.')
			}
		]
	},
	{
		id: 'mate',
		icon: 'mate',
		title: N('Checkmate', 'Schachmatt'),
		steps: [
			{
				kind: 'info',
				text: N(
					'Checkmate: the king is in check and there is no way out. That ends the game – the goal of chess!',
					'Schachmatt: Der König steht im Schach, und es gibt keinen Ausweg. Damit ist die Partie vorbei – das Ziel im Schach!'
				),
				fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
				shapes: [{ orig: 'a1', dest: 'a8', brush: 'good' }]
			},
			{
				kind: 'find',
				text: N('Checkmate in one move!', 'Matt in einem Zug!'),
				fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
				accept: 'mate',
				done: N(
					'Back-rank mate: the king is locked in by its own pawns.',
					'Grundreihenmatt: Der König ist von seinen eigenen Bauern eingesperrt.'
				)
			},
			{
				kind: 'find',
				text: N('Mate in one with the queen.', 'Matt in einem Zug mit der Dame.'),
				fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
				accept: 'mate',
				done: N(
					'Your king guards the escape squares, the queen gives mate.',
					'Dein König deckt die Fluchtfelder, die Dame setzt matt.'
				)
			},
			{
				kind: 'find',
				text: N('The famous early mate – find it!', 'Das berühmte frühe Matt – finde es!'),
				fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 3',
				accept: 'mate',
				done: N(
					'Scholar’s mate on f7. Remember it so it never happens to you!',
					'Schäfermatt auf f7. Merk es dir, damit es dir nie passiert!'
				)
			}
		]
	},
	{
		id: 'castle',
		icon: 'castle',
		title: N('Castling', 'Die Rochade'),
		steps: [
			{
				kind: 'info',
				text: N(
					'Castling is a special move: the king moves two squares towards a rook, and the rook jumps over it. It puts your king in safety.',
					'Die Rochade ist ein Spezialzug: Der König zieht zwei Felder Richtung Turm, und der Turm springt über ihn. So bringst du deinen König in Sicherheit.'
				),
				fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
				shapes: [
					{ orig: 'e1', dest: 'g1', brush: 'good' },
					{ orig: 'h1', dest: 'f1', brush: 'info' }
				]
			},
			{
				kind: 'info',
				text: N(
					'Allowed only if: neither the king nor that rook has moved, nothing stands between them, and the king is not in check and does not pass through an attacked square.',
					'Nur erlaubt, wenn: König und dieser Turm noch nicht gezogen haben, nichts dazwischen steht und der König nicht im Schach steht oder über ein angegriffenes Feld zieht.'
				),
				fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
			},
			{
				kind: 'find',
				text: N(
					'Castle kingside: move your king two squares to the right.',
					'Rochiere kurz: Zieh deinen König zwei Felder nach rechts.'
				),
				fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
				accept: ['e1g1', 'e1h1'],
				done: N('Castled – your king is safe.', 'Rochiert – dein König steht sicher.')
			}
		]
	},
	{
		id: 'promote',
		icon: 'promote',
		title: N('Promotion', 'Umwandlung'),
		steps: [
			{
				kind: 'info',
				text: N(
					'A pawn that reaches the last rank turns into another piece – almost always a queen!',
					'Ein Bauer, der die letzte Reihe erreicht, verwandelt sich in eine andere Figur – fast immer in eine Dame!'
				),
				fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1',
				shapes: [{ orig: 'e7', dest: 'e8', brush: 'good' }]
			},
			{
				kind: 'find',
				text: N('Promote your pawn to a queen.', 'Wandle deinen Bauern in eine Dame um.'),
				fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1',
				accept: ['e7e8q'],
				done: N('A new queen!', 'Eine neue Dame!')
			}
		]
	},
	{
		id: 'enpassant',
		icon: 'pawn',
		title: N('En passant', 'En passant'),
		steps: [
			{
				kind: 'info',
				text: N(
					'A rare rule: if an enemy pawn moves two squares and lands right next to your pawn, you may capture it as if it had moved only one – but only immediately.',
					'Eine seltene Regel: Zieht ein gegnerischer Bauer zwei Felder und landet direkt neben deinem Bauern, darfst du ihn schlagen, als wäre er nur ein Feld gezogen – aber nur sofort.'
				),
				fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
				shapes: [{ orig: 'e5', dest: 'd6', brush: 'good' }]
			},
			{
				kind: 'find',
				text: N(
					'Black just played d7–d5. Capture en passant!',
					'Schwarz hat gerade d7–d5 gespielt. Schlag en passant!'
				),
				fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
				accept: ['e5d6'],
				done: N('En passant – the pawn is gone.', 'En passant – der Bauer ist weg.')
			}
		]
	},
	{
		id: 'draw',
		icon: 'draw',
		title: N('Stalemate & draws', 'Patt & Remis'),
		steps: [
			{
				kind: 'info',
				text: N(
					'Stalemate: the player to move is NOT in check but has no legal move. The game is a draw – even if one side is far ahead!',
					'Patt: Wer am Zug ist, steht NICHT im Schach, hat aber keinen erlaubten Zug. Die Partie endet remis – selbst wenn eine Seite weit vorn liegt!'
				),
				fen: 'k7/8/1Q6/8/8/8/8/4K3 b - - 0 1',
				shapes: [{ orig: 'a8', brush: 'bad' }]
			},
			{
				kind: 'info',
				text: N(
					'Other draws: the same position three times, 50 moves without a capture or pawn move, too little material to mate (e.g. king vs king), or both players agree.',
					'Weitere Remis: dreimal dieselbe Stellung, 50 Züge ohne Schlagen oder Bauernzug, zu wenig Material zum Mattsetzen (z. B. König gegen König) oder Einigung beider Spieler.'
				),
				fen: '8/8/3k4/8/8/4K3/8/8 w - - 0 1'
			}
		]
	},
	{
		id: 'principles',
		icon: 'rules',
		title: N('How to start a game', 'So beginnst du eine Partie'),
		steps: [
			{
				kind: 'info',
				text: N(
					'1. Take the centre with a pawn (e4 or d4).',
					'1. Besetze das Zentrum mit einem Bauern (e4 oder d4).'
				),
				fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
				shapes: [
					{ orig: 'd4', brush: 'good' },
					{ orig: 'e4', brush: 'good' },
					{ orig: 'd5', brush: 'good' },
					{ orig: 'e5', brush: 'good' }
				]
			},
			{
				kind: 'info',
				text: N(
					'2. Develop knights and bishops towards the centre – knights before bishops.',
					'2. Entwickle Springer und Läufer Richtung Zentrum – Springer vor Läufern.'
				),
				fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
				shapes: [
					{ orig: 'f1', dest: 'c4', brush: 'good' },
					{ orig: 'b1', dest: 'c3', brush: 'good' }
				]
			},
			{
				kind: 'info',
				text: N(
					'3. Castle early. 4. Don’t bring the queen out too early. 5. Don’t move the same piece twice without a reason.',
					'3. Früh rochieren. 4. Die Dame nicht zu früh herausbringen. 5. Dieselbe Figur nicht ohne Grund zweimal ziehen.'
				),
				fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 5',
				shapes: [{ orig: 'g1', brush: 'good' }]
			}
		]
	}
];

export function basicById(id: string): BasicLesson | undefined {
	return BASICS.find((l) => l.id === id);
}

// ───────────── Sterne-Minispiel: eine Figur allein auf dem Brett ─────────────

const LETTER: Record<Exclude<Role, 'pawn'>, string> = {
	king: 'K',
	queen: 'Q',
	rook: 'R',
	bishop: 'B',
	knight: 'N'
};

/** FEN mit nur einer weißen Figur (für die Anzeige) */
export function soloFen(role: Exclude<Role, 'pawn'>, square: string): string {
	const sq = parseSquare(square)!;
	const rows: string[] = [];
	for (let rank = 7; rank >= 0; rank--) {
		const file = sq % 8;
		if (Math.floor(sq / 8) === rank) {
			const before = file ? String(file) : '';
			const after = 7 - file ? String(7 - file) : '';
			rows.push(`${before}${LETTER[role]}${after}`);
		} else rows.push('8');
	}
	return `${rows.join('/')} w - - 0 1`;
}

/** Zielfelder der Figur auf leerem Brett */
export function soloDests(role: Exclude<Role, 'pawn'>, square: string): Map<string, string[]> {
	const sq = parseSquare(square)!;
	const to = attacks({ role, color: 'white' }, sq, SquareSet.fromSquare(sq));
	return new Map([[square, [...to].map((s) => makeSquare(s))]]);
}
