<script lang="ts">
	/**
	 * Kennzahl-Kacheln der Startseite. Rendert direkt ins umgebende BentoGrid
	 * (keine eigene Hülle), damit sich die Kacheln neben den Tagesplan legen.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import StatTile from '#lib/ui/bento/StatTile.svelte';
	import { db, today } from '#lib/db/db.js';
	import { dailyGoal, loadCoachWeek, type CoachWeek } from '#lib/training/planData.js';
	import { onlineRatings, targetRating, type OnlineRating } from '#lib/import/ratings.js';
	import { getLinked, syncState } from '#lib/import/sync.svelte.js';
	import { getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { loadStars, totalStars } from '#lib/training/stars.js';
	import { outcomeOf } from '#lib/training/gamestats.js';
	import { computeStreak } from '#lib/training/streak.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	interface Data {
		elo: { lichess: OnlineRating | null; chesscom: OnlineRating | null };
		linked: { lichess: boolean; chesscom: boolean };
		puzzle: { rating: number; provisional: boolean };
		puzzleHist: number[];
		rapid: number | null;
		form: ('w' | 'd' | 'l')[];
		games: number;
		attempts: number;
		todayPuzzles: number;
		goal: number;
		stars: { earned: number; max: number };
		streak: { days: number; todayDone: boolean };
		last14: number[];
		week: CoachWeek;
	}

	let d = $state<Data | null>(null);

	/** meistgespielte Bedenkzeit je Plattform */
	const main = (rs: OnlineRating[], src: 'lichess' | 'chesscom') =>
		rs.filter((r) => r.source === src).sort((a, b) => b.games - a.games)[0] ?? null;

	async function load() {
		const [ratings, linked, puzzle, games, stars, hist, activity] = await Promise.all([
			onlineRatings(),
			getLinked(),
			getPuzzleRating(),
			db.games.orderBy('date').reverse().toArray(),
			loadStars(),
			db.ratings.orderBy('date').reverse().limit(30).toArray(),
			db.activity.toArray()
		]);
		const byDay = new Map(activity.map((a) => [a.day, a.puzzles + a.games + a.reviews]));
		const now = Date.now();
		const last14 = Array.from(
			{ length: 14 },
			(_, i) => byDay.get(today(new Date(now - (13 - i) * 86_400_000))) ?? 0
		);
		d = {
			elo: { lichess: main(ratings, 'lichess'), chesscom: main(ratings, 'chesscom') },
			linked: { lichess: !!linked.lichess, chesscom: !!linked.chesscom },
			puzzle: { rating: Math.round(puzzle.rating), provisional: isProvisional(puzzle) },
			puzzleHist: hist.reverse().map((r) => r.rating),
			rapid: targetRating(games),
			form: games
				.slice(0, 10)
				.map(outcomeOf)
				.filter((o) => o !== null)
				.reverse(),
			games: games.length,
			attempts: await db.puzzleAttempts.count(),
			todayPuzzles: (await db.activity.get(today()))?.puzzles ?? 0,
			goal: await dailyGoal(),
			stars: totalStars(stars),
			streak: computeStreak(activity),
			last14,
			week: await loadCoachWeek()
		};
	}

	onMount(load);
	$effect(() => {
		if (!syncState.running) void load();
	});

	const ACCOUNTS = [
		['lichess', 'Lichess'],
		['chesscom', 'Chess.com']
	] as const;
	// nur verknüpfte Konten zeigen
	const accounts = $derived(d ? ACCOUNTS.filter(([src]) => d!.linked[src]) : []);

	const speedName = (k: string) => {
		const s = t(`stats.speed.${k}`);
		return s.startsWith('stats.') ? k : s;
	};
	const score = $derived(
		d && d.form.length
			? Math.round(
					((d.form.filter((f) => f === 'w').length + d.form.filter((f) => f === 'd').length / 2) /
						d.form.length) *
						100
				)
			: null
	);
	const puzzleDelta = $derived(
		d && d.puzzleHist.length > 1 ? d.puzzleHist.at(-1)! - d.puzzleHist[0] : null
	);
	const weekPct = $derived(
		d
			? Math.min(
					100,
					Math.round((d.week.progress.games.done / Math.max(1, d.week.progress.games.target)) * 100)
				)
			: 0
	);
	const starPct = $derived(d && d.stars.max ? (d.stars.earned / d.stars.max) * 100 : 0);
</script>

{#if !d}
	{#each [0, 1, 2, 3] as i (i)}<div class="skeleton tile-sk" data-size="s"></div>{/each}
{:else}
	<!-- Diese Woche: die Partien der Wochendosis (Coach) – Lichess: unter 4 pro Woche kaum Fortschritt -->
	<StatTile
		tone="learn"
		label={t('summary.week')}
		value={d.week.progress.games.done}
		unit={`/${d.week.progress.games.target}`}
		sub={t('summary.weekSub', {
			tc: d.week.recipe.timeControl,
			pct: Math.round(d.week.progress.share * 100)
		})}
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
		sub={d.streak.todayDone ? t('summary.streakDone') : t('summary.streakOpen')}
		spark={d.last14}
		bars
		aria={t('home.streak')}
		testid="tile-streak"
	/>

	<!-- Kacheln erscheinen erst, wenn es etwas zu zeigen gibt – keine leeren „–“ für neue Spieler -->
	{#if d.attempts}<StatTile
			tone="puzzle"
			label={t('summary.puzzle')}
			value={d.puzzle.rating}
			href={resolve('/puzzles')}
			spark={d.puzzleHist}
			delta={puzzleDelta}
			sub={d.puzzleHist.length > 1
				? t('summary.trend30')
				: t('summary.today', { n: d.todayPuzzles, m: d.goal })}
			testid="tile-puzzle"
		/>{/if}

	<StatTile
		tone="coach"
		label={t('summary.rapidGoal')}
		value={d.rapid ?? '–'}
		sub={t(d.rapid === null ? 'summary.rapidNoData' : 'summary.rapidImported')}
		href={resolve(d.rapid === null ? '/import' : '/coach')}
		testid="tile-strength"
	/>

	{#if d.form.length && score !== null}<StatTile
			tone="games"
			size="m"
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

	{#if d.stars.earned}<StatTile
			tone="stars"
			size="m"
			label={t('summary.stars')}
			value={d.stars.earned}
			unit={`/${d.stars.max}`}
			sub={t('summary.starsSub')}
			href={resolve('/profile')}
			testid="tile-stars"
		>
			<span class="bar" aria-hidden="true"><i style:width="{starPct}%"></i></span>
		</StatTile>{/if}

	{#each accounts as [src, label] (src)}
		{@const r = d.elo[src]}
		<StatTile
			tone="games"
			{label}
			value={r ? r.rating : '…'}
			muted={!r}
			delta={r?.delta ?? null}
			sub={r ? speedName(r.speed) : t('summary.loading')}
			href={resolve('/coach/stats')}
			testid="tile-{src}"
		/>
	{/each}
{/if}

<style>
	.tile-sk {
		height: 132px;
		border-radius: var(--radius-tile);
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
