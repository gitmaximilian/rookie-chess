<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import LinkedAccounts from '#lib/ui/LinkedAccounts.svelte';
	import { db, type GameRow } from '#lib/db/db.js';
	import { syncState } from '#lib/import/sync.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import GameListItem from '#lib/ui/GameListItem.svelte';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';

	let games = $state<GameRow[] | null>(null);

	async function load() {
		games = await db.games.orderBy('date').reverse().limit(3).toArray();
	}
	onMount(load);
	// nach einem Abruf die neuesten Partien zeigen
	$effect(() => {
		if (!syncState.running) void load();
	});
</script>

<section class="mine card">
	<div class="head">
		<span class="ico"><ChartLine size={20} /></span>
		<h2>{t('analysis.title')}</h2>
		<a class="all" href={resolve('/analysis')}>{t('home.allGames')} <ArrowRight size={15} /></a>
	</div>

	{#if games === null}
		<div class="skeleton" style:height="140px"></div>
	{:else if games.length}
		<ul class="list">
			{#each games as g (g.id)}
				<li><GameListItem game={g} flat /></li>
			{/each}
		</ul>
		<LinkedAccounts compact ctaOnly collapsed />
	{:else}
		<LinkedAccounts compact ctaOnly />
	{/if}

	<div class="actions">
		{#if games && !games.length}
			<a class="btn" href={resolve('/play')}><ChessKnight size={17} /> {t('analysis.playGame')}</a>
		{/if}
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
