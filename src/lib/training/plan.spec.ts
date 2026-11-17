import { describe, expect, it } from 'vitest';
import { buildPlan, isDone, minutesOf, progressOf, type PlanContext } from './plan';
import { BASICS } from '#lib/basics/lessons.js';
import { estimateStrength, nextMilestone } from './strength';

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
	gamesToday: 0,
	dueMistakes: 0,
	safetyToday: 0,
	safetyFirst: false,
	checkupDue: false,
	checkupToday: false,
	strength: 1500,
	minutes: 30
};

describe('Tagesplan', () => {
	it('Anfänger ohne Regelkenntnis: Regelübung zuerst, danach Spielpraxis', () => {
		const p = buildPlan({ ...base, rulesKnown: 'no', weakTheme: 'fork' });
		expect(p.tasks).toEqual([{ id: 'basics:board', kind: 'basics', lesson: 'board' }]);
		const after = buildPlan({
			...base,
			rulesKnown: 'no',
			basicsDone: BASICS.map((l) => l.id),
			daysSinceGame: null
		});
		expect(after.tasks.some((task) => task.kind === 'play')).toBe(true);
	});

	it('Sicherheit zuerst: Blunder-Check, eigene Fehler, Taktik – in dieser Reihenfolge', () => {
		const p = buildPlan({
			...base,
			safetyFirst: true,
			dueMistakes: 9,
			dueReview: 4,
			weakTheme: 'pin',
			gameToReview: 7
		});
		expect(p.tasks.map((t) => t.kind)).toEqual(['safety', 'game', 'mistakes', 'review', 'puzzles']);
		expect(p.tasks[2]).toMatchObject({ target: 5 });
		expect(p.tasks[4]).toMatchObject({ theme: 'pin' });
	});

	it('hält das Zeitbudget ein; Taktik schrumpft statt zu entfallen', () => {
		const c = { ...base, safetyFirst: true, dueMistakes: 0, daysSinceGame: null, minutes: 30 };
		const p = buildPlan(c);
		const total = p.tasks.reduce((s, t) => s + minutesOf(t), 0);
		expect(total).toBeLessThanOrEqual(30);
		expect(p.tasks.map((t) => t.kind)).toContain('play');
		const pz = p.tasks.find((t) => t.kind === 'puzzles');
		expect(pz && 'target' in pz ? pz.target : 0).toBeGreaterThanOrEqual(3);
	});

	it('Kontrolltest steht vorn, wenn er fällig ist', () => {
		const p = buildPlan({ ...base, safetyFirst: true, checkupDue: true });
		expect(p.tasks[0]).toMatchObject({ kind: 'checkup' });
		expect(
			progressOf(p.tasks[0], { ...base, checkupToday: true }, { dueReview: 0, dueRepertoire: 0 })
		).toEqual({
			done: 1,
			target: 1
		});
	});

	it('Lektionen passend zur Spielstärke: unter 900 keine Stufe-2-Endspiele', () => {
		const stars = { kqk: 3, kkrr: 3, square: 3 };
		const low = buildPlan({ ...base, strength: 700, endgameStars: stars, minutes: 60 });
		const mid = buildPlan({ ...base, strength: 1000, endgameStars: stars, minutes: 60 });
		expect(low.tasks.find((t) => t.kind === 'endgame')).toBeUndefined();
		expect(mid.tasks.find((t) => t.kind === 'endgame')).toMatchObject({ lesson: 'krk' });
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
		const plan = buildPlan({
			...base,
			dueReview: 4,
			dueMistakes: 3,
			weakTheme: 'fork',
			safetyFirst: true
		});
		const init = { dueReview: 4, dueRepertoire: 0, dueMistakes: 3 };
		const now = { ...base, dueReview: 1, dueMistakes: 1, puzzlesToday: 3, safetyToday: 2 };
		const by = (k: string) => plan.tasks.find((t) => t.kind === k)!;
		expect(progressOf(by('review'), now, init)).toEqual({ done: 3, target: 4 });
		expect(progressOf(by('mistakes'), now, init)).toEqual({ done: 2, target: 3 });
		expect(progressOf(by('safety'), now, init)).toEqual({ done: 2, target: 6 });
		// jedes heute gelöste Puzzle zählt (gleiche Zahl wie das Tagesziel)
		expect(progressOf(by('puzzles'), now, init)).toEqual({ done: 3, target: 5 });
		expect(isDone(by('review'), { ...now, dueReview: 0 }, init)).toBe(true);
	});
});

describe('Spielstärke', () => {
	it('ohne Daten keine Schätzung', () => {
		expect(estimateStrength({})).toBeNull();
	});
	it('kombiniert Puzzle-Wertung, besiegte Bots und Online-Wertung (Lichess-Skala)', () => {
		const s = estimateStrength({ puzzle: { rating: 1100, rd: 80, vol: 0.06 } })!;
		expect(s.value).toBe(1050);
		const withBot = estimateStrength({
			puzzle: { rating: 1100, rd: 80, vol: 0.06 },
			botsBeaten: [1150]
		})!;
		// ein besiegter Bot hebt die Schätzung etwas, setzt aber keine Untergrenze (Bot-Stärken sind Schätzungen)
		expect(withBot.value).toBeGreaterThan(1050);
		expect(withBot.value).toBeLessThan(1300);
		expect(estimateStrength({ botsBeaten: [1650] })!.confidence).toBeLessThan(0.2);
		// Lichess ist die Skala selbst, Chess.com liegt darunter
		expect(estimateStrength({ online: { rating: 1400, source: 'lichess' } })!.value).toBe(1400);
		expect(estimateStrength({ online: { rating: 1250, source: 'chesscom' } })!.value).toBe(1400);
	});

	it('eigene Partien fließen ein – mehr Partien, mehr Gewicht; unter 5 Partien gar nicht', () => {
		const puzzle = { rating: 1050, rd: 80, vol: 0.06 };
		const few = estimateStrength({ puzzle, games: { elo: 1500, games: 4 } })!;
		expect(few.value).toBe(1000);
		const some = estimateStrength({ puzzle, games: { elo: 1500, games: 8 } })!;
		const many = estimateStrength({ puzzle, games: { elo: 1500, games: 30 } })!;
		expect(some.value).toBeGreaterThan(1000);
		expect(many.value).toBeGreaterThan(some.value);
		expect(many.parts.map((p) => p.source)).toEqual(['games', 'puzzle']);
		expect(many.parts[0].value).toBe(1500);
	});

	it('Schwerpunkt „Partien spielen“: Partie kommt auch bei knappem Budget in den Plan', () => {
		const p = buildPlan({
			...base,
			focus: 'play',
			weakTheme: 'fork',
			safetyFirst: true,
			dueMistakes: 5,
			daysSinceGame: 2,
			minutes: 20
		});
		const play = p.tasks.find((t) => t.kind === 'play')!;
		expect(play).toBeDefined();
		expect(
			progressOf(play, { ...base, gamesToday: 1 }, { dueReview: 0, dueRepertoire: 0 })
		).toEqual({
			done: 1,
			target: 1
		});
	});

	it('Partie alle zwei Tage oder wenn noch nie gespielt', () => {
		expect(buildPlan({ ...base, daysSinceGame: 3 }).tasks.map((t) => t.kind)).toContain('play');
		expect(buildPlan({ ...base, daysSinceGame: null }).tasks.map((t) => t.kind)).toContain('play');
		expect(buildPlan({ ...base, daysSinceGame: 1 }).tasks.map((t) => t.kind)).not.toContain('play');
		// wer die Regeln noch nicht kennt, lernt erst die Grundlagen
		expect(
			buildPlan({ ...base, rulesKnown: 'no', daysSinceGame: null }).tasks.map((t) => t.kind)
		).not.toContain('play');
	});

	it('Etappenziele bis 1600', () => {
		expect(nextMilestone(650)).toMatchObject({ goal: 800 });
		expect(nextMilestone(1000)).toMatchObject({ goal: 1200, from: 1000, progress: 0 });
		expect(nextMilestone(1100).progress).toBeCloseTo(0.5);
		expect(nextMilestone(1700)).toMatchObject({ goal: 1600, progress: 1 });
	});

	it('unter 1200: Brett-Scan täglich, Blunder-Check kürzer; ab 1150 Stellungsspiel-Lektionen', () => {
		const low = buildPlan({ ...base, strength: 800, safetyFirst: true });
		expect(low.tasks.slice(0, 2).map((t) => t.kind)).toEqual(['scan', 'safety']);
		expect(low.tasks.find((t) => t.kind === 'safety')).toMatchObject({ target: 4 });
		const mid = buildPlan({ ...base, strength: 1300, safetyFirst: true, minutes: 60 });
		expect(mid.tasks.map((t) => t.kind)).not.toContain('scan');
		expect(mid.tasks.find((t) => t.kind === 'positional')).toMatchObject({ lesson: 'pos-pieces' });
		const done = buildPlan({
			...base,
			strength: 1300,
			minutes: 60,
			positionalDone: ['pos-pieces', 'pos-files', 'pos-passer', 'pos-king', 'pos-structure']
		});
		expect(done.tasks.map((t) => t.kind)).not.toContain('positional');
		expect(
			progressOf(
				{ id: 'scan', kind: 'scan', target: 3 },
				{ ...base, scanToday: 2 },
				{ dueReview: 0, dueRepertoire: 0 }
			)
		).toEqual({ done: 2, target: 3 });
	});
});
