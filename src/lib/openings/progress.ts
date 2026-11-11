import { getSetting, setSetting } from '#lib/db/db.js';

export interface LineResult {
	firstTry: number;
	total: number;
	date: number;
}

export type CourseProgress = Record<string, Record<string, LineResult>>;

const KEY = 'courseProgress';

export function getCourseProgress(): Promise<CourseProgress> {
	return getSetting<CourseProgress>(KEY, {});
}

export async function saveLineResult(courseId: string, lineId: string, r: LineResult) {
	const all = await getCourseProgress();
	const prev = all[courseId]?.[lineId];
	// bestes Ergebnis behalten, Datum aktualisieren
	all[courseId] = {
		...all[courseId],
		[lineId]:
			prev && prev.firstTry / prev.total > r.firstTry / r.total ? { ...prev, date: r.date } : r
	};
	await setSetting(KEY, all);
}
