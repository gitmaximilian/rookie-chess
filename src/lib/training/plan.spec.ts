import { describe, expect, it } from 'vitest';
import { buildPlan, isDone, progressOf, type PlanContext } from './plan';
import { estimateStrength } from './strength';

const base: PlanContext = {
	day: '2026-11-11',
	dueReview: 0,
	dueRepertoire: 0,
	weakTheme: null,
	puzzlesToday: 0,
	basicsDone: [],
	courseProgress: {},
	endgameStars: {},
	rulesKnown: 'yes',
	focus: null,
	dailyGoal: 5,
	gameToReview: null,
	reviewedGames: [],
	daysSinceGame: 0,
	gamesToday: 0
};

describe('Tagesplan', () => {
	it('Anfänger ohne Regelkenntnis: Puzzles allgemein + nächste Grundlagen-Lektion', () => {
		const p = buildPlan({ ...base, rulesKnown: 'no', weakTheme: 'fork' });
		expect(p.tasks.map((t) => t.kind)).toEqual(['puzzles', 'basics']);
		expect(p.tasks[0]).not.toHaveProperty('theme');
		expect(p.tasks[1]).toMatchObject({ lesson: 'board' });
	});

	it('mit Daten: Wiederholung, Schwäche, Repertoire, Partie – höchstens 4 Aufgaben', () => {
		const p = buildPlan({
			...base,
			dueReview: 25,
			dueRepertoire: 3,
			weakTheme: 'pin',
			gameToReview: 7
		});
		expect(p.tasks.map((t) => t.kind)).toEqual(['review', 'puzzles', 'repertoire', 'game']);
		expect(p.tasks[0]).toMatchObject({ target: 10 });
		expect(p.tasks[1]).toMatchObject({ theme: 'pin' });
	});

	it('Fokus Eröffnungen: angefangener Kurs wird fortgesetzt', () => {
		const p = buildPlan({
			...base,
			focus: 'openings',
			courseProgress: { caro: { classical: {} } }
		});
		expect(p.tasks.at(-1)).toMatchObject({ kind: 'course', course: 'caro', line: 'advance' });
	});

	it('Fortschritt wird live berechnet', () => {
		const plan = buildPlan({ ...base, dueReview: 4, weakTheme: 'fork' });
		const init = { dueReview: 4, dueRepertoire: 0 };
		const now = { ...base, dueReview: 1, puzzlesToday: 3 };
		expect(progressOf(plan.tasks[0], now, init)).toEqual({ done: 3, target: 4 });
		// jedes heute gelöste Puzzle zählt (gleiche Zahl wie das Tagesziel)
		expect(progressOf(plan.tasks[1], now, init)).toEqual({ done: 3, target: 5 });
		expect(isDone(plan.tasks[0], { ...now, dueReview: 0 }, init)).toBe(true);
	});
});

describe('Spielstärke', () => {
	it('ohne Daten keine Schätzung', () => {
		expect(estimateStrength({})).toBeNull();
	});
	it('kombiniert Puzzle-Wertung, besiegte Bots und Online-Wertung', () => {
		const s = estimateStrength({ puzzle: { rating: 1100, rd: 80, vol: 0.06 } })!;
		expect(s.value).toBe(900);
		const withBot = estimateStrength({
			puzzle: { rating: 1100, rd: 80, vol: 0.06 },
			botsBeaten: [1150]
		})!;
		expect(withBot.value).toBeGreaterThanOrEqual(1150);
		const online = estimateStrength({ online: { rating: 1400, source: 'lichess' } })!;
		expect(online.value).toBe(1250);
	});

	it('Schwerpunkt „Partien spielen“: Partie mit Coach steht zuerst', () => {
		const p = buildPlan({ ...base, focus: 'play', weakTheme: 'fork' });
		expect(p.tasks[0]).toMatchObject({ kind: 'play' });
		expect(
			progressOf(p.tasks[0], { ...base, gamesToday: 1 }, { dueReview: 0, dueRepertoire: 0 })
		).toEqual({
			done: 1,
			target: 1
		});
	});

	it('länger nicht gespielt oder noch nie: Partie kommt nach den Puzzles dazu', () => {
		expect(buildPlan({ ...base, daysSinceGame: 3 }).tasks.map((t) => t.kind)).toContain('play');
		expect(buildPlan({ ...base, daysSinceGame: null }).tasks[1]).toMatchObject({ kind: 'play' });
		expect(buildPlan({ ...base, daysSinceGame: 1 }).tasks.map((t) => t.kind)).not.toContain('play');
		// wer die Regeln noch nicht kennt, lernt erst die Grundlagen
		expect(
			buildPlan({ ...base, rulesKnown: 'no', daysSinceGame: null }).tasks.map((t) => t.kind)
		).not.toContain('play');
	});
});
