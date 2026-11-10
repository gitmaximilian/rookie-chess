import type { PvLine } from '#lib/engine/uci.js';
import { scoreToCp } from '#lib/engine/uci.js';
import { t } from '#lib/i18n/i18n.svelte.js';

export interface Bot {
	id: string;
	/** übersetzt (Getter) */
	readonly name: string;
	elo: number;
	readonly tagline: string;
	/** lucide-Icon-Name einer Schachfigur */
	piece: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
	/** Farbton (CSS) */
	hue: number;
	/** Suchlimit für Stockfish */
	nodes: number;
	multipv: number;
	skill: number;
	/** Wie stark schlechtere Züge noch gewählt werden (cp) – höher = menschlicher/schwächer */
	temperature: number;
	/** Chance auf einen „menschlichen Aussetzer“ (zufälliger legaler Zug) */
	blunder: number;
}

export const BOTS: Bot[] = [
	{
		id: 'bruno',
		get name() {
			return t('bots.bruno.name');
		},
		elo: 400,
		get tagline() {
			return t('bots.bruno.tag');
		},
		piece: 'pawn',
		hue: 28,
		nodes: 40,
		multipv: 8,
		skill: 0,
		temperature: 260,
		blunder: 0.3
	},
	{
		id: 'pia',
		get name() {
			return t('bots.pia.name');
		},
		elo: 600,
		get tagline() {
			return t('bots.pia.tag');
		},
		piece: 'knight',
		hue: 340,
		nodes: 100,
		multipv: 6,
		skill: 1,
		temperature: 180,
		blunder: 0.18
	},
	{
		id: 'leo',
		get name() {
			return t('bots.leo.name');
		},
		elo: 800,
		get tagline() {
			return t('bots.leo.tag');
		},
		piece: 'bishop',
		hue: 200,
		nodes: 250,
		multipv: 5,
		skill: 3,
		temperature: 120,
		blunder: 0.1
	},
	{
		id: 'tina',
		get name() {
			return t('bots.tina.name');
		},
		elo: 1000,
		get tagline() {
			return t('bots.tina.tag');
		},
		piece: 'rook',
		hue: 160,
		nodes: 600,
		multipv: 4,
		skill: 5,
		temperature: 80,
		blunder: 0.06
	},
	{
		id: 'kai',
		get name() {
			return t('bots.kai.name');
		},
		elo: 1150,
		get tagline() {
			return t('bots.kai.tag');
		},
		piece: 'knight',
		hue: 255,
		nodes: 1500,
		multipv: 4,
		skill: 7,
		temperature: 55,
		blunder: 0.035
	},
	{
		id: 'rita',
		get name() {
			return t('bots.rita.name');
		},
		elo: 1300,
		get tagline() {
			return t('bots.rita.tag');
		},
		piece: 'king',
		hue: 45,
		nodes: 4000,
		multipv: 3,
		skill: 9,
		temperature: 35,
		blunder: 0.02
	},
	{
		id: 'sven',
		get name() {
			return t('bots.sven.name');
		},
		elo: 1450,
		get tagline() {
			return t('bots.sven.tag');
		},
		piece: 'knight',
		hue: 0,
		nodes: 12000,
		multipv: 3,
		skill: 12,
		temperature: 20,
		blunder: 0.01
	},
	{
		id: 'doris',
		get name() {
			return t('bots.doris.name');
		},
		elo: 1650,
		get tagline() {
			return t('bots.doris.tag');
		},
		piece: 'queen',
		hue: 290,
		nodes: 40000,
		multipv: 2,
		skill: 15,
		temperature: 10,
		blunder: 0.004
	}
];

export function botById(id: string): Bot {
	return BOTS.find((b) => b.id === id) ?? BOTS[0];
}

/**
 * Wählt den Zug des Bots aus den Engine-Kandidaten.
 * - Mit Wahrscheinlichkeit `blunder` ein zufälliger legaler Zug (Schlagzüge bevorzugt)
 * - sonst Softmax über den Centipawn-Verlust zum besten Zug
 */
export function chooseBotMove(
	bot: Bot,
	lines: PvLine[],
	legal: string[],
	captures: Set<string>,
	rng: () => number = Math.random
): string | null {
	const candidates = lines.filter((l) => l.pv.length > 0);
	if (legal.length === 0) return null;

	if (candidates.length === 0 || rng() < bot.blunder) {
		const pool = captures.size > 0 && rng() < 0.6 ? [...captures] : legal;
		return pool[Math.floor(rng() * pool.length)];
	}

	const best = scoreToCp(candidates[0]);
	// Ein Matt in 1 lassen auch schwache Bots selten liegen
	if (candidates[0].mate === 1 && rng() > bot.blunder * 2) return candidates[0].pv[0];

	const weights = candidates.map((l) => Math.exp(-(best - scoreToCp(l)) / bot.temperature));
	const sum = weights.reduce((a, b) => a + b, 0);
	let r = rng() * sum;
	for (let i = 0; i < candidates.length; i++) {
		r -= weights[i];
		if (r <= 0) return candidates[i].pv[0];
	}
	return candidates[0].pv[0];
}

/** Natürlich wirkende Bedenkzeit in ms */
export function thinkDelay(bot: Bot, ply: number, rng: () => number = Math.random): number {
	const base = ply < 6 ? 350 : 600;
	return base + rng() * (300 + bot.elo / 4);
}
