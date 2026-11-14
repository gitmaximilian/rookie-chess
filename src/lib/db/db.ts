import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';

export interface SettingRow {
	key: string;
	value: unknown;
	/** Änderungszeit – für den Abgleich zwischen Geräten */
	t?: number;
}

export interface GameRow {
	id?: number;
	date: number;
	pgn: string;
	/** UCI-Züge, für schnelles Laden */
	moves: string[];
	startFen: string;
	result: '1-0' | '0-1' | '1/2-1/2' | '*';
	/** Wer bin ich in dieser Partie */
	myColor: 'white' | 'black';
	opponent: string;
	source: 'bot' | 'lichess' | 'chesscom' | 'pgn' | 'friend';
	/** Externe ID (Import), verhindert Duplikate */
	externalId?: string;
	analysis?: GameAnalysis;
	/** Online-Partien: Wertungszahlen zum Zeitpunkt der Partie */
	myRating?: number;
	oppRating?: number;
	/** bullet | blitz | rapid | classical | daily */
	speed?: string;
	/** gewertete Online-Partie (fehlt bei älteren Importen) */
	rated?: boolean;
}

export interface GameAnalysis {
	/** Bewertung aus Sicht von Weiß in Centipawns je Stellung (Index = Ply) */
	evals: { cp?: number; mate?: number; best?: string }[];
	depth: number;
	done: boolean;
}

export interface PuzzleAttemptRow {
	id?: number;
	puzzleId: string;
	date: number;
	solved: boolean;
	ratingAfter: number;
	themes: string[];
	/** safety = Blunder-Check, checkup = Kontrolltest (zählt nicht für Puzzle-Wertung und Themen) */
	source: 'lichess' | 'mistake' | 'safety' | 'checkup';
	/** mit Hinweis gelöst (ältere Einträge: fehlt) */
	hinted?: boolean;
}

export interface ReviewCardRow {
	/** z. B. "puzzle:00sHx" oder "rep:white:<fen>" */
	id: string;
	/** safety = Blunder-Check-Aufgabe (Zug sicher?) */
	kind: 'puzzle' | 'repertoire' | 'mistake' | 'safety';
	card: Card;
	/** fällig ab (ms) – für Indexabfragen */
	due: number;
	data?: unknown;
}

export interface RatingRow {
	id?: number;
	area: 'puzzle';
	date: number;
	rating: number;
}

export interface MistakePuzzleRow {
	id: string;
	gameId: number;
	fen: string;
	/** Lösung (UCI) – bester Zug */
	solution: string;
	/** Tatsächlich gespielter Zug */
	played: string;
	ply: number;
	date: number;
	label: string;
}

export interface RepertoireNodeRow {
	/** `${color}:${fen-ohne-zähler}:${uci}` */
	id: string;
	color: 'white' | 'black';
	/** Stellung vor dem Zug */
	fen: string;
	uci: string;
	san: string;
	comment?: string;
	/** true = mein Zug (wird abgefragt), false = Gegnerzug */
	mine: boolean;
	createdAt: number;
}

export interface EndgameProgressRow {
	id: string;
	stars: number;
	bestMoves?: number;
	date: number;
}

export interface ActivityRow {
	/** YYYY-MM-DD (lokal) */
	day: string;
	puzzles: number;
	games: number;
	reviews: number;
}

export class RookieDB extends Dexie {
	settings!: EntityTable<SettingRow, 'key'>;
	games!: EntityTable<GameRow, 'id'>;
	puzzleAttempts!: EntityTable<PuzzleAttemptRow, 'id'>;
	reviewCards!: EntityTable<ReviewCardRow, 'id'>;
	ratings!: EntityTable<RatingRow, 'id'>;
	mistakes!: EntityTable<MistakePuzzleRow, 'id'>;
	repertoire!: EntityTable<RepertoireNodeRow, 'id'>;
	endgames!: EntityTable<EndgameProgressRow, 'id'>;
	activity!: EntityTable<ActivityRow, 'day'>;

	constructor(name = 'rookie') {
		super(name);
		this.version(1).stores({
			settings: 'key',
			games: '++id, date, source, externalId',
			puzzleAttempts: '++id, puzzleId, date, solved',
			reviewCards: 'id, kind, due',
			ratings: '++id, area, date',
			mistakes: 'id, gameId, date',
			repertoire: 'id, color, fen',
			endgames: 'id',
			activity: 'day'
		});
	}
}

export const db = new RookieDB();

export const TABLES = [
	'settings',
	'games',
	'puzzleAttempts',
	'reviewCards',
	'ratings',
	'mistakes',
	'repertoire',
	'endgames',
	'activity'
] as const;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
	const row = await db.settings.get(key);
	return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
	try {
		await db.settings.put({ key, value, t: Date.now() });
	} catch (e) {
		// Svelte-Proxys ($state) lassen sich nicht klonen → als einfache Daten speichern
		if ((e as { name?: string })?.name !== 'DataCloneError') throw e;
		await db.settings.put({ key, value: JSON.parse(JSON.stringify(value)), t: Date.now() });
	}
}

/** Merkt sich gelöschte Einträge, damit sie beim Abgleich nicht von anderen Geräten zurückkommen */
export async function addTombstone(kind: 'games' | 'repertoire', key: string): Promise<void> {
	const cur = await getSetting<Record<string, Record<string, number>>>('tombstones', {});
	cur[kind] = { ...cur[kind], [key]: Date.now() };
	await setSetting('tombstones', cur);
}

export function today(d = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export async function bumpActivity(field: 'puzzles' | 'games' | 'reviews', n = 1): Promise<void> {
	const day = today();
	await db.transaction('rw', db.activity, async () => {
		const row = (await db.activity.get(day)) ?? { day, puzzles: 0, games: 0, reviews: 0 };
		row[field] += n;
		await db.activity.put(row);
	});
}
