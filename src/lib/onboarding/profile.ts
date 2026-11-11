import { db, getSetting, setSetting } from '#lib/db/db.js';

export type Rules = 'no' | 'some' | 'yes';
export type Level = 'new' | 'casual' | 'club' | 'unknown';
export type Focus = 'rules' | 'tactics' | 'play' | 'openings';

export interface LearnerProfile {
	rules: Rules;
	level: Level;
	focus: Focus;
	date: number;
}

export const PROFILE_KEY = 'learnerProfile';

/** Start-Rating für Puzzles aus der Selbsteinschätzung (unsicher → großer Spielraum) */
export function startRating(p: Pick<LearnerProfile, 'rules' | 'level'>): number {
	if (p.rules === 'no') return 500;
	if (p.rules === 'some') return 650;
	return { new: 700, casual: 950, club: 1300, unknown: 800 }[p.level];
}

/** Empfohlener erster Bot */
export function startBot(p: Pick<LearnerProfile, 'rules' | 'level'>): string {
	if (p.rules !== 'yes') return 'bruno';
	return { new: 'pia', casual: 'tina', club: 'rita', unknown: 'leo' }[p.level];
}

/** Erste Seite nach dem Einstieg */
export function firstRoute(
	p: LearnerProfile
): '/learn/basics' | '/puzzles' | '/play' | '/learn/openings' | '/' {
	if (p.rules === 'no') return '/learn/basics';
	return {
		rules: '/learn/basics',
		tactics: '/puzzles',
		play: '/play',
		openings: '/learn/openings'
	}[p.focus] as '/learn/basics' | '/puzzles' | '/play' | '/learn/openings';
}

/** Neu = noch nie eingerichtet und noch nichts gemacht (bestehende Nutzer nicht stören) */
export async function needsOnboarding(): Promise<boolean> {
	if (await getSetting<LearnerProfile | null>(PROFILE_KEY, null)) return false;
	if (await getSetting<boolean>('onboardingSkipped', false)) return false;
	const used =
		(await db.puzzleAttempts.count()) + (await db.games.count()) + (await db.activity.count());
	return used === 0;
}

export async function saveProfile(p: LearnerProfile): Promise<void> {
	await setSetting(PROFILE_KEY, p);
	// nur setzen, wenn noch nichts gelöst wurde – echte Ergebnisse haben Vorrang
	if (!(await db.puzzleAttempts.count()))
		await setSetting('puzzleRating', { rating: startRating(p), rd: 300, vol: 0.06 });
	await setSetting('lastBotId', startBot(p));
	// Tagesplan mit den neuen Antworten neu erstellen
	await setSetting('dailyPlan', null);
}

export function getProfile(): Promise<LearnerProfile | null> {
	return getSetting<LearnerProfile | null>(PROFILE_KEY, null);
}
