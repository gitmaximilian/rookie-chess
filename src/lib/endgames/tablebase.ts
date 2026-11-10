import { engine } from '#lib/engine/engine.js';

export type Category =
	'win' | 'loss' | 'draw' | 'unknown' | 'maybe-win' | 'maybe-loss' | 'cursed-win' | 'blessed-loss';

export interface TbResult {
	/** aus Sicht der Seite am Zug */
	category: Category;
	dtm: number | null;
	best: string | null;
	source: 'tablebase' | 'engine';
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
			source: 'tablebase'
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
