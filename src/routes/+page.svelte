<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageRouteId } from '$app/types';
	import Flame from '@lucide/svelte/icons/flame';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import HeroBoard from '#lib/ui/HeroBoard.svelte';
	import GoalRing from '#lib/ui/GoalRing.svelte';

	let greeting = $state('Hallo');

	onMount(() => {
		const h = new Date().getHours();
		greeting = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
	});

	const modes: {
		href: PageRouteId;
		title: string;
		text: string;
		icon: typeof Puzzle;
		c: string;
		soft: string;
	}[] = [
		{
			href: '/play',
			title: 'Spielen',
			text: 'Acht Bots von „Bauer Bruno“ bis „Dame Doris“',
			icon: ChessKnight,
			c: 'var(--c-play)',
			soft: 'var(--c-play-soft)'
		},
		{
			href: '/puzzles',
			title: 'Puzzles',
			text: 'Taktik trainieren, Rating aufbauen',
			icon: Puzzle,
			c: 'var(--c-puzzle)',
			soft: 'var(--c-puzzle-soft)'
		},
		{
			href: '/learn',
			title: 'Lernen',
			text: 'Eröffnungen und Endspiele Schritt für Schritt',
			icon: GraduationCap,
			c: 'var(--c-learn)',
			soft: 'var(--c-learn-soft)'
		},
		{
			href: '/profile',
			title: 'Fortschritt',
			text: 'Statistik, Partien und Schwächen',
			icon: ChartLine,
			c: 'var(--c-analysis)',
			soft: 'var(--c-analysis-soft)'
		}
	];
</script>

<svelte:head>
	<title>Zugzwang – Schach-Trainer</title>
</svelte:head>

<div class="home">
	<header class="top">
		<div>
			<span class="eyebrow">Dein Training</span>
			<h1>{greeting}!</h1>
		</div>
		<span class="streak" title="Trainingsserie">
			<Flame size={18} strokeWidth={2.4} />
			<b>0</b>
			<span class="sr-only">Tage in Folge</span>
		</span>
	</header>

	<section class="hero card">
		<div class="hero-text">
			<span class="eyebrow on-dark">Puzzle des Tages</span>
			<h2>Weiß zieht – finde das Matt in 1</h2>
			<p>Jeden Tag ein neues Rätsel, passend zu deinem Niveau.</p>
			<a href={resolve('/puzzles')} class="btn hero-btn">
				Loslegen <ArrowRight size={18} strokeWidth={2.4} />
			</a>
		</div>
		<div class="hero-board">
			<HeroBoard />
		</div>
	</section>

	<section class="goal card">
		<GoalRing value={0} max={5} />
		<div>
			<h3>Tagesziel</h3>
			<p>Löse heute 5 Puzzles, um deine Serie zu starten.</p>
		</div>
	</section>

	<h2 class="section-title">Was möchtest du trainieren?</h2>
	<div class="modes">
		{#each modes as m, i (m.href)}
			<a
				href={resolve(m.href)}
				class="mode card pressable"
				style:--c={m.c}
				style:--c-soft={m.soft}
				style:--i={i}
			>
				<span class="mode-icon"><m.icon size={24} strokeWidth={2.1} /></span>
				<span class="mode-title">{m.title}</span>
				<span class="mode-text">{m.text}</span>
				<span class="mode-arrow"><ArrowRight size={18} /></span>
			</a>
		{/each}
	</div>
</div>

<style>
	.home {
		max-width: 1040px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin: 0.25rem 0 0.5rem;
	}

	h1 {
		font-size: clamp(2.1rem, 7vw, 3rem);
	}

	.streak {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 38px;
		padding: 0 0.85rem;
		border-radius: 999px;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--accent);
		font-family: var(--font-display);
		font-size: 1.05rem;
		box-shadow: var(--shadow-1);
	}

	/* Hero: dunkle Bühne, warmer Schein – auch im Hellmodus */
	.hero {
		position: relative;
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		padding: 1.5rem;
		overflow: hidden;
		border: none;
		color: #f7f1ea;
		background:
			radial-gradient(120% 90% at 100% 0%, rgb(242 122 82 / 0.55), transparent 60%),
			radial-gradient(80% 80% at 0% 100%, rgb(109 91 240 / 0.35), transparent 60%), #1d1916;
		box-shadow: var(--shadow-2);
	}

	.hero-text {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: flex-start;
		position: relative;
		z-index: 1;
	}

	.on-dark {
		color: rgb(247 241 234 / 0.65);
	}

	.hero h2 {
		font-size: clamp(1.6rem, 5.5vw, 2.2rem);
	}

	.hero p {
		color: rgb(247 241 234 / 0.75);
		max-width: 32ch;
	}

	.hero-btn {
		margin-top: 0.5rem;
		background: #fff;
		color: #1d1916;
	}

	.hero-board {
		width: min(64%, 230px);
		justify-self: end;
		margin: 0 -0.25rem -0.25rem 0;
	}

	@media (min-width: 640px) {
		.hero {
			grid-template-columns: 1.2fr 1fr;
			align-items: center;
			padding: 2.25rem;
		}
		.hero-board {
			width: min(100%, 300px);
			margin: 0;
		}
	}

	.goal {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
	}

	.goal h3 {
		font-size: 1.1rem;
		margin-bottom: 0.15rem;
	}

	.goal p {
		color: var(--text-2);
		font-size: 0.95rem;
	}

	.section-title {
		font-size: 1.3rem;
		margin: 1rem 0 0.25rem;
	}

	.modes {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 1024px) {
		.modes {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.mode {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1.1rem;
		min-height: 168px;
		overflow: hidden;
		animation: rise 520ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 60ms + 120ms);
	}

	.mode::after {
		content: '';
		position: absolute;
		width: 140px;
		height: 140px;
		right: -50px;
		bottom: -60px;
		border-radius: 50%;
		background: var(--c-soft);
		transition: transform 600ms var(--ease-out);
	}

	@media (hover: hover) {
		.mode:hover::after {
			transform: scale(1.35);
		}
		.mode:hover .mode-arrow {
			transform: translateX(3px);
			opacity: 1;
		}
	}

	.mode-icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: var(--c);
		color: #fff;
		margin-bottom: 0.6rem;
		box-shadow: 0 6px 16px color-mix(in srgb, var(--c) 35%, transparent);
	}

	.mode-title {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 680;
		letter-spacing: -0.02em;
		position: relative;
		z-index: 1;
	}

	.mode-text {
		font-size: 0.88rem;
		color: var(--text-2);
		line-height: 1.35;
		position: relative;
		z-index: 1;
	}

	.mode-arrow {
		position: absolute;
		top: 1.1rem;
		right: 1.1rem;
		color: var(--c);
		opacity: 0.6;
		transition:
			transform var(--dur) var(--ease-out),
			opacity var(--dur) var(--ease-out);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
</style>
