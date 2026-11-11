import type {
	ActivityRow,
	EndgameProgressRow,
	GameRow,
	PuzzleAttemptRow,
	RatingRow,
	ReviewCardRow,
	SettingRow
} from '#lib/db/db.js';

/** Ein Trainingsstand: Tabellenname → Zeilen */
export type Snapshot = Record<string, unknown[]>;

export const SYNC_FORMAT = 'rookie-sync';
export const SYNC_VERSION = 1;

/** Gelöschte Einträge, damit sie auf anderen Geräten nicht wieder auftauchen */
export interface Tombstones {
	games?: Record<string, number>;
	repertoire?: Record<string, number>;
}
export const TOMBSTONE_KEY = 'tombstones';

/** Einstellungen, die nur auf diesem Gerät gelten */
export const LOCAL_ONLY_SETTINGS = new Set(['lastBackupAt', 'syncState']);

/** Partien aus Lichess/Chess.com enthalten Namen Dritter – sie werden nicht synchronisiert,
 * sondern auf jedem Gerät über das verknüpfte Konto neu geladen. */
export function isSyncedGame(g: GameRow): boolean {
	return g.source === 'bot' || g.source === 'pgn' || g.source === 'friend';
}

export function gameKey(g: GameRow): string {
	return g.externalId ?? `${g.source}:${g.date}`;
}

const attemptKey = (a: PuzzleAttemptRow) => `${a.puzzleId}|${a.date}`;
const ratingKey = (r: RatingRow) => `${r.area}|${r.date}`;

function stripId<T extends { id?: unknown }>(row: T): T {
	const copy = { ...row };
	delete copy.id;
	return copy;
}

function byKey<T>(rows: T[], key: (r: T) => string): Map<string, T> {
	return new Map(rows.map((r) => [key(r), r]));
}

function cardProgress(r: ReviewCardRow): number {
	const last = r.card?.last_review
		? new Date(r.card.last_review as unknown as string).getTime()
		: 0;
	return last || 0;
}

function tombstonesOf(settings: SettingRow[]): Tombstones {
	return (settings.find((s) => s.key === TOMBSTONE_KEY)?.value as Tombstones) ?? {};
}

function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
	return {
		games: { ...a.games, ...b.games },
		repertoire: { ...a.repertoire, ...b.repertoire }
	};
}

/**
 * Führt zwei Stände zusammen (lokal und vom Server). Nichts geht verloren:
 * Listen werden vereinigt, bei gleichen Einträgen gewinnt der weiter fortgeschrittene.
 * Ergebnis ist der neue gemeinsame Stand (ohne lokale Auto-IDs).
 */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
	const L = <T>(t: string) => (local[t] ?? []) as T[];
	const R = <T>(t: string) => (remote[t] ?? []) as T[];

	// ── Einstellungen: neuerer Zeitstempel gewinnt, Löschmarken werden vereinigt
	const ls = L<SettingRow & { t?: number }>('settings').filter(
		(s) => !LOCAL_ONLY_SETTINGS.has(s.key)
	);
	const rs = R<SettingRow & { t?: number }>('settings').filter(
		(s) => !LOCAL_ONLY_SETTINGS.has(s.key)
	);
	const tomb = mergeTombstones(tombstonesOf(ls), tombstonesOf(rs));
	const settings = byKey(rs, (s) => s.key);
	for (const s of ls) {
		const other = settings.get(s.key);
		if (!other || (s.t ?? 0) >= (other.t ?? 0)) settings.set(s.key, s);
	}
	settings.set(TOMBSTONE_KEY, {
		key: TOMBSTONE_KEY,
		value: tomb,
		t: Math.max(
			ls.find((x) => x.key === TOMBSTONE_KEY)?.t ?? 0,
			rs.find((x) => x.key === TOMBSTONE_KEY)?.t ?? 0
		)
	} as SettingRow);

	// ── Partien (nur Bot/PGN): Vereinigung, analysierte Fassung bevorzugt
	const games = byKey(R<GameRow>('games').filter(isSyncedGame).map(stripId), gameKey);
	for (const g of L<GameRow>('games').filter(isSyncedGame)) {
		const other = games.get(gameKey(g));
		if (
			!other ||
			(g.analysis?.done && !other.analysis?.done) ||
			(g.analysis?.evals.length ?? 0) > (other.analysis?.evals.length ?? 0)
		)
			games.set(gameKey(g), stripId(g));
	}
	for (const k of Object.keys(tomb.games ?? {})) games.delete(k);

	// ── Puzzle-Versuche und Wertungsverlauf: Vereinigung
	const attempts = byKey(R<PuzzleAttemptRow>('puzzleAttempts').map(stripId), attemptKey);
	for (const a of L<PuzzleAttemptRow>('puzzleAttempts')) attempts.set(attemptKey(a), stripId(a));
	const ratings = byKey(R<RatingRow>('ratings').map(stripId), ratingKey);
	for (const r of L<RatingRow>('ratings')) ratings.set(ratingKey(r), stripId(r));

	// ── Wiederholungskarten: die zuletzt geübte Fassung gewinnt
	const cards = byKey(R<ReviewCardRow>('reviewCards'), (c) => c.id);
	for (const c of L<ReviewCardRow>('reviewCards')) {
		const other = cards.get(c.id);
		if (!other || cardProgress(c) >= cardProgress(other)) cards.set(c.id, c);
	}

	// ── Fehler-Puzzles, Repertoire: Vereinigung (Repertoire mit Löschmarken)
	const mistakes = byKey(R<{ id: string }>('mistakes'), (m) => m.id);
	for (const m of L<{ id: string }>('mistakes')) mistakes.set(m.id, m);
	const rep = byKey(R<{ id: string }>('repertoire'), (n) => n.id);
	for (const n of L<{ id: string }>('repertoire')) rep.set(n.id, n);
	for (const k of Object.keys(tomb.repertoire ?? {})) rep.delete(k);

	// ── Endspiele: beste Sterne, wenigste Züge
	const end = byKey(R<EndgameProgressRow>('endgames'), (e) => e.id);
	for (const e of L<EndgameProgressRow>('endgames')) {
		const o = end.get(e.id);
		end.set(
			e.id,
			o
				? {
						id: e.id,
						stars: Math.max(e.stars, o.stars),
						bestMoves: Math.min(e.bestMoves ?? 99, o.bestMoves ?? 99),
						date: Math.max(e.date, o.date)
					}
				: e
		);
	}

	// ── Aktivität: pro Tag das Maximum je Zähler (doppeltes Zählen beim erneuten Abgleich vermeiden)
	const act = byKey(R<ActivityRow>('activity'), (a) => a.day);
	for (const a of L<ActivityRow>('activity')) {
		const o = act.get(a.day);
		act.set(
			a.day,
			o
				? {
						day: a.day,
						puzzles: Math.max(a.puzzles, o.puzzles),
						games: Math.max(a.games, o.games),
						reviews: Math.max(a.reviews, o.reviews)
					}
				: a
		);
	}

	return {
		settings: [...settings.values()],
		games: [...games.values()],
		puzzleAttempts: [...attempts.values()],
		reviewCards: [...cards.values()],
		ratings: [...ratings.values()],
		mistakes: [...mistakes.values()],
		repertoire: [...rep.values()],
		endgames: [...end.values()],
		activity: [...act.values()]
	};
}

export const KEYS = { gameKey, attemptKey, ratingKey };
