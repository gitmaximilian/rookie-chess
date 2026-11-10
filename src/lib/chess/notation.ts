import type { Role } from 'chessops/types';

const FIG: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };

/** SAN mit Figurensymbolen: Nf3 → ♘f3 (sprachunabhängig, gut lesbar) */
export function figurine(san: string): string {
	return san.replace(/^[KQRBN]/, (c) => FIG[c]).replace(/=([QRBN])/, (_m, c) => '=' + FIG[c]);
}

export const ROLE_DE: Record<Role, string> = {
	pawn: 'Bauer',
	knight: 'Springer',
	bishop: 'Läufer',
	rook: 'Turm',
	queen: 'Dame',
	king: 'König'
};

/** Akkusativ mit Artikel: „den Springer“, „die Dame“ */
export function roleAcc(role: Role): string {
	return (role === 'queen' ? 'die ' : 'den ') + ROLE_DE[role];
}

/** Nominativ mit Artikel: „der Springer“, „die Dame“ */
export function roleNom(role: Role): string {
	return (role === 'queen' ? 'die ' : 'der ') + ROLE_DE[role];
}

/** Possessiv: „dein Springer“, „deine Dame“ */
export function rolePoss(role: Role): string {
	return (role === 'queen' ? 'deine ' : 'dein ') + ROLE_DE[role];
}

export const VALUE: Record<Role, number> = {
	pawn: 1,
	knight: 3,
	bishop: 3,
	rook: 5,
	queen: 9,
	king: 100
};
