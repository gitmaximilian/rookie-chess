import type { PuzzleAttemptRow } from '#lib/db/db.js';

/** Themen, die nichts über eine Schwäche aussagen */
const META = new Set([
	'short',
	'long',
	'crushing',
	'middlegame',
	'endgame',
	'opening',
	'mate',
	'advantage',
	'oneMove',
	'master',
	'masterVsMaster'
]);

export interface ThemeStat {
	theme: string;
	n: number;
	solved: number;
	rate: number;
}

/** Erfolgsquote je Thema (nur Lichess-Puzzles, mindestens `minN` Versuche) */
export function themeStats(attempts: PuzzleAttemptRow[], minN = 3): ThemeStat[] {
	const map = new Map<string, { n: number; solved: number }>();
	for (const a of attempts) {
		if (a.source !== 'lichess') continue;
		for (const th of a.themes) {
			if (META.has(th)) continue;
			const s = map.get(th) ?? { n: 0, solved: 0 };
			s.n++;
			if (a.solved) s.solved++;
			map.set(th, s);
		}
	}
	return [...map.entries()]
		.filter(([, s]) => s.n >= minN)
		.map(([theme, s]) => ({ theme, n: s.n, solved: s.solved, rate: s.solved / s.n }));
}

export function weakest(stats: ThemeStat[], k = 3): ThemeStat[] {
	return [...stats].sort((a, b) => a.rate - b.rate || b.n - a.n).slice(0, k);
}

export function strongest(stats: ThemeStat[], k = 3): ThemeStat[] {
	return [...stats].sort((a, b) => b.rate - a.rate || b.n - a.n).slice(0, k);
}
