import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PuzzleRun, pickPuzzle, dailyPuzzle, type Puzzle } from './puzzles';
import { schedule, formatInterval } from './srs';

// Lichess-Puzzle 00008: Weiß zieht Txb7? – hier ein einfaches Matt-in-1-Beispiel
const mateIn1: Puzzle = {
	id: 't1',
	// Schwarz zieht zuerst (…Kh8), dann Weiß: Dd8#? – konstruiert: Grundreihe
	fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1',
	moves: ['g8f8', 'd1d8'],
	rating: 600,
	themes: ['mateIn1', 'backRankMate'],
	source: 'lichess'
};

const twoStep: Puzzle = {
	id: 't2',
	fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
	moves: ['g8f6', 'f3f7'],
	rating: 500,
	themes: ['mateIn1'],
	source: 'lichess'
};

const fakeFetch = (async (url: string) => {
	const file = 'static' + url;
	return { ok: true, json: async () => JSON.parse(readFileSync(file, 'utf8')) };
}) as unknown as typeof fetch;

describe('PuzzleRun', () => {
	it('spielt den Einleitungszug und bestimmt die Spielerfarbe', () => {
		const run = new PuzzleRun(mateIn1);
		expect(run.playerColor).toBe('white');
		run.playIntro();
		expect(run.game.turn).toBe('white');
		expect(run.expected).toBe('d1d8');
	});

	it('akzeptiert die Lösung und meldet Ende', () => {
		const run = new PuzzleRun(mateIn1);
		run.playIntro();
		expect(run.try('d1e1').result).toBe('wrong');
		expect(run.mistakes).toBe(1);
		const r = run.try('d1d8');
		expect(r).toEqual({ result: 'correct', done: true });
	});

	it('akzeptiert jedes Matt als Lösung', () => {
		const run = new PuzzleRun(twoStep);
		run.playIntro();
		expect(run.try('f3f7').done).toBe(true);
	});

	it('eigene Fehler-Puzzles starten ohne Einleitungszug', () => {
		const run = new PuzzleRun({
			...twoStep,
			source: 'mistake',
			fen: twoStep.fen.replace(' b ', ' w '),
			moves: ['', 'f3f7']
		});
		expect(run.playerColor).toBe('white');
		expect(run.step).toBe(1);
	});
});

describe('Puzzle-Pakete', () => {
	it('liefert Puzzles nahe am Rating, ohne Wiederholungen', async () => {
		const seen = new Set<string>();
		for (let i = 0; i < 5; i++) {
			const p = await pickPuzzle({ rating: 800, exclude: seen }, fakeFetch);
			expect(Math.abs(p.rating - 800)).toBeLessThan(400);
			expect(seen.has(p.id)).toBe(false);
			seen.add(p.id);
			// Lösung muss legal sein
			const run = new PuzzleRun(p);
			run.playIntro();
			while (!run.done) {
				const r = run.try(run.expected!);
				expect(r.result).toBe('correct');
				if (r.reply) run.playReply();
			}
		}
	});

	it('filtert nach Thema', async () => {
		const p = await pickPuzzle({ rating: 900, theme: 'fork', exclude: new Set() }, fakeFetch);
		expect(p.themes).toContain('fork');
	});

	it('Puzzle des Tages ist stabil je Tag', async () => {
		const a = await dailyPuzzle('2026-11-10', fakeFetch);
		const b = await dailyPuzzle('2026-11-10', fakeFetch);
		expect(a.id).toBe(b.id);
	});
});

describe('Wiederholung (FSRS)', () => {
	it('„nochmal“ ist bald fällig, „gut“ später', () => {
		const now = new Date('2026-01-01T10:00:00Z');
		const again = schedule(null, 'again', now);
		const good = schedule(null, 'good', now);
		expect(again.due.getTime()).toBeLessThanOrEqual(good.due.getTime());
		const later = schedule(good, 'good', good.due);
		expect(later.due.getTime()).toBeGreaterThan(good.due.getTime());
	});

	it('formatiert Abstände', () => {
		const now = Date.now();
		expect(formatInterval(now + 86400000, now)).toBe('tomorrow');
		expect(formatInterval(now + 5 * 86400000, now)).toBe('in 5 days');
	});
});
