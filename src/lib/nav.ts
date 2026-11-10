import House from '@lucide/svelte/icons/house';
import ChessKnight from '@lucide/svelte/icons/chess-knight';
import Puzzle from '@lucide/svelte/icons/puzzle';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
import type { Component } from 'svelte';
import type { PageRouteId } from '$app/types';

export interface NavItem {
	href: PageRouteId;
	label: string;
	icon: Component;
	/** CSS-Variable der Bereichsfarbe */
	color: string;
}

export const navItems: NavItem[] = [
	{ href: '/', label: 'Start', icon: House, color: 'var(--accent)' },
	{ href: '/spielen', label: 'Spielen', icon: ChessKnight, color: 'var(--c-play)' },
	{ href: '/puzzles', label: 'Puzzles', icon: Puzzle, color: 'var(--c-puzzle)' },
	{ href: '/lernen', label: 'Lernen', icon: GraduationCap, color: 'var(--c-learn)' },
	{ href: '/profil', label: 'Profil', icon: CircleUserRound, color: 'var(--c-analysis)' }
];

/** Ist `href` der aktive Bereich für `pathname`? */
export function isActive(href: string, pathname: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(href + '/');
}
