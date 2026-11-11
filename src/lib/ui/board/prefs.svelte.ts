/**
 * Darstellung von Brett und Figuren – wie in anderen Schach-Apps einstellbar.
 * Liegt im localStorage (pro Gerät), wird sofort angewendet.
 */
export const BOARD_THEMES = ['wood', 'brown', 'green', 'blue', 'slate', 'purple', 'coral'] as const;
export const PIECE_SETS = [
	'cburnett',
	'merida',
	'chessnut',
	'fantasy',
	'spatial',
	'mpchess'
] as const;
export const ANIMATIONS = ['off', 'fast', 'normal', 'slow'] as const;

export type BoardTheme = (typeof BOARD_THEMES)[number];
export type PieceSet = (typeof PIECE_SETS)[number];
export type Animation = (typeof ANIMATIONS)[number];

export interface BoardPrefs {
	theme: BoardTheme;
	pieces: PieceSet;
	animation: Animation;
	coordinates: boolean;
	showDests: boolean;
	highlightLast: boolean;
}

const DEFAULTS: BoardPrefs = {
	theme: 'wood',
	pieces: 'cburnett',
	animation: 'normal',
	coordinates: true,
	showDests: true,
	highlightLast: true
};

const KEY = 'rookie:board';

function load(): BoardPrefs {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<BoardPrefs>;
		return {
			...DEFAULTS,
			...raw,
			theme: BOARD_THEMES.includes(raw.theme as BoardTheme) ? raw.theme! : DEFAULTS.theme,
			pieces: PIECE_SETS.includes(raw.pieces as PieceSet) ? raw.pieces! : DEFAULTS.pieces,
			animation: ANIMATIONS.includes(raw.animation as Animation)
				? raw.animation!
				: DEFAULTS.animation
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export const boardPrefs = $state<BoardPrefs>(
	typeof window === 'undefined' ? { ...DEFAULTS } : load()
);

export function setBoardPref<K extends keyof BoardPrefs>(key: K, value: BoardPrefs[K]): void {
	boardPrefs[key] = value;
	try {
		localStorage.setItem(KEY, JSON.stringify(boardPrefs));
	} catch {
		/* privat – gilt nur für diese Sitzung */
	}
	applyBoardPrefs();
}

/** Brettfarben und Figurensatz als Attribute am <html> (CSS greift darauf zu) */
export function applyBoardPrefs(): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.setAttribute('data-board', boardPrefs.theme);
	root.setAttribute('data-pieces', boardPrefs.pieces);
}

export function animationMs(a: Animation = boardPrefs.animation): number {
	return { off: 0, fast: 120, normal: 220, slow: 380 }[a];
}
