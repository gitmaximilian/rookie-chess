<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Star from '@lucide/svelte/icons/star';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { loadStars, totalStars, type AreaStars, type StarArea } from '#lib/training/stars.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let areas = $state<AreaStars[] | null>(null);
	onMount(async () => (areas = await loadStars()));

	const total = $derived(areas ? totalStars(areas) : null);

	const META: Record<StarArea, { href: string; c: string; how: string }> = {
		basics: { href: resolve('/learn/basics'), c: 'var(--c-puzzle)', how: 'stars.howBasics' },
		tactics: {
			href: resolve('/learn/basics?set=tactics'),
			c: 'var(--c-play)',
			how: 'stars.howTactics'
		},
		openings: { href: resolve('/learn/openings'), c: 'var(--c-learn)', how: 'stars.howOpenings' },
		endgames: { href: resolve('/learn'), c: 'var(--c-analysis)', how: 'stars.howEndgames' }
	};
</script>

<section class="stars tone-stars" aria-busy={!areas}>
	<div class="head">
		<div>
			<h2>{t('stars.title')}</h2>
			<p class="muted">{t('stars.text')}</p>
		</div>
		{#if total}
			<span class="big" aria-label={t('stars.total', { n: total.earned, m: total.max })}>
				<Star size={22} fill="currentColor" />
				<b>{total.earned}</b><small>/{total.max}</small>
			</span>
		{/if}
	</div>

	{#if !areas}
		<div class="skeleton" style:height="200px"></div>
	{:else}
		{#if total && total.earned === total.max}<p class="all">{t('stars.all')}</p>{/if}
		<ul>
			{#each areas as a (a.area)}
				{@const m = META[a.area]}
				<li>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- META enthält bereits resolve()-Pfade -->
					<a href={m.href} style:--c={m.c} title={t(m.how)}>
						<span class="row">
							<b>{t(`stars.area.${a.area}`)}</b>
							<span class="n"><Star size={13} fill="currentColor" /> {a.earned}/{a.max}</span>
						</span>
						<span class="bar"
							><span style:width="{(a.earned / Math.max(1, a.max)) * 100}%"></span></span
						>
						<span class="how">{t(m.how)}</span>
					</a>
					<ChevronRight size={16} class="chev" />
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.stars {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.15rem;
		border-radius: var(--radius-tile);
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		font-size: 1.15rem;
	}

	.muted {
		font-size: 0.86rem;
		color: var(--text-2);
		margin-top: 0.2rem;
	}

	.big {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 65%, transparent);
		color: var(--tone-ink);
	}

	.big b {
		font-family: var(--font-num);
		font-size: 1.3rem;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.big small {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.all {
		font-weight: 700;
		color: var(--tone-ink);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
	}

	@media (min-width: 700px) {
		ul {
			grid-template-columns: 1fr 1fr;
		}
	}

	li {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.6rem 0.2rem 0.85rem;
		border-radius: 18px;
		background: color-mix(in srgb, var(--surface) 65%, transparent);
	}

	li a {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.55rem 0.4rem 0.55rem 0.1rem;
		color: var(--text);
	}

	li :global(.chev) {
		flex: none;
		color: var(--text-3);
		pointer-events: none;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.95rem;
	}

	.n {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-num);
		font-weight: 500;
		font-size: 0.88rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-2);
	}

	.n :global(svg) {
		color: var(--tone-ink);
	}

	.bar {
		height: 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--tone-ink) 15%, transparent);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--c);
	}

	.how {
		font-size: 0.76rem;
		color: var(--text-3);
	}
</style>
