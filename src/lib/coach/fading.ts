export type CoachLevel = 'warn' | 'check';
export type CoachPref = 'auto' | CoachLevel;

export interface CoachSample {
	puzzleId: string;
	date: number;
	solved: boolean;
}

/** Use recent unaided decisions on distinct positions. Old results don't lock the coach at a level. */
export function coachLevel(pref: CoachPref, attempts: CoachSample[], now = Date.now()): CoachLevel {
	if (pref !== 'auto') return pref;
	const recent = new Map<string, boolean>();
	for (const attempt of [...attempts].sort((a, b) => b.date - a.date)) {
		if (attempt.date < now - 30 * 86_400_000 || recent.has(attempt.puzzleId)) continue;
		recent.set(attempt.puzzleId, attempt.solved);
		if (recent.size === 8) break;
	}
	const found = Array.from(recent.values()).filter(Boolean).length;
	return recent.size >= 4 && found / recent.size >= 0.75 ? 'check' : 'warn';
}
