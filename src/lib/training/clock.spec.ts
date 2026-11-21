import { expect, test } from 'vitest';
import {
	clockAdvice,
	gameClockStats,
	clockLevel,
	clockTrack,
	inTimeTrouble,
	poolClock,
	used10,
	type GameClockStats
} from './clock';

// 3+2-Blitz: Weiß verbraucht viel Zeit, Schwarz verliert auf Zeit
const moves = [
	'e4',
	'e5',
	'Nf3',
	'Nc6',
	'Bc4',
	'Bc5',
	'c3',
	'Nf6',
	'd3',
	'd6',
	'O-O',
	'O-O',
	'h3',
	'h6',
	'Re1',
	'a6',
	'a4',
	'Ba7',
	'Nbd2',
	'Be6'
];
const pgn = (termination: string, result: string) => {
	let body = '';
	moves.forEach((san, i) => {
		const white = i % 2 === 0;
		const n = Math.floor(i / 2) + 1;
		// Weiß: je Zug 12 s minus 2 s Inkrement; Schwarz: je Zug 20 s
		const left = white ? 180 - (n * 12 - n * 2) : 180 - n * 20 + n * 2;
		const clk = `0:0${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
		body += `${white ? `${n}. ` : ''}${san} { [%clk ${clk}] } `;
	});
	return `[Event "Rated Blitz game"]\n[TimeControl "180+2"]\n[Result "${result}"]\n[Termination "${termination}"]\n\n${body}${result}`;
};

test('liest Grundzeit, Inkrement, Restzeiten und Zeitverlust aus dem PGN', () => {
	const t = clockTrack(pgn('Time forfeit', '1-0'))!;
	expect(t.base).toBe(180);
	expect(t.inc).toBe(2);
	expect(t.clocks).toHaveLength(20);
	expect(t.clocks[0]).toBe(170);
	expect(t.flagged).toBe('black');
	expect(clockTrack(pgn('Normal', '1-0'))!.flagged).toBeNull();
	expect(clockTrack('1. e4 e5')).toBeNull();
});

test('Eröffnungstempo: Anteil der Grundzeit bis zum 10. Zug, ohne Inkrement', () => {
	const t = clockTrack(pgn('Normal', '*'))!;
	// Weiß nach Zug 10: 180 − 100 = 80 s Rest, + 20 s Inkrement herausgerechnet → 120 von 180 verbraucht
	expect(used10(t, 0)).toBeCloseTo(120 / 180);
	// Schwarz nach Zug 10: 180 − 180 = 0 → alles verbraucht
	expect(used10(t, 1)).toBe(1);
	expect(inTimeTrouble(t, 1)).toBe(false);
	// Schwarz hat vor dem 10. Zug genau 18 s = 10 % → noch keine Zeitnot; mit 17 s schon
	expect(inTimeTrouble(t, 19)).toBe(false);
	expect(inTimeTrouble({ ...t, clocks: t.clocks.map((c, i) => (i === 17 ? 17 : c)) }, 19)).toBe(
		true
	);
});

test('Uhr-Niveau: Blitz aus Penta und Tempo, Bullet aus dem Tempo, Rapid gar nicht', () => {
	expect(clockLevel('bullet', null, 0.1)).toBe(2025);
	expect(clockLevel('bullet', null, 0.4)).toBe(750);
	expect(clockLevel('bullet', null, null)).toBeNull();
	expect(clockLevel('blitz', 1500, 0.1)!).toBeGreaterThan(clockLevel('blitz', 1500, 0.3)!);
	expect(clockLevel('blitz', null, 0.1)).toBeNull();
	expect(clockLevel('rapid', 1500, 0.1)).toBeNull();
});

test('erst ab zehn Partien mit Uhr; Rat: Tempo vor Zeitverlusten', () => {
	const g = (used: number, flagged: boolean) => ({
		blunders: 1,
		clock: { moves: 30, tt: 3, ttLive: 2, ttBlunders: 0, used10: used, flagged } as GameClockStats
	});
	expect(poolClock(Array.from({ length: 9 }, () => g(0.1, false)))).toBeNull();
	const slow = poolClock(Array.from({ length: 10 }, () => g(0.3, true)))!;
	expect(slow).toMatchObject({ games: 10, analysed: 10, flagRate: 1, ttShare: 0.1 });
	expect(clockAdvice('blitz', slow)).toBe('tempo');
	const flag = poolClock(Array.from({ length: 10 }, (_, i) => g(0.1, i < 5)))!;
	expect(clockAdvice('blitz', flag)).toBe('flag');
	const fine = poolClock(Array.from({ length: 10 }, () => g(0.1, false)))!;
	expect(clockAdvice('blitz', fine)).toBe('fine');
});

test('Uhr ohne Analyse: Tempo, Zeitnot-Anteil und Zeitverlust aus dem PGN allein', () => {
	const black = gameClockStats({ pgn: pgn('Time forfeit', '1-0'), myColor: 'black' })!;
	expect(black).toMatchObject({ moves: 10, flagged: true, used10: 1, ttBlunders: 0 });
	const white = gameClockStats({ pgn: pgn('Time forfeit', '1-0'), myColor: 'white' })!;
	expect(white.flagged).toBe(false);
	expect(white.tt).toBe(0);
	expect(gameClockStats({ pgn: '1. e4 e5 *', myColor: 'white' })).toBeNull();
});
