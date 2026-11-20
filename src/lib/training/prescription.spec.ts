import { describe, expect, it } from 'vitest';
import {
	adjust,
	DAYS_PER_WEEK,
	MAX_GAMES,
	MIN_GAMES,
	pathTo1600,
	recipeFor,
	weekProgress,
	weekStart
} from './prescription';

const DAY = 86_400_000;

describe('Verordnung je Stufe', () => {
	it('füllt das Zeitbudget, ohne es zu sprengen', () => {
		for (const s of [450, 800, 1100, 1400, 1600])
			for (const m of [15, 30, 45, 60]) {
				const r = recipeFor(s, m);
				const week = m * DAYS_PER_WEEK;
				const used = r.split.play + r.split.review + r.split.drill + r.split.theory;
				// höchstens 10 % über dem Budget (Mindestmengen bei sehr wenig Zeit)
				expect(used).toBeLessThanOrEqual(Math.max(week * 1.1, MIN_GAMES * 25 + 30));
				expect(r.games).toBeGreaterThanOrEqual(MIN_GAMES);
				expect(r.games).toBeLessThanOrEqual(MAX_GAMES);
			}
	});

	it('mehr Zeit → mehr Partien; ab 30 min mindestens 4 (Lichess: darunter kaum Fortschritt)', () => {
		expect(recipeFor(900, 60).games).toBeGreaterThan(recipeFor(900, 15).games);
		expect(recipeFor(900, 30).games).toBeGreaterThanOrEqual(4);
		expect(recipeFor(900, 30)).toMatchObject({ timeControl: '10+5', scan: 3 });
		expect(recipeFor(1300, 30)).toMatchObject({ timeControl: '10+5', scan: 0 });
		expect(recipeFor(900, 30, true).timeControl).toBe('15+10');
	});

	it('jeden Tag Puzzles – über 1000 im Jahr ab 30 min/Tag', () => {
		for (const s of [500, 900, 1300, 1500])
			expect(recipeFor(s, 30).puzzles * DAYS_PER_WEEK * 52).toBeGreaterThanOrEqual(1000);
	});

	it('Abrufen vor Theorie; Spielen höchstens die Hälfte der Zeit', () => {
		for (const s of [500, 900, 1300]) {
			const r = recipeFor(s, 30);
			expect(r.split.drill).toBeGreaterThan(r.split.theory);
			expect(
				r.split.drill / (r.split.play + r.split.review + r.split.drill + r.split.theory)
			).toBeGreaterThan(0.25);
			expect(
				r.split.play / (r.split.play + r.split.review + r.split.drill + r.split.theory)
			).toBeLessThanOrEqual(0.5);
		}
	});

	it('ohne bekannte Stärke: Einstiegsstufe', () => {
		expect(recipeFor(null, 30).stage).toBe('foundation');
	});
});

describe('Diese Woche', () => {
	it('beginnt am Montag', () => {
		const wed = new Date(2026, 10, 18, 15).getTime(); // Mittwoch
		expect(new Date(weekStart(wed)).getDay()).toBe(1);
		expect(weekStart(wed)).toBeLessThanOrEqual(wed);
		expect(wed - weekStart(wed)).toBeLessThan(7 * DAY);
	});

	it('zählt Partien, Besprechungen und Übungen gegen die Dosis', () => {
		const r = recipeFor(900, 30);
		const empty = weekProgress(r, { games: [], reviewed: [], puzzles: 0, safety: 0 });
		expect(empty.share).toBe(0);
		const full = weekProgress(r, {
			games: Array.from({ length: r.games }, (_, i) => ({ id: i, date: 0 })),
			reviewed: Array.from({ length: r.games }, (_, i) => i),
			puzzles: r.puzzles * DAYS_PER_WEEK,
			safety: r.safety * DAYS_PER_WEEK,
			lessons: r.lessons
		});
		expect(full.share).toBe(1);
		// eine Partie gespielt, nicht besprochen → Besprechen-Ziel ist diese eine
		const one = weekProgress(r, {
			games: [{ id: 7, date: 0 }],
			reviewed: [],
			puzzles: 0,
			safety: 0
		});
		expect(one.reviewed).toEqual({ done: 0, target: 1 });
		expect(one.share).toBeGreaterThan(0);
	});
});

describe('Weg zu 1600', () => {
	it('nächstes Etappenziel und Patzer-Bezug der Etappe', () => {
		const p = pathTo1600(1050, 3.8)!;
		expect(p.goal).toBe(1200);
		expect(p.blundersAtGoal).toBeGreaterThan(2.5);
		expect(p.blundersAtGoal).toBeLessThan(3.8);
		expect(p.blunderGap).toBe(true);
		expect(pathTo1600(1650, 2)!.reached).toBe(true);
		expect(pathTo1600(null, 3)).toBeNull();
	});
});

describe('Anpassen', () => {
	const now = Date.UTC(2026, 10, 20);
	const r = recipeFor(1000, 30);
	const ratings = (gain: number) =>
		Array.from({ length: 14 }, (_, i) => ({
			date: now - (60 - i * 4) * DAY,
			rating: 1000 + Math.round((gain * i) / 13)
		}));
	const base = { recipe: r, games14: r.games * 2, reviewed14: r.games * 2, now };

	it('zu wenig gespielt → mehr spielen; nicht besprochen → erst besprechen', () => {
		expect(adjust({ ...base, games14: 1, ratings: [], path: null }).kind).toBe('play-more');
		expect(adjust({ ...base, reviewed14: 0, ratings: [], path: null }).kind).toBe('review-first');
	});

	it('Stillstand: Patzer über dem Etappenwert → langsamer; sonst Taktik', () => {
		expect(adjust({ ...base, ratings: ratings(0), path: pathTo1600(1000, 4.5) }).kind).toBe(
			'slow-down'
		);
		expect(adjust({ ...base, ratings: ratings(5), path: pathTo1600(1000, 2.5) }).kind).toBe(
			'more-tactics'
		);
		expect(adjust({ ...base, ratings: ratings(120), path: pathTo1600(1000, 4.5) }).kind).toBe(
			'on-track'
		);
	});

	it('zu wenig Partien im Zeitraum → kein Urteil', () => {
		expect(adjust({ ...base, ratings: ratings(0).slice(-3), path: null }).kind).toBe('none');
	});
});

it('Beispiel-Verordnungen (Protokoll)', () => {
	const rows = [500, 900, 1300, 1500].flatMap((s) =>
		[15, 30, 60].map((m) => {
			const r = recipeFor(s, m);
			return `${s} · ${m} min/Tag → ${r.games}× ${r.timeControl}, ${r.puzzles} Puzzles, ${r.safety} Blunder-Checks, ${r.scan} Scan, ${r.lessons} Lektionen/Woche`;
		})
	);
	if (process.env.RECIPE_LOG) console.log(rows.join('\n'));
	expect(rows.length).toBe(12);
});
