<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageRouteId } from '$app/types';
	import type { Component } from 'svelte';
	import Flame from '@lucide/svelte/icons/flame';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Repeat from '@lucide/svelte/icons/repeat';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Play from '@lucide/svelte/icons/play';
	import Check from '@lucide/svelte/icons/check';
	import HeroBoard from '#lib/ui/HeroBoard.svelte';
	import GoalRing from '#lib/ui/GoalRing.svelte';
	import DailyPlan from '#lib/ui/DailyPlan.svelte';
	import RecentGames from '#lib/ui/RecentGames.svelte';
	import Board from '#lib/ui/board/Board.svelte';
	import BotAvatar from '#lib/ui/BotAvatar.svelte';
	import { db, getSetting, today } from '#lib/db/db.js';
	import { computeStreak } from '#lib/training/streak.js';
	import { countDue } from '#lib/training/srs.js';
	import { dailyPuzzle, PuzzleRun } from '#lib/training/puzzles.js';
	import { themeName, THEMES } from '#lib/data/themes.js';
	import { botById } from '#lib/bots/bots.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { colorName } from '#lib/chess/labels.js';

	const dailyHref = resolve('/puzzles?mode=daily');
	const reviewHref = resolve('/puzzles?mode=review');

	let greeting = $state('hello');
	let streak = $state(0);
	let todayDone = $state(false);
	let solvedToday = $state(0);
	let goal = $state(5);
	let due = $state(0);
	let backupDue = $state(false);
	let resume = $state<{ botId: string; moves: string[] } | null>(null);
	let daily = $state<{
		fen: string;
		color: 'white' | 'black';
		theme: string;
		done: boolean;
	} | null>(null);

	onMount(async () => {
		const h = new Date().getHours();
		greeting = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'hello' : 'evening';

		const rows = await db.activity.toArray();
		const s = computeStreak(rows);
		streak = s.days;
		todayDone = s.todayDone;
		solvedToday = (await db.activity.get(today()))?.puzzles ?? 0;
		goal = await getSetting('dailyGoal', 5);
		due = await countDue();
		resume = await getSetting('currentGame', null);

		const last = await getSetting<number | null>('lastBackupAt', null);
		const hasData = rows.length > 2;
		backupDue = hasData && (!last || Date.now() - last > 14 * 86400000);

		try {
			const p = await dailyPuzzle(today());
			const run = new PuzzleRun(p);
			run.playIntro();
			const tk = p.themes.find((x) => THEMES.find((th) => th.key === x)?.core) ?? p.themes[0];
			daily = {
				fen: run.game.fen,
				color: run.playerColor,
				theme: tk ?? '',
				done: (await getSetting<string>('dailyDone', '')) === today()
			};
		} catch {
			daily = null;
		}
	});

	const modes: {
		href: PageRouteId;
		title: string;
		text: string;
		icon: Component;
		c: string;
		soft: string;
	}[] = [
		{
			href: '/play',
			title: 'nav.play',
			text: 'home.modes.play',
			icon: ChessKnight,
			c: 'var(--c-play)',
			soft: 'var(--c-play-soft)'
		},
		{
			href: '/puzzles',
			title: 'nav.puzzles',
			text: 'home.modes.puzzles',
			icon: Puzzle,
			c: 'var(--c-puzzle)',
			soft: 'var(--c-puzzle-soft)'
		},
		{
			href: '/learn',
			title: 'nav.learn',
			text: 'home.modes.learn',
			icon: GraduationCap,
			c: 'var(--c-learn)',
			soft: 'var(--c-learn-soft)'
		},
		{
			href: '/profile',
			title: 'home.modes.progress',
			text: 'home.modes.progressText',
			icon: ChartLine,
			c: 'var(--c-analysis)',
			soft: 'var(--c-analysis-soft)'
		}
	];
</script>

<svelte:head>
	<title>{t('meta.title')}</title>
</svelte:head>

<div class="home">
	<header class="top">
		<div>
			<span class="eyebrow">{t('home.eyebrow')}</span>
			<h1>{t(`home.${greeting}`)}!</h1>
		</div>
		<span class="streak" class:lit={todayDone} title={t('home.streak')}>
			<Flame size={18} strokeWidth={2.4} />
			<b>{streak}</b>
			<span class="sr-only">{t('home.streak')}</span>
		</span>
	</header>

	{#if backupDue}
		<a class="banner card" href={resolve('/settings')}>
			<ShieldAlert size={20} />
			<span><b>{t('home.backup')}</b> {t('home.backupText')}</span>
			<ArrowRight size={18} />
		</a>
	{/if}

	{#if resume}
		<a class="resume card pressable" href={resolve('/play')}>
			<BotAvatar bot={botById(resume.botId)} size={44} />
			<span class="resume-text">
				<b>{t('home.resume')}</b>
				<span
					>{t('home.resumeVs', {
						bot: botById(resume.botId).name,
						n: Math.floor(resume.moves.length / 2) + 1
					})}</span
				>
			</span>
			<span class="resume-go"><Play size={18} /></span>
		</a>
	{/if}

	<RecentGames />

	<DailyPlan />

	<section class="hero card">
		<div class="hero-text">
			<span class="eyebrow on-dark">{t('home.daily')}</span>
			{#if daily?.done}
				<h2>{t('home.done')} <Check size={28} strokeWidth={3} /></h2>
				<p>{t('home.doneText')}</p>
				<a href={resolve('/puzzles')} class="btn hero-btn"
					>{t('home.morePuzzles')} <ArrowRight size={18} strokeWidth={2.4} /></a
				>
			{:else}
				<h2>
					{t('home.toMove', {
						side: daily ? colorName(daily.color) : t('common.you'),
						theme: daily?.theme ? themeName(daily.theme) : t('home.findBest')
					})}
				</h2>
				<p>{t('home.dailyText')}</p>
				<a href={dailyHref} class="btn hero-btn">
					{t('home.solve')}
					<ArrowRight size={18} strokeWidth={2.4} />
				</a>
			{/if}
		</div>
		<div class="hero-board">
			{#if daily}
				<div class="real-board">
					<Board
						fen={daily.fen}
						orientation={daily.color}
						viewOnly
						coordinates={false}
						label={t('home.daily')}
					/>
				</div>
			{:else}
				<HeroBoard />
			{/if}
		</div>
	</section>

	<div class="duo">
		<section class="goal card">
			<GoalRing value={Math.min(solvedToday, goal)} max={goal} />
			<div>
				<h3>{t('home.goal')}</h3>
				<p>
					{#if solvedToday >= goal}
						{t('home.goalDone', { n: solvedToday })}
					{:else}
						{t('home.goalLeft', { n: goal - solvedToday })}
					{/if}
				</p>
			</div>
		</section>

		<a class="due card pressable" href={reviewHref} class:none={due === 0}>
			<span class="due-ico"><Repeat size={22} /></span>
			<div>
				<h3>{t('home.reviews', { n: due })}</h3>
				<p>
					{t('home.reviewsText', { n: due })}
				</p>
			</div>
		</a>
	</div>

	<h2 class="section-title">{t('home.train')}</h2>
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
				<span class="mode-title">{t(m.title)}</span>
				<span class="mode-text">{t(m.text)}</span>
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
		color: var(--text-3);
		font-family: var(--font-display);
		font-size: 1.05rem;
		box-shadow: var(--shadow-1);
	}

	.streak.lit {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 30%, transparent);
		background: var(--accent-soft);
	}

	.streak.lit :global(svg) {
		animation: flicker 2.4s ease-in-out infinite;
	}

	@keyframes flicker {
		50% {
			transform: scale(1.12) rotate(-4deg);
		}
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
		background: color-mix(in srgb, var(--warn) 12%, var(--surface));
		font-size: 0.92rem;
	}

	.banner span {
		flex: 1;
	}

	.resume {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.8rem 1rem;
	}

	.resume-text {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.resume-text span {
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.resume-go {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
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
		display: flex;
		align-items: center;
		gap: 0.4rem;
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

	.real-board {
		transform: perspective(900px) rotateX(8deg) rotateZ(-3deg);
		animation: float 6s ease-in-out infinite;
		border-radius: 14px;
		box-shadow: 0 20px 50px rgb(0 0 0 / 0.45);
	}

	@keyframes float {
		50% {
			transform: perspective(900px) rotateX(6deg) rotateZ(-1.5deg) translateY(-6px);
		}
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

	.duo {
		display: grid;
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.duo {
			grid-template-columns: 1fr 1fr;
		}
	}

	.goal,
	.due {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
	}

	.goal h3,
	.due h3 {
		font-size: 1.1rem;
		margin-bottom: 0.15rem;
	}

	.goal p,
	.due p {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.due-ico {
		display: grid;
		place-items: center;
		flex: none;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--c-puzzle-soft);
		color: var(--c-puzzle);
	}

	.due.none .due-ico {
		background: color-mix(in srgb, var(--good) 14%, transparent);
		color: var(--good);
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
