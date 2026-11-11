import { t } from '#lib/i18n/i18n.svelte.js';

export type Goal = 'mate' | 'promote' | 'draw';

export interface Lesson {
	id: string;
	level: 1 | 2 | 3;
	goal: Goal;
	/** maximale eigene Züge */
	maxMoves: number;
	player: 'white' | 'black';
	positions: string[];
	/** Kurzform für Karten */
	icon: 'queen' | 'rook' | 'rooks' | 'pawn' | 'king' | 'bridge' | 'shield' | 'bishops' | 'race';
	/** Bebilderte Theorie: eine Stellung je Schritt s1–s4 */
	theory: TheoryStep[];
}

export interface TheoryStep {
	fen: string;
	shapes: { orig: string; dest?: string; brush: 'good' | 'bad' | 'info' | 'hint' }[];
}

const S = (fen: string, ...shapes: TheoryStep['shapes']): TheoryStep => ({
	fen: fen.includes(' ') ? fen : `${fen} w - - 0 1`,
	shapes
});

/** Alle Startstellungen sind mit der Lichess-Tablebase geprüft (scripts/check-endgames). */
export const LESSONS: Lesson[] = [
	{
		id: 'kqk',
		level: 1,
		goal: 'mate',
		maxMoves: 20,
		player: 'white',
		icon: 'queen',
		theory: [
			S('8/8/8/3k4/8/2Q5/8/4K3', { orig: 'c3', brush: 'good' }, { orig: 'd5', brush: 'info' }),
			S('8/8/1k6/8/2Q5/8/8/4K3', { orig: 'b6', dest: 'a7', brush: 'info' }),
			S('k7/8/1Q6/8/8/8/8/4K3 b - - 0 1', { orig: 'a8', brush: 'bad' }),
			S('k7/2K5/1Q6/8/8/8/8/8', { orig: 'b6', dest: 'b7', brush: 'good' })
		],
		positions: [
			'8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
			'8/8/3k4/8/8/8/2Q5/6K1 w - - 0 1',
			'4k3/8/8/8/8/8/8/Q3K3 w - - 0 1'
		]
	},
	{
		id: 'kkrr',
		level: 1,
		goal: 'mate',
		maxMoves: 12,
		player: 'white',
		icon: 'rooks',
		theory: [
			S(
				'8/8/8/4k3/R7/8/1R6/6K1',
				{ orig: 'a4', dest: 'h4', brush: 'info' },
				{ orig: 'b2', dest: 'b5', brush: 'good' }
			),
			S('8/8/4k3/1R6/R7/8/8/6K1', { orig: 'a4', dest: 'a6', brush: 'good' }),
			S('8/8/2k5/1R6/R7/8/8/6K1', { orig: 'b5', dest: 'h5', brush: 'good' }),
			S('4k3/R7/8/8/8/8/8/1R4K1', { orig: 'b1', dest: 'b8', brush: 'good' })
		],
		positions: ['8/8/8/4k3/8/8/R7/1R4K1 w - - 0 1', '3k4/8/8/8/8/8/R7/R5K1 w - - 0 1']
	},
	{
		id: 'krk',
		level: 2,
		goal: 'mate',
		maxMoves: 32,
		player: 'white',
		icon: 'rook',
		theory: [
			S('8/8/3k4/8/R7/8/8/4K3', { orig: 'a4', dest: 'h4', brush: 'info' }),
			S('8/8/3k4/8/R7/8/3K4/8', { orig: 'd2', dest: 'd4', brush: 'good' }),
			S('8/8/3k4/8/3K4/8/8/7R', { orig: 'h1', dest: 'h6', brush: 'good' }),
			S('8/3k4/8/7R/4K3/8/8/8', { orig: 'h5', dest: 'g5', brush: 'info' })
		],
		positions: [
			'8/8/8/3k4/8/8/8/R3K3 w - - 0 1',
			'8/8/4k3/8/8/8/8/4K2R w - - 0 1',
			'8/5k2/8/8/8/8/1R6/1K6 w - - 0 1'
		]
	},
	{
		id: 'opposition',
		level: 2,
		goal: 'promote',
		maxMoves: 25,
		player: 'white',
		icon: 'pawn',
		theory: [
			S('4k3/8/8/8/8/8/3PK3/8', { orig: 'e2', dest: 'e4', brush: 'good' }),
			S(
				'8/8/4k3/8/4K3/4P3/8/8 b - - 0 1',
				{ orig: 'e6', brush: 'info' },
				{ orig: 'e4', brush: 'good' }
			),
			S('8/8/8/4k3/8/4K3/P3P3/8', { orig: 'a2', dest: 'a3', brush: 'good' }),
			S('4k3/8/4K3/4P3/8/8/8/8', { orig: 'e6', brush: 'good' })
		],
		positions: [
			'4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
			'8/8/3k4/8/3K4/8/3P4/8 w - - 0 1',
			'8/8/8/3k4/8/2K5/2P5/8 w - - 0 1'
		]
	},
	{
		id: 'square',
		level: 1,
		goal: 'draw',
		maxMoves: 8,
		player: 'black',
		icon: 'king',
		theory: [
			S(
				'8/8/8/4k3/P7/8/8/7K b - - 0 1',
				{ orig: 'a4', dest: 'a8', brush: 'info' },
				{ orig: 'a4', dest: 'e4', brush: 'info' }
			),
			S('8/8/8/4k3/P7/8/8/7K b - - 0 1', { orig: 'e5', dest: 'd6', brush: 'good' }),
			S('8/8/3k4/8/P7/8/8/7K b - - 0 1', { orig: 'd6', dest: 'c7', brush: 'good' }),
			S('8/8/1k6/P7/8/8/8/7K b - - 0 1', { orig: 'b6', dest: 'a5', brush: 'good' })
		],
		positions: ['8/8/8/4k3/P7/8/8/7K b - - 0 1', '8/8/8/8/1P6/5k2/8/7K b - - 0 1']
	},
	{
		id: 'kqkp',
		level: 2,
		goal: 'mate',
		maxMoves: 20,
		player: 'white',
		icon: 'race',
		theory: [
			S('8/8/8/8/8/8/3pk3/K6Q', { orig: 'd2', dest: 'd1', brush: 'bad' }),
			S('8/8/8/8/4Q3/8/3pk3/K7 b - - 0 1', { orig: 'e4', dest: 'e2', brush: 'info' }),
			S('8/8/8/8/8/3Q4/3p4/K2k4', { orig: 'd1', brush: 'good' }, { orig: 'a1', dest: 'b2', brush: 'good' }),
			S('8/8/8/8/8/2K5/3p4/3k1Q2 b - - 0 1', { orig: 'c3', brush: 'good' }, { orig: 'f1', dest: 'd1', brush: 'good' })
		],
		positions: ['8/8/8/8/8/8/3pk3/K6Q w - - 0 1']
	},
	{
		id: 'krkp',
		level: 2,
		goal: 'mate',
		maxMoves: 26,
		player: 'white',
		icon: 'rook',
		theory: [
			S('8/8/8/4k3/8/4p3/8/1K5R', { orig: 'h1', dest: 'e1', brush: 'good' }),
			S('8/8/8/4k3/8/4p3/8/1K5R', { orig: 'b1', dest: 'd2', brush: 'good' }),
			S('8/8/8/8/3k4/4p3/3K4/7R', { orig: 'h1', dest: 'e1', brush: 'good' }, { orig: 'e3', brush: 'bad' }),
			S('8/8/8/8/8/3k4/8/4K2R', { orig: 'e1', brush: 'good' }, { orig: 'h1', brush: 'good' })
		],
		positions: ['8/8/8/4k3/8/4p3/8/1K5R w - - 0 1']
	},
	{
		id: 'kbbk',
		level: 3,
		goal: 'mate',
		maxMoves: 30,
		player: 'white',
		icon: 'bishops',
		theory: [
			S('8/8/8/4k3/8/8/8/2B1KB2', { orig: 'c1', dest: 'h6', brush: 'info' }, { orig: 'f1', dest: 'a6', brush: 'info' }),
			S('8/8/8/k7/4B3/4B3/4K3/8', { orig: 'e3', brush: 'good' }, { orig: 'e4', brush: 'good' }),
			S('2k5/8/2K5/8/8/3BB3/8/8 b - - 0 1', { orig: 'c8', brush: 'info' }),
			S('k7/2K5/1B6/1B6/8/8/8/8', { orig: 'b5', dest: 'c6', brush: 'good' })
		],
		positions: ['8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1']
	},
	{
		id: 'lucena',
		level: 3,
		goal: 'promote',
		maxMoves: 20,
		player: 'white',
		icon: 'bridge',
		theory: [
			S('1K1k4/1P6/8/8/8/8/r7/2R5', { orig: 'c1', dest: 'd1', brush: 'good' }),
			S('1K6/1P2k3/8/8/8/8/r7/3R4', { orig: 'd1', dest: 'd4', brush: 'good' }),
			S('1K6/1P2k3/8/8/3R4/8/r7/8', { orig: 'b8', dest: 'c7', brush: 'good' }),
			S(
				'8/1P2k3/8/2K5/3R4/8/8/2r5',
				{ orig: 'd4', dest: 'c4', brush: 'good' },
				{ orig: 'c1', dest: 'c5', brush: 'bad' }
			)
		],
		positions: ['1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1']
	},
	{
		id: 'philidor',
		level: 3,
		goal: 'draw',
		maxMoves: 15,
		player: 'black',
		icon: 'shield',
		theory: [
			S('3k4/R7/7r/3PK3/8/8/8/8 b - - 0 1', { orig: 'h6', dest: 'a6', brush: 'info' }),
			S('3k4/R7/3P3r/4K3/8/8/8/8 b - - 0 1', { orig: 'h6', dest: 'h1', brush: 'good' }),
			S('3k4/R7/3PK3/8/8/8/8/7r b - - 0 1', { orig: 'h1', dest: 'e1', brush: 'good' }),
			S('3k4/R7/3PK3/8/8/8/8/4r3 w - - 0 1', { orig: 'd8', brush: 'good' })
		],
		positions: ['3k4/R7/7r/3PK3/8/8/8/8 b - - 0 1']
	}
];

export function lessonById(id: string): Lesson | undefined {
	return LESSONS.find((l) => l.id === id);
}

export function lessonTitle(l: Lesson): string {
	return t(`lessons.${l.id}.title`);
}

export function lessonSubtitle(l: Lesson): string {
	return t(`lessons.${l.id}.subtitle`);
}

export function lessonSteps(l: Lesson): string[] {
	return [1, 2, 3, 4].map((i) => t(`lessons.${l.id}.s${i}`));
}

export function goalText(l: Lesson): string {
	const goal = t(`learn.goal.${l.goal}`);
	return `${goal} ${l.goal === 'draw' ? t('learn.survive', { n: l.maxMoves }) : t('learn.maxMoves', { n: l.maxMoves })}`;
}
