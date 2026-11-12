import House from '@lucide/svelte/icons/house';
import ChessKnight from '@lucide/svelte/icons/chess-knight';
import Puzzle from '@lucide/svelte/icons/puzzle';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import Brain from '@lucide/svelte/icons/brain';
import ChartLine from '@lucide/svelte/icons/chart-line';
import type { Component } from 'svelte';
import type { PageRouteId } from '$app/types';

export interface NavItem {
	href: PageRouteId;
	/** i18n-Schlüssel */
	label: string;
	icon: Component;
	/** CSS-Variable der Bereichsfarbe */
	color: string;
	/** Pastellfläche des Bereichs (Bento-Tokens in app.css) */
	tone: 'play' | 'games' | 'coach' | 'puzzle' | 'learn';
}

export const navItems: NavItem[] = [
	{ href: '/', label: 'nav.home', icon: House, color: 'var(--accent)', tone: 'play' },
	{
		href: '/analysis',
		label: 'nav.games',
		icon: ChartLine,
		color: 'var(--c-analysis)',
		tone: 'games'
	},
	{ href: '/coach', label: 'nav.coach', icon: Brain, color: 'var(--c-coach)', tone: 'coach' },
	{ href: '/play', label: 'nav.play', icon: ChessKnight, color: 'var(--c-play)', tone: 'play' },
	{
		href: '/puzzles',
		label: 'nav.puzzles',
		icon: Puzzle,
		color: 'var(--c-puzzle)',
		tone: 'puzzle'
	},
	{
		href: '/learn',
		label: 'nav.learn',
		icon: GraduationCap,
		color: 'var(--c-learn)',
		tone: 'learn'
	}
];

/**
 * Ist `href` der aktive Bereich für `pathname`?
 * Profil, Einstellungen & Co. haben keinen eigenen Tab – sie hängen am Avatar oben rechts.
 */
export function isActive(href: string, pathname: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(href + '/');
}
