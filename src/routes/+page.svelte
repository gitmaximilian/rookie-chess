<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Flame from '@lucide/svelte/icons/flame';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Play from '@lucide/svelte/icons/play';
	import DailyPlan from '#lib/ui/DailyPlan.svelte';
	import RecentGames from '#lib/ui/RecentGames.svelte';
	import HomeSummary from '#lib/ui/HomeSummary.svelte';
	import BotAvatar from '#lib/ui/BotAvatar.svelte';
	import { db, getSetting } from '#lib/db/db.js';
	import { computeStreak } from '#lib/training/streak.js';
	import { botById } from '#lib/bots/bots.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let greeting = $state('hello');
	let streak = $state(0);
	let todayDone = $state(false);
	let backupDue = $state(false);
	let resume = $state<{ botId: string; moves: string[] } | null>(null);

	onMount(async () => {
		const h = new Date().getHours();
		greeting = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'hello' : 'evening';

		const rows = await db.activity.toArray();
		const s = computeStreak(rows);
		streak = s.days;
		todayDone = s.todayDone;
		resume = await getSetting('currentGame', null);

		const last = await getSetting<number | null>('lastBackupAt', null);
		const hasData = rows.length > 2;
		backupDue = hasData && (!last || Date.now() - last > 14 * 86400000);
	});
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

	<HomeSummary />

	<RecentGames />

	<DailyPlan />
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
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
</style>
