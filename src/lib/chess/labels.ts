import type { GameEnd } from './game.js';
import type { Color } from 'chessops/types';

export function colorName(c: Color): string {
	return c === 'white' ? 'Weiß' : 'Schwarz';
}

export function endReason(e: GameEnd): string {
	switch (e.kind) {
		case 'checkmate':
			return 'durch Schachmatt';
		case 'resign':
			return 'durch Aufgabe';
		case 'timeout':
			return 'durch Zeitüberschreitung';
		case 'stalemate':
			return 'Patt – kein legaler Zug, aber kein Schach';
		case 'insufficient':
			return 'zu wenig Material zum Mattsetzen';
		case 'threefold':
			return 'dreifache Stellungswiederholung';
		case 'fifty':
			return '50-Züge-Regel';
	}
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
