import type { ActivityRow } from '#lib/db/db.js';
import { today } from '#lib/db/db.js';

function prevDay(day: string): string {
	const [y, m, d] = day.split('-').map(Number);
	return today(new Date(y, m - 1, d - 1));
}

const active = (r?: ActivityRow) => !!r && r.puzzles + r.games + r.reviews > 0;

/**
 * Trainingsserie in Tagen. Zählt bis heute – oder bis gestern, wenn heute
 * noch nichts passiert ist (die Serie ist dann noch nicht verloren).
 */
export function computeStreak(
	rows: ActivityRow[],
	now = today()
): { days: number; todayDone: boolean } {
	const map = new Map(rows.map((r) => [r.day, r]));
	const todayDone = active(map.get(now));
	let day = todayDone ? now : prevDay(now);
	let days = 0;
	while (active(map.get(day))) {
		days++;
		day = prevDay(day);
	}
	return { days, todayDone };
}
