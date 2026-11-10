import { fsrs, createEmptyCard, Rating, type Card, type Grade } from 'ts-fsrs';
import { db, type ReviewCardRow } from '#lib/db/db.js';
import { t } from '#lib/i18n/i18n.svelte.js';

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

export type Recall = 'again' | 'hard' | 'good' | 'easy';

const GRADE: Record<Recall, Grade> = {
	again: Rating.Again,
	hard: Rating.Hard,
	good: Rating.Good,
	easy: Rating.Easy
};

/** Nach JSON-Import sind Datumswerte Strings – zurück in Dates */
function reviveCard(c: Card): Card {
	return {
		...c,
		due: new Date(c.due),
		last_review: c.last_review ? new Date(c.last_review) : undefined
	};
}

export function schedule(card: Card | null, recall: Recall, now = new Date()): Card {
	const base = card ? reviveCard(card) : createEmptyCard(now);
	return scheduler.next(base, now, GRADE[recall]).card;
}

/** Bewertet eine Karte (legt sie bei Bedarf an) */
export async function review(
	id: string,
	kind: ReviewCardRow['kind'],
	recall: Recall,
	data?: unknown
): Promise<ReviewCardRow> {
	const existing = await db.reviewCards.get(id);
	const card = schedule(existing?.card ?? null, recall);
	const row: ReviewCardRow = {
		id,
		kind,
		card,
		due: card.due.getTime(),
		data: data ?? existing?.data
	};
	await db.reviewCards.put(row);
	return row;
}

export async function dueCards(
	kind: ReviewCardRow['kind'],
	now = Date.now()
): Promise<ReviewCardRow[]> {
	return db.reviewCards
		.where('due')
		.belowOrEqual(now)
		.filter((r) => r.kind === kind)
		.sortBy('due');
}

export async function countDue(kind?: ReviewCardRow['kind'], now = Date.now()): Promise<number> {
	return db.reviewCards
		.where('due')
		.belowOrEqual(now)
		.filter((r) => !kind || r.kind === kind)
		.count();
}

/** Lesbarer Abstand bis zur nächsten Wiederholung */
export function formatInterval(due: number, now = Date.now()): string {
	const min = Math.round((due - now) / 60000);
	if (min < 60) return min <= 1 ? t('srs.soon') : t('srs.minutes', { n: min });
	const h = Math.round(min / 60);
	if (h < 24) return t('srs.hours', { n: h });
	const d = Math.round(h / 24);
	if (d < 30) return d === 1 ? t('srs.tomorrow') : t('srs.days', { n: d });
	const m = Math.round(d / 30);
	return m === 1 ? t('srs.month') : t('srs.months', { n: m });
}
