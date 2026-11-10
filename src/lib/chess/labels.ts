import { t } from '#lib/i18n/i18n.svelte.js';
import type { GameEnd } from './game.js';
import type { Color } from 'chessops/types';

export function colorName(c: Color): string {
	return t(c === 'white' ? 'common.white' : 'common.black');
}

export function endReason(e: GameEnd): string {
	return t(`end.${e.kind}`);
}

export type Verdict = 'win' | 'loss' | 'draw';

export function verdictFor(e: GameEnd, me: Color): Verdict {
	if ('winner' in e) return e.winner === me ? 'win' : 'loss';
	return 'draw';
}

export function resultString(e: GameEnd | null): '1-0' | '0-1' | '1/2-1/2' | '*' {
	if (!e) return '*';
	if ('winner' in e) return e.winner === 'white' ? '1-0' : '0-1';
	return '1/2-1/2';
}

export function formatClock(ms: number): string {
	const s = Math.max(0, Math.ceil(ms / 1000));
	const m = Math.floor(s / 60);
	const r = s % 60;
	if (ms < 10000) return `${m}:${String(r).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
	return `${m}:${String(r).padStart(2, '0')}`;
}
