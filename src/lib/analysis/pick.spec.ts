import { describe, expect, it } from 'vitest';
import { MISTAKES_PER_GAME, pickMistakes, type MoveReview } from './run';

const r = (ply: number, loss: number, judgement: MoveReview['judgement'], motif?: string) =>
	({
		ply,
		mover: ply % 2 ? 'white' : 'black',
		judgement,
		kind: judgement,
		loss,
		explanation: motif ? { motif, title: motif } : null
	}) as unknown as MoveReview;

describe('Fehlerkarten je Partie', () => {
	const reviews = [
		r(5, 0.2, 'mistake', 'fork'),
		r(7, 0.5, 'blunder', 'hanging'),
		r(9, 0.25, 'mistake', 'positional'),
		r(11, 0.8, 'blunder', 'mate-allowed'),
		r(13, 0.35, 'blunder', 'hanging'),
		r(6, 0.9, 'blunder', 'hanging')
	];

	it('nur eigene Patzer und Fehler mit Motiv, die teuersten zuerst, höchstens zwei, in Zugfolge', () => {
		const out = pickMistakes(reviews, 'white');
		expect(out).toHaveLength(MISTAKES_PER_GAME);
		expect(out.map((x) => x.ply)).toEqual([7, 11]);
	});

	it('gezielt gewählter Zug kommt immer, auch ohne Motiv', () => {
		expect(pickMistakes(reviews, 'white', 9).map((x) => x.ply)).toEqual([9]);
	});
});
