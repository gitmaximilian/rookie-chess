/**
 * Sterne statt Erfolge: Jede Lerneinheit bringt 0–3 Sterne.
 * Alles wird aus vorhandenen Daten berechnet – es gibt keinen eigenen Speicher.
 */
import { getSetting, db } from '#lib/db/db.js';
import { BASICS, TACTICS } from '#lib/basics/lessons.js';
import { LESSONS } from '#lib/endgames/lessons.js';
import { COURSES } from '#lib/openings/courses.js';
import { getCourseProgress, type LineResult } from '#lib/openings/progress.js';

export type StarArea = 'basics' | 'tactics' | 'openings' | 'endgames';

export const STAR_AREAS: StarArea[] = ['basics', 'tactics', 'openings', 'endgames'];

export interface AreaStars {
	area: StarArea;
	earned: number;
	max: number;
}

export interface StarInput {
	basicsDone: string[];
	tacticsDone: string[];
	/** Kurs → Variante → Ergebnis */
	courseProgress: Record<string, Record<string, LineResult>>;
	/** Endspiel-ID → Sterne (0–3) */
	endgameStars: Record<string, number>;
}

/** Sterne einer gelernten Eröffnungsvariante nach Trefferquote beim ersten Versuch */
export function lineStars(r: LineResult | undefined): number {
	if (!r || !r.total) return 0;
	const q = r.firstTry / r.total;
	return q >= 0.9 ? 3 : q >= 0.6 ? 2 : 1;
}

/** Abgeschlossene Grundlagen- und Taktiklektionen zählen voll */
const LESSON_STARS = 3;

export function computeStars(i: StarInput): AreaStars[] {
	const done = (ids: string[], set: { id: string }[]) =>
		set.filter((l) => ids.includes(l.id)).length * LESSON_STARS;
	const lines = COURSES.flatMap((c) => c.lines.map((l) => ({ c: c.id, l: l.id })));
	return [
		{
			area: 'basics',
			earned: done(i.basicsDone, BASICS),
			max: BASICS.length * LESSON_STARS
		},
		{
			area: 'tactics',
			earned: done(i.tacticsDone, TACTICS),
			max: TACTICS.length * LESSON_STARS
		},
		{
			area: 'openings',
			earned: lines.reduce((s, x) => s + lineStars(i.courseProgress[x.c]?.[x.l]), 0),
			max: lines.length * 3
		},
		{
			area: 'endgames',
			earned: LESSONS.reduce((s, l) => s + Math.min(3, i.endgameStars[l.id] ?? 0), 0),
			max: LESSONS.length * 3
		}
	];
}

export function totalStars(areas: AreaStars[]): { earned: number; max: number } {
	return areas.reduce((s, a) => ({ earned: s.earned + a.earned, max: s.max + a.max }), {
		earned: 0,
		max: 0
	});
}

export async function loadStars(): Promise<AreaStars[]> {
	const [basicsDone, tacticsDone, courseProgress, endgames] = await Promise.all([
		getSetting<string[]>('basicsDone', []),
		getSetting<string[]>('tacticsDone', []),
		getCourseProgress(),
		db.endgames.toArray()
	]);
	return computeStars({
		basicsDone,
		tacticsDone,
		courseProgress,
		endgameStars: Object.fromEntries(endgames.map((e) => [e.id, e.stars]))
	});
}
