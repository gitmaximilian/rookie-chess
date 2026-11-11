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
	icon: 'queen' | 'rook' | 'rooks' | 'pawn' | 'king' | 'bridge' | 'shield';
}

/** Alle Startstellungen sind mit der Lichess-Tablebase geprüft (scripts/check-endgames). */
export const LESSONS: Lesson[] = [
	{
		id: 'kqk',
		level: 1,
		goal: 'mate',
		maxMoves: 20,
		player: 'white',
		icon: 'queen',
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
		positions: ['8/8/8/4k3/8/8/R7/1R4K1 w - - 0 1', '3k4/8/8/8/8/8/R7/R5K1 w - - 0 1']
	},
	{
		id: 'krk',
		level: 2,
		goal: 'mate',
		maxMoves: 32,
		player: 'white',
		icon: 'rook',
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
		positions: ['8/8/8/4k3/P7/8/8/7K b - - 0 1', '8/8/8/8/1P6/5k2/8/7K b - - 0 1']
	},
	{
		id: 'lucena',
		level: 3,
		goal: 'promote',
		maxMoves: 20,
		player: 'white',
		icon: 'bridge',
		positions: ['1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1']
	},
	{
		id: 'philidor',
		level: 3,
		goal: 'draw',
		maxMoves: 15,
		player: 'black',
		icon: 'shield',
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
