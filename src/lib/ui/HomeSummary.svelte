<script lang="ts">
	/**
	 * Kennzahl-Kacheln der Startseite. Rendert direkt ins umgebende BentoGrid
	 * (keine eigene Hülle), damit sich die Kacheln neben den Tagesplan legen.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import StatTile from '#lib/ui/bento/StatTile.svelte';
	import Radar from '@lucide/svelte/icons/radar';
	import { db, today } from '#lib/db/db.js';
	import { loadCoachWeek, type CoachWeek } from '#lib/training/planData.js';
	import { syncState } from '#lib/import/sync.svelte.js';
	import { outcomeOf } from '#lib/training/gamestats.js';
	import { computeStreak } from '#lib/training/streak.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	/** Start zeigt nur das Heute: Woche, Serie, Spielstärke, Form – alles Weitere im Coach und im Profil */
	interface Data {
		form: ('w' | 'd' | 'l')[];
		streak: { days: number; todayDone: boolean };
		last14: number[];
		week: CoachWeek;
	}

	let d = $state<Data | null>(null);

	async function load() {
		const [games, activity] = await Promise.all([
			db.games.orderBy('date').reverse().toArray(),
			db.activity.toArray()
		]);
		const byDay = new Map(activity.map((a) => [a.day, a.puzzles + a.games + a.reviews]));
		const now = Date.now();
		const last14 = Array.from(
			{ length: 14 },
			(_, i) => byDay.get(today(new Date(now - (13 - i) * 86_400_000))) ?? 0
		);
		d = {
			form: games
				.slice(0, 10)
				.map(outcomeOf)
				.filter((o) => o !== null)
				.reverse(),
			streak: computeStreak(activity),
			last14,
			week: await loadCoachWeek()
		};
	}

	onMount(load);
	$effect(() => {
		if (!syncState.running) void load();
	});

	const score = $derived(
		d && d.form.length
			? Math.round(
					((d.form.filter((f) => f === 'w').length + d.form.filter((f) => f === 'd').length / 2) /
						d.form.length) *
						100
				)
			: null
	);
	const weekPct = $derived(
		d
			? Math.min(
					100,
					Math.round((d.week.progress.games.done / Math.max(1, d.week.progress.games.target)) * 100)
				)
			: 0
	);
</script>

{#if !d}
	{#each [0, 1, 2, 3] as i (i)}<div class="skeleton tile-sk" data-size="s"></div>{/each}
{:else}
	<!-- Diese Woche: die Partien der Wochendosis (Coach) – Lichess: unter 4 pro Woche kaum Fortschritt -->
	<StatTile
		tone="coach"
		label={t('summary.week')}
		value={d.week.progress.games.done}
		unit={`/${d.week.progress.games.target}`}
		sub={t('summary.weekSub')}
		href={resolve('/coach')}
		testid="tile-week"
	>
		<span class="bar" aria-hidden="true"><i style:width="{weekPct}%"></i></span>
	</StatTile>

	<StatTile
		tone="play"
		label={t('summary.streak')}
		value={d.streak.days}
		unit={` ${t('summary.streakDays', { n: d.streak.days })}`}
		sub={d.streak.todayDone
			? t('summary.streakDone')
			: t(d.streak.days ? 'summary.streakOpen' : 'summary.streakStart')}
		spark={d.last14}
		bars
		aria={t('home.streak')}
		testid="tile-streak"
	/>

	<!-- Kacheln erscheinen erst, wenn es etwas zu zeigen gibt – keine leeren „–“ für neue Spieler -->

	<!-- Spielstärke steht im Weg zu 1600 oben; hier der Weg in die Details des Coachs -->
	<StatTile
		tone="learn"
		label={t('coachPath.details')}
		sub={t('coachPath.detailsSub')}
		href={resolve('/coach')}
		testid="tile-details"
	>
		<span class="det" aria-hidden="true"><Radar size={34} strokeWidth={1.6} /></span>
	</StatTile>

	{#if d.form.length && score !== null}<StatTile
			tone="games"
			label={t('summary.form')}
			value={score}
			unit="%"
			sub={t('summary.formLast', { n: d.form.length })}
			href={resolve('/analysis')}
			testid="tile-form"
		>
			<span class="form" aria-label={t('summary.formAria', { pct: score })} role="img">
				{#each d.form as f, i (i)}<span class="dot {f}"></span>{/each}
			</span>
		</StatTile>{/if}
{/if}

<style>
	.tile-sk {
		height: 132px;
		border-radius: var(--radius-tile);
	}

	.det {
		display: block;
		margin: 0.5rem 0 0.3rem;
		color: var(--tone-ink);
	}

	.form {
		display: flex;
		gap: 4px;
		margin: 0.6rem 0 0.35rem;
	}

	.dot {
		flex: 1;
		max-width: 22px;
		height: 22px;
		border-radius: 7px;
		background: color-mix(in srgb, var(--tile-text) 22%, transparent);
	}

	.dot.w {
		background: var(--good);
	}

	.dot.l {
		background: var(--bad);
	}

	.bar {
		display: block;
		height: 8px;
		margin: 0.6rem 0 0.35rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--tone-ink) 18%, transparent);
		overflow: hidden;
	}

	.bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--tone-ink);
		transition: width 600ms var(--ease-out);
	}
</style>
