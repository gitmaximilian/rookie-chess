/**
 * Lichess-Puzzle-Themen, die Rookie nutzt. Namen/Erklärungen kommen aus i18n (themes.<key>).
 * Die Reihenfolge bestimmt den Index im Puzzle-Paket (nicht ändern, nur anhängen!).
 */
import { t } from '#lib/i18n/i18n.svelte.js';

export interface Theme {
	key: string;
	/** Für Anfänger besonders wichtig */
	core?: boolean;
}

export const THEMES: Theme[] = [
	{ key: 'mateIn1', core: true },
	{ key: 'mateIn2', core: true },
	{ key: 'mateIn3' },
	{ key: 'hangingPiece', core: true },
	{ key: 'fork', core: true },
	{ key: 'pin', core: true },
	{ key: 'skewer', core: true },
	{ key: 'discoveredAttack', core: true },
	{ key: 'doubleCheck' },
	{ key: 'backRankMate', core: true },
	{ key: 'smotheredMate' },
	{ key: 'trappedPiece' },
	{ key: 'capturingDefender' },
	{ key: 'deflection' },
	{ key: 'attraction' },
	{ key: 'sacrifice' },
	{ key: 'promotion' },
	{ key: 'advancedPawn' },
	{ key: 'quietMove' },
	{ key: 'defensiveMove' },
	{ key: 'exposedKing' },
	{ key: 'kingsideAttack' },
	{ key: 'intermezzo' },
	{ key: 'xRayAttack' },
	{ key: 'clearance' },
	{ key: 'interference' },
	{ key: 'endgame' },
	{ key: 'middlegame' },
	{ key: 'opening' },
	{ key: 'pawnEndgame' },
	{ key: 'rookEndgame' },
	{ key: 'crushing' },
	{ key: 'short' },
	{ key: 'long' },
	{ key: 'mate' },
	{ key: 'anastasiaMate' },
	{ key: 'arabianMate' },
	{ key: 'hookMate' },
	{ key: 'enPassant' },
	{ key: 'castling' },
	{ key: 'underPromotion' },
	{ key: 'zugzwang' }
];

export const THEME_INDEX = new Map(THEMES.map((t, i) => [t.key, i]));

export function themeName(key: string): string {
	return THEMES.some((x) => x.key === key) ? t(`themes.${key}.name`) : key;
}

export function themeAbout(key: string): string {
	return t(`themes.${key}.about`);
}
