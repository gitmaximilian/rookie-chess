<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
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

<section class="mine tone-games">
	<div class="head">
		<span class="ico"><ChartLine size={20} /></span>
		<h2>{t('analysis.title')}</h2>
		<a class="all hit44" href={resolve('/analysis')}
			>{t('home.allGames')} <ArrowRight size={15} /></a
		>
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

	<!-- Analysebrett gibt es unter „Partien“ und im Partienkopf – hier nur der Weg zur ersten Partie -->
	{#if games && !games.length}
		<div class="actions">
			<a class="btn" href={resolve('/play')}><ChessKnight size={17} /> {t('analysis.playGame')}</a>
		</div>
	{/if}
</section>

<style>
	.mine {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.15rem;
		border-radius: var(--radius-tile);
	}

	.mine :global(.gli.flat) {
		background: color-mix(in srgb, var(--surface) 72%, transparent);
	}

	.mine :global(.card) {
		box-shadow: none;
		border: none;
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		border-radius: 18px;
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
		background: var(--tone-ink);
		color: var(--tone-bg);
	}

	.all {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.88rem;
		font-weight: 650;
		color: var(--tone-ink);
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
