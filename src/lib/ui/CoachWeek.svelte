<script lang="ts">
	/**
	 * Die Verordnung des Coachs (lib/training/prescription.ts): Wochendosis mit Fortschritt, ein Urteil mit
	 * nächstem Schritt und der Weg zu 1600. Erklärung und Zeitbudget hinter „Warum diese Dosis?“.
	 */
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import type { Component } from 'svelte';
	import GoalRing from '#lib/ui/GoalRing.svelte';
	import { loadCoachWeek, type CoachWeek } from '#lib/training/planData.js';
	import { DEFAULT_MINUTES } from '#lib/training/plan.js';
	import { setSetting } from '#lib/db/db.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let w = $state<CoachWeek | null>(null);

	onMount(() => {
		const sub = liveQuery(() => loadCoachWeek()).subscribe({
			next: (x) => (w = x),
			error: (e) => console.error(e)
		});
		return () => sub.unsubscribe();
	});

	const MINUTES = [15, 30, 45, 60];
	async function setMinutes(n: number) {
		await setSetting('minutesPerDay', n);
		// Tagesplan mit der neuen Dosis neu zusammenstellen
		await setSetting('dailyPlan', null);
	}

	interface Row {
		icon: Component;
		label: string;
		done: number;
		target: number;
		href: string;
	}
	const rows = $derived.by((): Row[] => {
		if (!w) return [];
		const p = w.progress;
		const tc = w.recipe.timeControl;
		return [
			{
				icon: ChessKnight,
				label: t(w.online ? 'coachWeek.games' : 'coachWeek.gamesBots', { tc }),
				...p.games,
				href: resolve('/play?plan=1')
			},
			{
				icon: ChartLine,
				label: t('coachWeek.reviewed'),
				...p.reviewed,
				href:
					w.toReview !== null
						? resolve(`/analysis?game=${w.toReview}&practice=1`)
						: resolve('/analysis')
			},
			{ icon: Puzzle, label: t('coachWeek.puzzles'), ...p.puzzles, href: resolve('/puzzles') },
			{
				icon: ShieldCheck,
				label: t('coachWeek.safety'),
				...p.safety,
				href: resolve('/puzzles/safety')
			},
			{
				icon: GraduationCap,
				label: t('coachWeek.lessons'),
				...p.lessons,
				href: resolve('/learn')
			}
		];
	});

	const ADJ_HREF: Record<string, string> = {
		'play-more': '/play?plan=1',
		'slow-down': '/puzzles/safety',
		'more-tactics': '/puzzles'
	};
	const adjHref = $derived.by(() => {
		if (!w) return null;
		const k = w.adjustment.kind;
		if (k === 'review-first')
			return w.toReview !== null
				? resolve(`/analysis?game=${w.toReview}&practice=1`)
				: resolve('/analysis');
		return ADJ_HREF[k] ? resolve(ADJ_HREF[k] as '/') : null;
	});
	const adjText = $derived.by(() => {
		if (!w) return '';
		const a = w.adjustment;
		if (a.kind === 'none') return '';
		if (a.kind === 'play-more') return t('coachWeek.adj.play-more', { n: a.played });
		if (a.kind === 'on-track') return t('coachWeek.adj.on-track', { n: a.gain });
		return t(`coachWeek.adj.${a.kind}`);
	});
	const fmt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: 1 });
</script>

<section class="card week" data-testid="coach-week" aria-busy={!w}>
	{#if !w}
		<div class="skeleton" style:height="220px"></div>
	{:else}
		<div class="head">
			<GoalRing
				value={Math.round(w.progress.share * 100)}
				max={100}
				size={52}
				label={`${Math.round(w.progress.share * 100)}%`}
			/>
			<div class="h-text">
				<h2>{t('coachWeek.title')}</h2>
				<span class="muted">{t('coachWeek.daysLeft', { n: w.daysLeft })}</span>
			</div>
		</div>

		<ul class="rows">
			{#each rows as r (r.label)}
				{@const Icon = r.icon}
				{@const done = r.done >= r.target}
				<li>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href ist bereits aufgelöst -->
					<a href={r.href} class:done>
						<span class="ico"
							>{#if done}<Check size={16} strokeWidth={3} />{:else}<Icon size={16} />{/if}</span
						>
						<span class="label">{r.label}</span>
						<span class="bar" aria-hidden="true"
							><i style:width="{Math.min(100, (r.done / Math.max(1, r.target)) * 100)}%"></i></span
						>
						<b class="num">{Math.min(r.done, 999)}/{r.target}</b>
						<ChevronRight size={16} />
					</a>
				</li>
			{/each}
		</ul>

		{#if adjText}
			<div
				class="verdict"
				class:good={w.adjustment.kind === 'on-track'}
				data-testid="coach-verdict"
			>
				<span>{adjText}</span>
				{#if adjHref && w.adjustment.kind !== 'on-track'}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href ist bereits aufgelöst -->
					<a class="btn small" href={adjHref}
						>{t(`coachWeek.adjGo.${w.adjustment.kind}`)} <ArrowRight size={15} /></a
					>
				{/if}
			</div>
		{/if}

		{#if w.path}
			{@const p = w.path}
			<div class="path" data-testid="coach-path">
				<div class="p-top">
					<span class="mono-label">{t('coachWeek.path')}</span>
					<b class="num"
						>{p.reached ? '1600 ✓' : t('coachWeek.milestone', { n: p.strength, goal: p.goal })}</b
					>
				</div>
				<span class="track" aria-hidden="true"
					><i style:width="{Math.round(p.progress * 100)}%"></i></span
				>
				<span class="muted small" class:warn={p.blunderGap}>
					{#if p.reached}{t('coachWeek.reached')}{:else if p.blunders === null}{t(
							'coachWeek.blundersNone'
						)}{:else}{t('coachWeek.blunders', {
							you: fmt(p.blunders),
							goal: p.goal,
							ref: fmt(p.blundersAtGoal)
						})}{/if}
				</span>
			</div>
		{/if}

		<details class="why">
			<summary>{t('coachWeek.why')} <ChevronDown size={16} /></summary>
			<p class="dose">
				{t('coachWeek.dose', {
					puzzles: w.recipe.puzzles,
					safety: w.recipe.safety,
					scan: w.recipe.scan,
					games: w.recipe.games,
					tc: w.recipe.timeControl,
					lessons: w.recipe.lessons
				})}
			</p>
			<div class="minutes" role="radiogroup" aria-label={t('coachWeek.minutes')}>
				<span class="mono-label">{t('coachWeek.minutes')}</span>
				{#each MINUTES as n (n)}
					<button
						role="radio"
						aria-checked={(w.recipe.minutesPerDay ?? DEFAULT_MINUTES) === n}
						class:on={(w.recipe.minutesPerDay ?? DEFAULT_MINUTES) === n}
						onclick={() => setMinutes(n)}>{t('coachWeek.minutesN', { n })}</button
					>
				{/each}
			</div>
			<ul class="facts">
				<li>{t('coachWeek.why1')}</li>
				<li>{t('coachWeek.why2')}</li>
				<li>{t('coachWeek.why3')}</li>
				<li>{t('coachWeek.honest')}</li>
			</ul>
			<p class="muted small">{t('coachWeek.note')}</p>
		</details>
	{/if}
</section>

<style>
	.week {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.15rem;
		border-radius: var(--radius-tile);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.h-text {
		display: flex;
		flex-direction: column;
	}

	h2 {
		font-size: 1.1rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.85rem;
	}

	.small {
		font-size: 0.82rem;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.rows a {
		display: grid;
		grid-template-columns: auto 1fr 3.5rem auto auto;
		align-items: center;
		gap: 0.55rem;
		min-height: 44px;
		padding: 0.35rem 0.6rem;
		border-radius: 12px;
		background: var(--surface-2);
		color: var(--text);
		text-decoration: none;
		font-size: 0.92rem;
	}

	.rows a.done {
		color: var(--text-2);
	}

	.ico {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
	}

	.done .ico {
		background: var(--good);
		color: #fff;
	}

	.label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar,
	.track {
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text) 10%, transparent);
		overflow: hidden;
	}

	.bar i,
	.track i {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
	}

	.num {
		font-family: var(--font-num);
		font-variant-numeric: tabular-nums;
		font-size: 0.85rem;
		text-align: right;
	}

	.verdict {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		padding: 0.7rem 0.8rem;
		border-radius: 12px;
		background: color-mix(in srgb, var(--warn) 12%, var(--surface));
		color: var(--warn-text);
		font-size: 0.9rem;
	}

	.verdict span {
		flex: 1 1 14rem;
	}

	.verdict.good {
		background: color-mix(in srgb, var(--good) 12%, var(--surface));
		color: var(--text);
	}

	.path {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.p-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.mono-label {
		color: var(--text-3);
	}

	.warn {
		color: var(--warn-text);
	}

	.why summary {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
		list-style: none;
		font-weight: 600;
		font-size: 0.92rem;
		min-height: 44px;
	}

	.why summary::-webkit-details-marker {
		display: none;
	}

	.why[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	.dose {
		font-size: 0.9rem;
		margin: 0 0 0.6rem;
	}

	.minutes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.minutes .mono-label {
		margin-right: 0.2rem;
	}

	.minutes button {
		min-height: 36px;
		padding: 0 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.minutes button.on {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}

	.facts {
		margin: 0 0 0.5rem;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.86rem;
		color: var(--text-2);
	}
</style>
