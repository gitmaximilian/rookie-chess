import { engine } from '#lib/engine/engine.js';

export type Category =
	'win' | 'loss' | 'draw' | 'unknown' | 'maybe-win' | 'maybe-loss' | 'cursed-win' | 'blessed-loss';

export interface TbResult {
	/** aus Sicht der Seite am Zug */
	category: Category;
	dtm: number | null;
	best: string | null;
	source: 'tablebase' | 'engine';
	/** alle Züge mit Ergebnis aus Sicht des GEGNERS nach dem Zug (nur Tablebase) */
	moves?: TbMove[];
}

export interface TbMove {
	uci: string;
	san: string;
	category: Category;
	dtm: number | null;
	dtz: number | null;
}

const cache = new Map<string, TbResult>();

function normCategory(c: string): Category {
	if (c === 'cursed-win' || c === 'maybe-win') return 'win';
	if (c === 'blessed-loss' || c === 'maybe-loss') return 'loss';
	return (['win', 'loss', 'draw'].includes(c) ? c : 'unknown') as Category;
}

/** Lichess-Tablebase (≤ 7 Steine), mit Zeitlimit; offline → Stockfish */
export async function probe(fen: string, timeoutMs = 3000): Promise<TbResult> {
	const key = fen.split(' ').slice(0, 4).join(' ');
	const hit = cache.get(key);
	if (hit) return hit;
	try {
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), timeoutMs);
		const res = await fetch(
			`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`,
			{
				signal: ctrl.signal
			}
		);
		clearTimeout(t);
		if (!res.ok) throw new Error(String(res.status));
		const j = await res.json();
		const out: TbResult = {
			category: normCategory(j.category),
			dtm: j.dtm ?? null,
			best: j.moves?.[0]?.uci ?? null,
			source: 'tablebase',
			moves: (j.moves ?? []).map(
				(m: { uci: string; san: string; category: string; dtm?: number; dtz?: number }) => ({
					uci: m.uci,
					san: m.san,
					category: normCategory(m.category),
					dtm: m.dtm ?? null,
					dtz: m.dtz ?? null
				})
			)
		};
		cache.set(key, out);
		return out;
	} catch {
		return engineProbe(fen);
	}
}

async function engineProbe(fen: string): Promise<TbResult> {
	const res = await engine.analyse({ fen, depth: 16, multipv: 1 });
	const top = res.lines[0];
	let category: Category = 'unknown';
	if (top?.mate !== undefined) category = top.mate > 0 ? 'win' : 'loss';
	else if (top?.cp !== undefined) category = top.cp > 400 ? 'win' : top.cp < -400 ? 'loss' : 'draw';
	return { category, dtm: top?.mate ? top.mate * 2 : null, best: res.bestmove, source: 'engine' };
}

export interface MoveRating {
	kind: 'best' | 'good' | 'slow' | 'holds';
	/** schnellerer Zug, falls es einen gab */
	better?: string;
	/** Matt bzw. Umwandlung in so vielen eigenen Zügen (mit diesem bzw. dem besten Zug) */
	mine?: number;
	best?: number;
}

/** Abstand zum Ziel in eigenen Zügen (aus DTM bzw. DTZ des Gegners) */
function distance(m: TbMove): number | null {
	const d = m.dtm ?? m.dtz;
	return d === null ? null : Math.ceil(Math.abs(d) / 2);
}

/**
 * Bewertet den eigenen Zug anhand der Tablebase-Zugliste der Stellung davor.
 * null = keine Aussage möglich (offline) oder Zug verliert (das meldet judge.ts).
 */
export function rateMove(before: TbResult, uci: string, wantWin: boolean): MoveRating | null {
	const list = before.moves;
	if (!list?.length) return null;
	const mine = list.find((m) => m.uci === uci);
	if (!mine) return null;
	if (!wantWin)
		return mine.category === 'draw' || mine.category === 'loss' ? { kind: 'holds' } : null;
	if (mine.category !== 'loss') return null;
	const winning = list.filter((m) => m.category === 'loss');
	const dists = winning.map(distance).filter((d): d is number => d !== null);
	const bestD = dists.length ? Math.min(...dists) : null;
	const myD = distance(mine);
	if (bestD === null || myD === null) return { kind: 'good' };
	if (myD <= bestD) return { kind: 'best', mine: myD, best: bestD };
	if (myD <= bestD + 2) return { kind: 'good', mine: myD, best: bestD };
	const better = winning.find((m) => distance(m) === bestD);
	return { kind: 'slow', mine: myD, best: bestD, better: better?.san };
}
