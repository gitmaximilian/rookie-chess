import { createEmptyCard } from 'ts-fsrs';
import { db, type RepertoireNodeRow } from '#lib/db/db.js';
import { Game, INITIAL_FEN } from '#lib/chess/game.js';

export type Side = 'white' | 'black';

/** Stellung ohne Zugzähler – gleiche Stellung, gleicher Schlüssel */
export function fenKey(fen: string): string {
	return fen.split(' ').slice(0, 4).join(' ');
}

export function nodeId(color: Side, fen: string, uci: string): string {
	return `${color}:${fenKey(fen)}:${uci}`;
}

export interface Starter {
	id: 'italian' | 'london' | 'e5' | 'caro' | 'qgd';
	color: Side;
	lines: string[][];
}

/** Anfängerfreundliche Start-Repertoires (Züge in UCI) */
export const STARTERS: Starter[] = [
	{
		id: 'italian',
		color: 'white',
		lines: [
			['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3'],
			['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3'],
			['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4', 'e5d4', 'f3d4'],
			['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3'],
			['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3'],
			['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3']
		]
	},
	{
		id: 'london',
		color: 'white',
		lines: [
			['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3', 'e7e6', 'g1f3', 'c7c5', 'c2c3', 'b8c6', 'b1d2'],
			['d2d4', 'g8f6', 'c1f4', 'g7g6', 'e2e3', 'f8g7', 'g1f3', 'e8g8', 'f1e2'],
			['d2d4', 'g8f6', 'c1f4', 'e7e6', 'e2e3', 'c7c5', 'c2c3']
		]
	},
	{
		id: 'e5',
		color: 'black',
		lines: [
			['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6'],
			['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'],
			['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'g8f6'],
			['e2e4', 'e7e5', 'b1c3', 'g8f6'],
			['e2e4', 'e7e5', 'f1c4', 'g8f6']
		]
	},
	{
		id: 'caro',
		color: 'black',
		lines: [
			['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5'],
			['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5'],
			['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5'],
			['e2e4', 'c7c6', 'g1f3', 'd7d5', 'b1c3', 'c8g4']
		]
	},
	{
		id: 'qgd',
		color: 'black',
		lines: [
			['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7'],
			['d2d4', 'd7d5', 'c2c4', 'e7e6', 'g1f3', 'g8f6', 'b1c3', 'f8e7'],
			['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4', 'e7e6'],
			['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3', 'e7e6']
		]
	}
];

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
