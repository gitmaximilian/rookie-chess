import { createEmptyCard } from 'ts-fsrs';
import { db, type RepertoireNodeRow } from '#lib/db/db.js';
import { Game, INITIAL_FEN } from '#lib/chess/game.js';
import { COURSES, lineUcis } from './courses.js';

export type Side = 'white' | 'black';

/** Stellung ohne Zugzähler – gleiche Stellung, gleicher Schlüssel */
export function fenKey(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}

export function nodeId(color: Side, fen: string, uci: string): string {
	return `${color}:${fenKey(fen)}:${uci}`;
}

export interface Starter {
	id: string;
	color: Side;
	lines: string[][];
}

/** Start-Repertoires = alle Varianten der Eröffnungskurse (Züge in UCI) */
export const STARTERS: Starter[] = COURSES.map((c) => ({
	id: c.id,
	color: c.color,
	lines: c.lines.map(lineUcis)
}));

/**
 * Fügt eine Zugfolge ab der Grundstellung hinzu.
 * Eigene Züge bekommen eine sofort fällige Wiederholungskarte.
 * @returns Anzahl neu angelegter eigener Züge
 */
export async function addLine(
	color: Side,
	ucis: string[],
	startFen = INITIAL_FEN
): Promise<number> {
	const g = new Game(startFen);
	let added = 0;
	for (const uci of ucis) {
		const before = g.fen;
		const mover = g.turn;
		const mv = g.play(uci);
		if (!mv) throw new Error(`Illegal move in line: ${uci}`);
		const id = nodeId(color, before, mv.uci);
		if (await db.repertoire.get(id)) continue;
		const mine = mover === color;
		const row: RepertoireNodeRow = {
			id,
			color,
			fen: fenKey(before),
			uci: mv.uci,
			san: mv.san,
			mine,
			createdAt: Date.now()
		};
		await db.repertoire.put(row);
		if (mine) {
			await db.reviewCards.put({
				id: `rep:${id}`,
				kind: 'repertoire',
				card: createEmptyCard(new Date()),
				due: Date.now(),
				data: { nodeId: id }
			});
			added++;
		}
	}
	return added;
}

export async function addStarter(s: Starter): Promise<number> {
	let n = 0;
	for (const line of s.lines) n += await addLine(s.color, line);
	return n;
}

/** Ist ein Start-Repertoire schon vollständig enthalten? */
export async function hasStarter(s: Starter): Promise<boolean> {
	for (const line of s.lines) {
		const g = new Game();
		for (const uci of line) {
			const id = nodeId(s.color, g.fen, uci);
			g.play(uci);
			if (!(await db.repertoire.get(id))) return false;
		}
	}
	return true;
}

/** Alle Repertoire-Züge in einer Stellung */
export async function movesAt(color: Side, fen: string): Promise<RepertoireNodeRow[]> {
	const k = fenKey(fen);
	return db.repertoire
		.where('fen')
		.equals(k)
		.filter((r) => r.color === color)
		.toArray();
}

/** Entfernt einen Zug und alles, was nur über ihn erreichbar ist */
export async function removeNode(node: RepertoireNodeRow): Promise<number> {
	let removed = 0;
	const queue: RepertoireNodeRow[] = [node];
	const seen = new Set<string>();
	while (queue.length) {
		const n = queue.shift()!;
		if (seen.has(n.id)) continue;
		seen.add(n.id);
		await db.repertoire.delete(n.id);
		await db.reviewCards.delete(`rep:${n.id}`);
		removed++;
		const after = afterFen(n);
		// Nur entfernen, wenn kein anderer Zug mehr in diese Stellung führt
		const stillReached = await db.repertoire
			.filter((r) => r.color === n.color && !seen.has(r.id) && afterFen(r) === after)
			.count();
		if (!stillReached) queue.push(...(await movesAt(n.color, after + ' 0 1')));
	}
	return removed;
}

/** Stellung nach dem Zug eines Knotens (als fenKey) */
export function afterFen(n: RepertoireNodeRow): string {
	const g = new Game(n.fen + ' 0 1');
	g.play(n.uci);
	return fenKey(g.fen);
}

export async function repertoireStats(color: Side): Promise<{ mine: number; due: number }> {
	const mineIds = (await db.repertoire.filter((r) => r.color === color && r.mine).toArray()).map(
		(r) => `rep:${r.id}`
	);
	const now = Date.now();
	let due = 0;
	for (const id of mineIds) {
		const c = await db.reviewCards.get(id);
		if (c && c.due <= now) due++;
	}
	return { mine: mineIds.length, due };
}
