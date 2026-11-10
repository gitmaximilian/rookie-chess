/** Reine UCI-Hilfsfunktionen – ohne Worker, damit testbar. */

export interface Score {
	cp?: number;
	mate?: number;
}

export interface PvLine extends Score {
	multipv: number;
	depth: number;
	pv: string[];
}

export function parseInfo(line: string): PvLine | null {
	if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
	const t = line.split(' ');
	const get = (k: string) => {
		const i = t.indexOf(k);
		return i >= 0 ? t[i + 1] : undefined;
	};
	const depth = Number(get('depth') ?? 0);
	const multipv = Number(get('multipv') ?? 1);
	const si = t.indexOf('score');
	if (si < 0) return null;
	const kind = t[si + 1];
	const val = Number(t[si + 2]);
	// Untere/obere Schranken überspringen – nur exakte Werte
	if (t[si + 3] === 'lowerbound' || t[si + 3] === 'upperbound') return null;
	const pv = t.slice(t.indexOf('pv') + 1).filter(Boolean);
	return {
		depth,
		multipv,
		pv,
		...(kind === 'mate' ? { mate: val } : { cp: val })
	};
}

/** Score aus Sicht der Seite am Zug → aus Sicht von Weiß */
export function toWhite(score: Score, turn: 'white' | 'black'): Score {
	if (turn === 'white') return { ...score };
	return {
		cp: score.cp === undefined ? undefined : -score.cp,
		mate: score.mate === undefined ? undefined : -score.mate
	};
}

/** Vergleichbare Zahl (Centipawns), Matt als großer Wert */
export function scoreToCp(s: Score): number {
	if (s.mate !== undefined) {
		if (s.mate === 0) return -10000;
		return Math.sign(s.mate) * (10000 - Math.abs(s.mate) * 10);
	}
	return s.cp ?? 0;
}

/** Gewinnwahrscheinlichkeit (0..1) wie bei Lichess */
export function winChance(cp: number): number {
	const c = Math.max(-1000, Math.min(1000, cp));
	return 1 / (1 + Math.exp(-0.00368208 * c));
}

export function formatScore(s: Score): string {
	if (s.mate !== undefined) return s.mate === 0 ? '#' : `#${s.mate}`;
	const p = (s.cp ?? 0) / 100;
	return (p > 0 ? '+' : '') + p.toFixed(1);
}
