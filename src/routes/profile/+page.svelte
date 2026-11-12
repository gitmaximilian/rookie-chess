<script lang="ts">
	import BentoGrid from '#lib/ui/bento/BentoGrid.svelte';
	import StatTile, { type Tone } from '#lib/ui/bento/StatTile.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Info from '@lucide/svelte/icons/info';
	import Settings from '@lucide/svelte/icons/settings';
	import Scale from '@lucide/svelte/icons/scale';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import Flame from '@lucide/svelte/icons/flame';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Swords from '@lucide/svelte/icons/swords';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Star from '@lucide/svelte/icons/star';
	import Target from '@lucide/svelte/icons/target';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import StarsOverview from '#lib/ui/StarsOverview.svelte';
	import LinkedAccounts from '#lib/ui/LinkedAccounts.svelte';
	import RatingChart from '#lib/ui/RatingChart.svelte';
	import ActivityHeatmap from '#lib/ui/ActivityHeatmap.svelte';
	import { db, getSetting, type ActivityRow } from '#lib/db/db.js';
	import { getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { computeStreak } from '#lib/training/streak.js';
	import { themeStats, weakest, strongest, type ThemeStat } from '#lib/training/stats.js';
	import { themeName } from '#lib/data/themes.js';
	import { BOTS } from '#lib/bots/bots.js';
	import { LESSONS } from '#lib/endgames/lessons.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { currentStrength } from '#lib/training/planData.js';
	import Gauge from '@lucide/svelte/icons/gauge';
	import type { Rating } from '#lib/training/glicko2.js';

	let rating = $state<Rating | null>(null);
	let streak = $state(0);
	let solved = $state(0);
	let games = $state(0);
	let bots = $state(0);
	let stars = $state(0);
	let strength = $state<number | null>(null);
	let history = $state<{ date: number; rating: number }[]>([]);
	let activity = $state<ActivityRow[]>([]);
	let weak = $state<ThemeStat[]>([]);
	let strong = $state<ThemeStat[]>([]);

	onMount(async () => {
		rating = await getPuzzleRating();
		strength = (await currentStrength())?.value ?? null;
		activity = await db.activity.toArray();
		streak = computeStreak(activity).days;
		solved = await db.puzzleAttempts.filter((a) => a.solved).count();
		games = await db.games.count();
		bots = (await getSetting<string[]>('botsBeaten', [])).length;
		stars = (await db.endgames.toArray()).reduce((s, r) => s + r.stars, 0);
		const rows = await db.ratings.orderBy('date').toArray();
		history = rows.slice(-150).map((r) => ({ date: r.date, rating: r.rating }));
		const stats = themeStats(await db.puzzleAttempts.toArray());
		weak = weakest(stats);
		strong = strongest(stats).filter((s) => !weak.some((w) => w.theme === s.theme));
	});

	const tiles = $derived([
		{
			icon: Gauge,
			label: t('profile.strength'),
			value: strength ? `≈${strength}` : '–',
			tone: 'coach' as Tone
		},
		{
			icon: Puzzle,
			label: t('profile.puzzleRating'),
			value: rating ? `${Math.round(rating.rating)}${isProvisional(rating) ? '?' : ''}` : '–',
			tone: 'puzzle' as Tone,
			spark: history.slice(-40).map((h) => h.rating)
		},
		{ icon: Flame, label: t('profile.streak'), value: String(streak), tone: 'play' as Tone },
		{ icon: Target, label: t('profile.solved'), value: String(solved), tone: 'learn' as Tone },
		{ icon: Swords, label: t('profile.games'), value: String(games), tone: 'games' as Tone },
		{
			icon: Trophy,
			label: t('profile.bots'),
			value: `${bots}/${BOTS.length}`,
			tone: 'neutral' as Tone
		},
		{
			icon: Star,
			label: t('profile.endgames'),
			value: `${stars}/${LESSONS.length * 3}`,
			tone: 'stars' as Tone
		}
	]);
</script>

<svelte:head><title>{t('profile.title')} – Rookie</title></svelte:head>

<PageHeader
	eyebrow={t('profile.eyebrow')}
	title={t('profile.title')}
	subtitle={t('profile.subtitle')}
>
	{#snippet action()}
		<a
			class="gear"
			href={resolve('/settings')}
			aria-label={t('profile.settings')}
			title={t('profile.settings')}><Settings size={21} /></a
		>
	{/snippet}
</PageHeader>

<div class="wrap">
	<LinkedAccounts collapsed />

	<BentoGrid label={t('profile.title')} testid="profile-tiles">
		{#each tiles as tile (tile.label)}
			<StatTile
				tone={tile.tone}
				size={tile.spark && tile.spark.length > 1 ? 'm' : 's'}
				label={tile.label}
				value={tile.value}
				muted={tile.value === '–'}
				spark={tile.spark}
			/>
		{/each}
	</BentoGrid>

	<div class="duo">
		<section class="card block">
			<h2>{t('profile.ratingHistory')}</h2>
			{#if history.length > 1}
				<RatingChart points={history} />
			{:else}
				<p class="muted">{t('profile.noHistory')}</p>
			{/if}
		</section>

		<section class="card block">
			<h2>{t('profile.activity')}</h2>
			<ActivityHeatmap rows={activity} />
		</section>
	</div>

	<div class="duo">
		{#each [{ title: t('profile.weakest'), list: weak, cls: 'weak' }, { title: t('profile.strongest'), list: strong, cls: 'strong' }] as grp (grp.cls)}
			<section class="card block">
				<h2>{grp.title}</h2>
				{#if grp.list.length}
					<ul class="themes">
						{#each grp.list as s (s.theme)}
							<li>
								<div class="th-head">
									<b>{themeName(s.theme)}</b>
									<span>{t('profile.success', { pct: Math.round(s.rate * 100), n: s.n })}</span>
								</div>
								<div class="bar">
									<div class="fill {grp.cls}" style:width="{Math.max(4, s.rate * 100)}%"></div>
								</div>
								{#if grp.cls === 'weak'}
									<a class="train" href={resolve(`/puzzles?theme=${s.theme}`)}
										>{t('profile.train')} →</a
									>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">{t('profile.noThemes')}</p>
				{/if}
			</section>
		{/each}
	</div>

	<StarsOverview />

	<nav class="links">
		<a href={resolve('/analysis')} class="row card pressable">
			<span class="ico"><ChartLine size={20} /></span>
			<span class="txt">{t('profile.myGames')}</span>
			<ChevronRight size={18} />
		</a>
		<a href={resolve('/import')} class="row card pressable">
			<span class="ico"><CloudDownload size={20} /></span>
			<span class="txt">{t('profile.importGames')}</span>
			<ChevronRight size={18} />
		</a>
		<a href={resolve('/settings')} class="row card pressable">
			<span class="ico"><Settings size={20} /></span>
			<span class="txt">{t('profile.settings')}</span>
			<ChevronRight size={18} />
		</a>
		<a href={resolve('/about')} class="row card pressable">
			<span class="ico"><Info size={20} /></span>
			<span class="txt">{t('profile.about')}</span>
			<ChevronRight size={18} />
		</a>
		<a href={resolve('/privacy')} class="row card pressable">
			<span class="ico"><ShieldCheck size={20} /></span>
			<span class="txt">{t('account.privacy')}</span>
			<ChevronRight size={18} />
		</a>
		<a href="https://maximilianauer.at/legal/" rel="noopener" class="row card pressable">
			<span class="ico"><Scale size={20} /></span>
			<span class="txt">{t('profile.legal')}</span>
			<ChevronRight size={18} />
		</a>
	</nav>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 1040px;
	}

	.gear {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-1);
		color: var(--text-2);
	}

	/* Handy: drei kompakte Spalten; die siebte Kachel füllt die letzte Zeile */
	@media (max-width: 639px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.tile {
			padding: 0.7rem 0.75rem !important;
		}
		.t-icon {
			width: 26px !important;
			height: 26px !important;
			margin-bottom: 0.25rem !important;
		}
		.t-value {
			font-size: 1.25rem !important;
		}
		.t-label {
			font-size: 0.72rem !important;
		}
		.tile:last-child:nth-child(3n + 1) {
			grid-column: span 3;
		}
	}

	.duo {
		display: grid;
		gap: 0.75rem;
	}

	@media (min-width: 860px) {
		.duo {
			grid-template-columns: 1fr 1fr;
		}
	}

	.block {
		border-radius: var(--radius-tile);
		padding: 1.1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.block h2 {
		font-size: 1.1rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.themes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.th-head {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.92rem;
	}

	.th-head span {
		color: var(--text-2);
		font-size: 0.85rem;
	}

	.bar {
		height: 6px;
		margin-top: 0.35rem;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: inherit;
	}

	.fill.weak {
		background: var(--c-play);
	}

	.fill.strong {
		background: var(--c-learn);
	}

	.train {
		display: inline-block;
		margin-top: 0.3rem;
		font-size: 0.82rem;
		font-weight: 650;
		color: var(--accent);
	}

	.links {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		color: var(--text-2);
	}

	.ico {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 11px;
		background: var(--surface-2);
		color: var(--text);
	}

	.txt {
		flex: 1;
		color: var(--text);
		font-weight: 560;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
