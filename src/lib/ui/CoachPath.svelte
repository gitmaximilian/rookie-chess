<script lang="ts">
	/**
	 * Herzstück der Startseite: der Weg zu 1600 als Treppe der Etappen (800 → 1600).
	 * Du stehst auf deiner Stufe; darunter sagt der Coach in einem Satz, was diese Woche zählt.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { loadCoachWeek, type CoachWeek } from '#lib/training/planData.js';
	import { MILESTONES, GOAL } from '#lib/training/strength.js';
	import { syncState } from '#lib/import/sync.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let w = $state<CoachWeek | null>(null);
	let loaded = $state(false);

	async function load() {
		try {
			w = await loadCoachWeek();
		} catch {
			w = null;
		}
		loaded = true;
	}
	onMount(load);
	$effect(() => {
		if (!syncState.running) void load();
	});

	const p = $derived(w?.path ?? null);
	/** Füllstand je Stufe: ganz erreicht 1, angefangen 0..1, sonst 0 */
	const steps = $derived(
		MILESTONES.map((m, i) => {
			const from = i ? MILESTONES[i - 1] : m - 200;
			const fill = !p ? 0 : p.strength >= m ? 1 : Math.max(0, (p.strength - from) / (m - from));
			return { m, fill, current: !!p && !p.reached && p.goal === m };
		})
	);
	const left = $derived(p ? Math.max(0, GOAL - p.strength) : null);

	/** ein Satz vom Coach: das Wochenurteil, sonst die Wochendosis */
	const say = $derived.by(() => {
		if (!w) return '';
		const a = w.adjustment;
		if (a.kind === 'play-more') return t('coachWeek.adj.play-more', { n: a.played });
		if (a.kind === 'on-track') return t('coachWeek.adj.on-track', { n: a.gain });
		if (a.kind !== 'none') return t(`coachWeek.adj.${a.kind}`);
		return t('coachPath.week', {
			done: w.progress.games.done,
			n: w.progress.games.target,
			days: w.daysLeft
		});
	});
</script>

<section class="coach-path tone-coach" data-testid="tile-strength" aria-busy={!loaded}>
	{#if !loaded}
		<div class="sk"></div>
	{:else if !p}
		<div class="empty">
			<span class="mono-label lbl">{t('coachPath.title')}</span>
			<p class="big-line">{t('summary.rapidNoData')}</p>
			<p class="say">{t('coachPath.noData')}</p>
			<a class="btn small" href={resolve('/import')}
				>{t('coachPath.import')} <ArrowRight size={15} /></a
			>
		</div>
	{:else}
		<div class="top">
			<div>
				<span class="mono-label lbl">{t('summary.rapidGoal')}</span>
				<span class="val num">{p.strength}</span>
			</div>
			<div class="goal">
				{#if p.reached}
					<b>1600 ✓</b>
				{:else}
					<b class="num">{t('coachPath.left', { n: left ?? 0 })}</b>
					<span>{t('coachPath.stage', { goal: p.goal })}</span>
				{/if}
			</div>
		</div>

		<!-- Treppe: jede Stufe eine Etappe, höher = stärker; gefüllt bis zu deiner Stärke -->
		<ol class="stairs" aria-label={t('coachPath.title')}>
			{#each steps as s, i (s.m)}
				<li class:current={s.current} class:done={s.fill >= 1} style:--h="{18 + i * 9}px">
					<span class="step" aria-hidden="true"><i style:height="{s.fill * 100}%"></i></span>
					<span class="m num">{s.m}</span>
				</li>
			{/each}
		</ol>

		{#if say}<p class="say" data-testid="coach-say">{say}</p>{/if}
	{/if}
</section>

<style>
	.coach-path {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: var(--tile-pad);
		border-radius: var(--radius-tile);
		color: var(--tile-text);
		background: var(--tone-bg);
	}

	.sk {
		height: 170px;
	}

	.lbl {
		color: var(--tone-ink);
	}

	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.top > div:first-child {
		display: flex;
		flex-direction: column;
	}

	.val {
		font-size: clamp(2.2rem, 10vw, 3rem);
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.goal {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		font-size: 0.85rem;
		color: var(--tile-text-2);
	}

	.goal b {
		font-size: 1.05rem;
		color: var(--tone-ink);
	}

	.stairs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		align-items: end;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.stairs li {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.step {
		position: relative;
		display: flex;
		align-items: flex-end;
		height: var(--h);
		border-radius: 8px;
		background: color-mix(in srgb, var(--tone-ink) 14%, transparent);
		overflow: hidden;
	}

	.step i {
		display: block;
		width: 100%;
		background: var(--tone-ink);
		box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
		transition: height 700ms var(--ease-out);
	}

	/* deine aktuelle Stufe: umrandet, damit man sieht, wo man steht */
	.current .step {
		outline: 2px solid var(--tone-ink);
		outline-offset: 2px;
	}

	.m {
		font-size: 0.78rem;
		font-weight: 600;
		text-align: center;
		color: var(--tile-text-2);
	}

	.current .m,
	.done .m {
		color: var(--tone-ink);
	}

	.say {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.4;
		color: var(--tile-text);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
	}

	.big-line {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 650;
	}

	@media (prefers-reduced-motion: reduce) {
		.step i {
			transition: none;
		}
	}
</style>
