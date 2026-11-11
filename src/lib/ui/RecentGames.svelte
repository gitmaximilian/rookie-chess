<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import LinkedAccounts from '#lib/ui/LinkedAccounts.svelte';
	import { db, type GameRow } from '#lib/db/db.js';
	import { quality } from '#lib/import/ratings.js';
	import { syncState } from '#lib/import/sync.svelte.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	let games = $state<GameRow[] | null>(null);

	async function load() {
		games = await db.games.orderBy('date').reverse().limit(3).toArray();
	}
	onMount(load);
	// nach einem Abruf die neuesten Partien zeigen
	$effect(() => {
		if (!syncState.running) void load();
	});

	function result(g: GameRow): 'win' | 'loss' | 'draw' | 'open' {
		if (g.result === '*') return 'open';
		if (g.result === '1/2-1/2') return 'draw';
		return (g.result === '1-0') === (g.myColor === 'white') ? 'win' : 'loss';
	}
</script>

<section class="mine card">
	<div class="head">
		<span class="ico"><ChartLine size={20} /></span>
		<h2>{t('analysis.title')}</h2>
		<a class="all" href={resolve('/analysis')}>{t('home.allGames')} <ArrowRight size={15} /></a>
	</div>

	<LinkedAccounts compact />

	{#if games === null}
		<div class="skeleton" style:height="120px"></div>
	{:else if games.length}
		<ul class="list">
			{#each games as g (g.id)}
				{@const q = quality(g)}
				{@const r = result(g)}
				<li>
					<a href={resolve(`/analysis?game=${g.id}`)}>
						<span class="res {r}">{t(`analysis.result.${r}`)}</span>
						<span class="txt">
							<b>{t('analysis.vs', { name: g.opponent })}</b>
							<span
								>{t(`analysis.source.${g.source}`)} · {new Date(g.date).toLocaleDateString(
									intlLocale(),
									{
										day: 'numeric',
										month: 'short'
									}
								)}{#if g.myRating}
									· {g.myRating}{/if}</span
							>
						</span>
						{#if q}
							<span class="q">
								<b class:hi={q.accuracy >= 80} class:lo={q.accuracy < 65}>{q.accuracy}%</b>
								{#if q.blunders}<span class="qb">{q.blunders}??</span>{/if}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="actions">
		<a class="btn" href={resolve('/analysis')}><ChartLine size={17} /> {t('home.allGames')}</a>
		<a class="btn secondary" href={resolve('/analysis/board')}
			><LayoutGrid size={17} /> {t('board2.open')}</a
		>
	</div>
</section>

<style>
	.mine {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.05rem 1.1rem;
		border: 1.5px solid color-mix(in srgb, var(--c-analysis) 35%, transparent);
	}

	.mine :global(.card) {
		box-shadow: none;
		border: 1px solid var(--line);
		padding: 0.75rem 0.85rem;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.head h2 {
		flex: 1;
		font-size: 1.2rem;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 11px;
		background: var(--c-analysis);
		color: #1a1206;
	}

	.all {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.88rem;
		font-weight: 650;
		color: var(--accent);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.list a {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.65rem;
		border-radius: 12px;
		background: var(--surface-2);
		color: var(--text);
	}

	.res {
		flex: none;
		width: 54px;
		text-align: center;
		padding: 0.2rem 0;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 750;
		background: var(--surface);
		color: var(--text-2);
	}

	.res.win {
		background: color-mix(in srgb, var(--good) 18%, transparent);
		color: var(--good);
	}

	.res.loss {
		background: color-mix(in srgb, var(--bad) 14%, transparent);
		color: var(--bad);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	.txt b {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.txt span {
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.q {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.q b {
		font-size: 0.95rem;
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
	}

	.q b.hi {
		color: var(--good);
	}

	.q b.lo {
		color: var(--bad);
	}

	.qb {
		color: var(--bad);
		font-weight: 700;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
