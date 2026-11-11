<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAchievementData } from '#lib/training/achievementData.js';
	import { ACHIEVEMENTS, type AchievementData } from '#lib/training/achievements.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let data = $state<AchievementData | null>(null);
	onMount(async () => (data = await loadAchievementData()));

	const list = $derived(
		data
			? ACHIEVEMENTS.map((a) => ({ ...a, p: a.progress(data!) })).sort(
					(x, y) => Number(y.p >= 1) - Number(x.p >= 1)
				)
			: []
	);
	const count = $derived(list.filter((a) => a.p >= 1).length);
</script>

<section class="card block">
	<div class="head">
		<h2>{t('achievements.title')}</h2>
		{#if data}<span>{t('achievements.count', { n: count, m: ACHIEVEMENTS.length })}</span>{/if}
	</div>
	{#if !data}
		<div class="skeleton" style:height="160px"></div>
	{:else}
		<ul class="grid">
			{#each list as a, i (a.id)}
				<li class:won={a.p >= 1} style:--i={i} title={t(`achievements.list.${a.id}.d`)}>
					<span class="badge">{a.icon}</span>
					<b>{t(`achievements.list.${a.id}.t`)}</b>
					<span class="desc">{t(`achievements.list.${a.id}.d`)}</span>
					{#if a.p < 1}
						<span class="bar"><span style:width="{Math.round(a.p * 100)}%"></span></span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.block {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.1rem 1.25rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.head h2 {
		font-size: 1.1rem;
	}

	.head span {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	li {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.25rem;
		padding: 0.8rem 0.6rem;
		border-radius: 14px;
		background: var(--surface-2);
		opacity: 0.75;
		animation: rise 360ms var(--ease-out) both;
		animation-delay: calc(min(var(--i), 12) * 25ms);
	}

	li.won {
		opacity: 1;
		background:
			radial-gradient(
				120% 90% at 50% 0%,
				color-mix(in srgb, var(--c-analysis) 18%, transparent),
				transparent 70%
			),
			var(--surface-2);
	}

	.badge {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		font-size: 1.45rem;
		background: var(--surface);
		filter: grayscale(1);
	}

	li.won .badge {
		filter: none;
		background: radial-gradient(circle at 30% 30%, #ffe08a, #f2b544);
		box-shadow: 0 4px 14px rgb(242 181 68 / 0.35);
	}

	b {
		font-size: 0.86rem;
		line-height: 1.2;
	}

	.desc {
		font-size: 0.74rem;
		color: var(--text-2);
		line-height: 1.3;
	}

	.bar {
		width: 80%;
		height: 4px;
		margin-top: 0.2rem;
		border-radius: 999px;
		background: var(--line-strong);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--c-analysis);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
