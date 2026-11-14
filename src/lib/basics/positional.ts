/**
 * Stellungsspiel-Grundlagen (Stufe 1200–1600 und darüber): aktive Figuren, offene Linien, Freibauer,
 * Königssicherheit, Bauernstruktur. Jede Aufgabe ist mit Stockfish geprüft
 * (scripts/research/check-positional.mjs, Tiefe 18): angenommen werden nur Züge, die zum Konzept passen
 * und höchstens 0,4 Bauern schlechter als der beste Zug sind.
 */
import type { L } from '#lib/openings/courses.js';
import type { BasicLesson } from './lessons.js';

const N = (en: string, de: string): L => ({ en, de });

export const POSITIONAL: BasicLesson[] = [
	{
		id: 'pos-pieces',
		icon: 'knight',
		title: N('Active pieces', 'Aktive Figuren'),
		steps: [
			{
				kind: 'info',
				text: N(
					'A piece is only as strong as the squares it controls. A knight on the rim reaches at most four squares, in the centre eight. Rule of thumb: improve your worst piece.',
					'Eine Figur ist so stark wie die Felder, die sie beherrscht. Ein Springer am Rand erreicht höchstens vier Felder, im Zentrum acht. Faustregel: Verbessere deine schlechteste Figur.'
				),
				fen: '4k3/8/8/3N4/8/N7/8/4K3 w - - 0 1',
				shapes: [
					{ orig: 'a3', brush: 'bad' },
					{ orig: 'd5', brush: 'good' }
				]
			},
			{
				kind: 'info',
				text: N(
					'An outpost is a square no enemy pawn can attack any more. A knight there, protected by a pawn, is often worth more than a rook.',
					'Ein Vorposten ist ein Feld, das kein gegnerischer Bauer mehr angreifen kann. Ein Springer dort, gedeckt von einem Bauern, ist oft mehr wert als ein Turm.'
				),
				// d5: kein schwarzer Bauer auf c- oder e-Linie kann es mehr angreifen
				fen: '4k3/5p2/3p4/3N4/4P3/8/8/4K3 w - - 0 1',
				shapes: [
					{ orig: 'd5', brush: 'good' },
					{ orig: 'e4', dest: 'd5', brush: 'info' }
				]
			},
			{
				kind: 'find',
				text: N(
					'Your knight on a3 is your worst piece. Bring it into play!',
					'Dein Springer auf a3 ist deine schlechteste Figur. Bring ihn ins Spiel!'
				),
				fen: 'r2q1rk1/pp2bppp/2np1n2/2p1p3/4P3/N1PP1N2/PP3PPP/R1BQ1RK1 w - - 0 10',
				accept: ['a3c4'],
				done: N(
					'♘c4 – the knight is back in the game and eyes d6 and e5.',
					'♘c4 – der Springer ist wieder im Spiel und blickt auf d6 und e5.'
				)
			}
		]
	},
	{
		id: 'pos-files',
		icon: 'rook',
		title: N('Rooks on open files', 'Türme auf offene Linien'),
		steps: [
			{
				kind: 'info',
				text: N(
					'Rooks need open files – lines without pawns. On an open file a rook reaches the other side of the board and can invade on the 7th rank.',
					'Türme brauchen offene Linien – Linien ohne Bauern. Auf einer offenen Linie reicht der Turm bis ans andere Ende und kann auf der 7. Reihe eindringen.'
				),
				fen: '6k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1',
				shapes: [{ orig: 'd1', dest: 'd7', brush: 'good' }]
			},
			{
				kind: 'find',
				text: N(
					'The d-file is open. Put a rook on it!',
					'Die d-Linie ist offen. Stell einen Turm darauf!'
				),
				fen: 'r4rk1/ppp1qppp/2n2n2/4p3/4P3/2N2N2/PPP1QPPP/R4RK1 w - - 0 11',
				accept: ['a1d1', 'f1d1'],
				done: N(
					'The rook takes the open file before your opponent does.',
					'Der Turm besetzt die offene Linie, bevor es dein Gegner tut.'
				)
			}
		]
	},
	{
		id: 'pos-passer',
		icon: 'pawn',
		title: N('The passed pawn', 'Der Freibauer'),
		steps: [
			{
				kind: 'info',
				text: N(
					'A passed pawn has no enemy pawn in front of it or on the neighbouring files. Nothing but pieces can stop it – they get tied down. Passed pawns must be pushed.',
					'Ein Freibauer hat keinen gegnerischen Bauern mehr vor sich oder auf den Nachbarlinien. Nur Figuren können ihn aufhalten – und sind dann gebunden. Freibauern müssen laufen.'
				),
				fen: '8/5pk1/6p1/1P6/8/6P1/5PK1/8 w - - 0 1',
				shapes: [{ orig: 'b5', dest: 'b8', brush: 'good' }]
			},
			{
				kind: 'find',
				text: N(
					'The black king is far away. Push your passed pawn!',
					'Der schwarze König ist weit weg. Lass deinen Freibauern laufen!'
				),
				fen: '8/5pk1/6p1/1P6/8/6P1/5PK1/8 w - - 0 1',
				accept: ['b5b6'],
				done: N(
					'b6 – the king cannot catch the pawn any more (rule of the square).',
					'b6 – der König holt den Bauern nicht mehr ein (Quadratregel).'
				)
			}
		]
	},
	{
		id: 'pos-king',
		icon: 'castle',
		title: N('King safety', 'Königssicherheit'),
		steps: [
			{
				kind: 'info',
				text: N(
					'A king in the centre becomes a target as soon as files open. Castle early and leave the pawns in front of your king where they are.',
					'Ein König im Zentrum wird zum Ziel, sobald Linien aufgehen. Rochiere früh und lass die Bauern vor deinem König stehen.'
				),
				fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 8 6',
				shapes: [
					{ orig: 'f2', brush: 'good' },
					{ orig: 'g2', brush: 'good' },
					{ orig: 'h2', brush: 'good' }
				]
			},
			{
				kind: 'find',
				text: N(
					'Your pieces are developed. Bring your king to safety!',
					'Deine Figuren sind entwickelt. Bring deinen König in Sicherheit!'
				),
				fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5',
				accept: ['e1g1', 'e1h1'],
				done: N(
					'Castled – the king is safe and the rook joins the game.',
					'Rochiert – der König steht sicher und der Turm kommt ins Spiel.'
				)
			}
		]
	},
	{
		id: 'pos-structure',
		icon: 'capture',
		title: N('Pawn structure', 'Bauernstruktur'),
		steps: [
			{
				kind: 'info',
				text: N(
					'Pawns cannot move backwards – every pawn move changes the position for good. Weak pawns are isolated (no neighbour on the files next to them) or doubled (two on one file). Rule of thumb: capture towards the centre.',
					'Bauern können nicht zurück – jeder Bauernzug verändert die Stellung für immer. Schwach sind isolierte Bauern (kein Nachbar auf den Nachbarlinien) und Doppelbauern (zwei auf einer Linie). Faustregel: Schlag zum Zentrum hin.'
				),
				fen: '4k3/pp3ppp/8/3p4/8/8/PP3PPP/4K3 w - - 0 1',
				shapes: [{ orig: 'd5', brush: 'bad' }]
			},
			{
				kind: 'find',
				text: N(
					'White has just taken on d5. How do you recapture?',
					'Weiß hat gerade auf d5 geschlagen. Wie schlägst du zurück?'
				),
				fen: 'rnbqkb1r/ppp2ppp/4pn2/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4',
				accept: ['e6d5'],
				done: N(
					'…exd5: Black keeps a pawn in the centre and opens the diagonal for the bishop on c8.',
					'…exd5: Schwarz behält einen Bauern im Zentrum und öffnet die Diagonale für den Läufer c8.'
				)
			}
		]
	}
];
