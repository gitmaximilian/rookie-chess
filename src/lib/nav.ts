import House from '@lucide/svelte/icons/house';
import ChessKnight from '@lucide/svelte/icons/chess-knight';
import Puzzle from '@lucide/svelte/icons/puzzle';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
import type { Component } from 'svelte';
import type { PageRouteId } from '$app/types';

export interface NavItem {
	href: PageRouteId;
	/** i18n-Schlüssel */
	label: string;
	icon: Component;
	/** CSS-Variable der Bereichsfarbe */
	color: string;
}

export const navItems: NavItem[] = [
	{ href: '/', label: 'nav.home', icon: House, color: 'var(--accent)' },
	{ href: '/play', label: 'nav.play', icon: ChessKnight, color: 'var(--c-play)' },
	{ href: '/puzzles', label: 'nav.puzzles', icon: Puzzle, color: 'var(--c-puzzle)' },
	{ href: '/learn', label: 'nav.learn', icon: GraduationCap, color: 'var(--c-learn)' },
	{ href: '/profile', label: 'nav.profile', icon: CircleUserRound, color: 'var(--c-analysis)' }
];

/** Ist `href` der aktive Bereich für `pathname`? */
export function isActive(href: string, pathname: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(href + '/');
}
