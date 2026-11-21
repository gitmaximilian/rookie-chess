<script lang="ts">
	import { resolve } from '$app/paths';
	import Timer from '@lucide/svelte/icons/timer';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import {
		CLOCK_LEVEL_MAE,
		CLOCK_MIN_GAMES,
		TYPICAL_1600,
		clockAdvice,
		type ClockSummary
	} from '#lib/training/clock.js';
	import type { PentaSpeed } from '#lib/import/ratings.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { eloFor } from '#lib/training/platforms.js';

	interface Props {
		speed: PentaSpeed;
		summary: ClockSummary | null;
		/** Partien dieses Tempos mit Zeitangaben (für den Hinweis, solange es zu wenige sind) */
		withClock: number;
		/** Elo-Entsprechung mit Uhr (Blitz, Bullet) */
		level: number | null;
		chesscom?: boolean;
	}
	let { speed, summary, withClock, level, chesscom = false }: Props = $props();

	/** Balken bis 50 % der Bedenkzeit – darüber ist alles „sehr langsam“ */
	const SCALE = 0.5;
	const pct = (x: number) => Math.round(x * 100);
	const pos = (x: number) => `${Math.min(100, (x / SCALE) * 100)}%`;
	const typical = $derived(TYPICAL_1600[speed]);
	const advice = $derived(summary ? clockAdvice(speed, summary) : null);
</script>

<section class="card clock" data-testid="clock-card">
	<span class="mono-label"><Timer size={14} /> {t('clock.title')}</span>
	{#if !summary}
		<p class="muted" data-testid="clock-need">
			{t('clock.need', { n: withClock, m: CLOCK_MIN_GAMES })}
		</p>
	{:else}
		{#if summary.used10 !== null}
			<div class="head">
				<b class="num" data-testid="clock-tempo">{pct(summary.used10)} %</b>
				<span>{t('clock.tempo')}</span>
			</div>
			<div class="bar" aria-hidden="true">
				<span class="fill" class:slow={advice === 'tempo'} style:width={pos(summary.used10)}></span>
				<span class="tick" style:left={pos(typical.used10)}></span>
			</div>
			<span class="muted">{t('clock.typical', { pct: pct(typical.used10) })}</span>
		{/if}
		<ul class="facts">
			{#if level !== null}
				<li data-testid="clock-level">
					{t('clock.level', { elo: eloFor(level, chesscom), mae: CLOCK_LEVEL_MAE[speed] ?? 0 })}
				</li>
			{/if}
			<li>{t('clock.flags', { pct: pct(summary.flagRate) })}</li>
			{#if summary.analysed > 0}
				<li>{t('clock.ttBlunders', { n: summary.ttBlunders, m: summary.blunders })}</li>
			{/if}
		</ul>
		<p class="next" data-testid="clock-advice">{t(`clock.advice.${advice}`)}</p>
		{#if advice === 'tempo'}
			<a class="btn secondary" href={resolve('/learn/openings')}
				>{t('clock.cta.tempo')} <ArrowRight size={16} /></a
			>
		{/if}
		<details>
			<summary>{t('clock.why')} <ChevronDown size={14} /></summary>
			<p class="muted">{t('clock.whyText')}</p>
		</details>
	{/if}
</section>

<style>
	.clock {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 1.15rem;
		border-radius: var(--radius-tile);
	}

	.mono-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.head b {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-variant-numeric: tabular-nums;
	}

	.bar {
		position: relative;
		height: 10px;
		border-radius: 999px;
		background: var(--surface-2);
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		background: var(--accent);
	}

	.fill.slow {
		background: var(--warn);
	}

	.tick {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		margin-left: -1px;
		background: var(--text);
	}

	.muted {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.facts {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}

	.next {
		font-size: 0.92rem;
	}

	.btn {
		align-self: flex-start;
	}

	details summary {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--text-2);
		list-style: none;
	}

	details summary::-webkit-details-marker {
		display: none;
	}

	details[open] summary :global(svg) {
		transform: rotate(180deg);
	}
</style>
