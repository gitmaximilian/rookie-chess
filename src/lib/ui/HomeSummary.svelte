<script lang="ts">
	/**
	 * Kennzahl-Kacheln der Startseite. Rendert direkt ins umgebende BentoGrid
	 * (keine eigene Hülle), damit sich die Kacheln neben den Tagesplan legen.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import StatTile from '#lib/ui/bento/StatTile.svelte';
	import { db, getSetting, today } from '#lib/db/db.js';
	import { onlineRatings, type OnlineRating } from '#lib/import/ratings.js';
	import { getLinked, syncState } from '#lib/import/sync.svelte.js';
	import { getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { currentStrength } from '#lib/training/planData.js';
	import { loadStars, totalStars } from '#lib/training/stars.js';
	import { outcomeOf } from '#lib/training/gamestats.js';
	import { computeStreak } from '#lib/training/streak.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	interface Data {
		elo: { lichess: OnlineRating | null; chesscom: OnlineRating | null };
		linked: { lichess: boolean; chesscom: boolean };
		puzzle: { rating: number; provisional: boolean };
		puzzleHist: number[];
		strength: number | null;
		form: ('w' | 'd' | 'l')[];
		games: number;
		todayPuzzles: number;
		goal: number;
		stars: { earned: number; max: number };
		streak: { days: number; todayDone: boolean };
		last14: number[];
	}

	let d = $state<Data | null>(null);

	/** meistgespielte Bedenkzeit je Plattform */
	const main = (rs: OnlineRating[], src: 'lichess' | 'chesscom') =>
		rs.filter((r) => r.source === src).sort((a, b) => b.games - a.games)[0] ?? null;

	async function load() {
		const [ratings, linked, puzzle, strength, games, stars, hist, activity] = await Promise.all([
			onlineRatings(),
			getLinked(),
			getPuzzleRating(),
			currentStrength(),
			db.games.orderBy('date').reverse().limit(10).toArray(),
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
			strength: strength?.value ?? null,
			form: games
				.map(outcomeOf)
				.filter((o) => o !== null)
				.reverse(),
			games: await db.games.count(),
			todayPuzzles: (await db.activity.get(today()))?.puzzles ?? 0,
			goal: await getSetting('dailyGoal', 5),
			stars: totalStars(stars),
			streak: computeStreak(activity),
			last14
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
	const goalPct = $derived(d ? Math.min(100, Math.round((d.todayPuzzles / d.goal) * 100)) : 0);
	const starPct = $derived(d && d.stars.max ? (d.stars.earned / d.stars.max) * 100 : 0);
</script>

{#if !d}
	{#each [0, 1, 2, 3] as i (i)}<div class="skeleton tile-sk" data-size="s"></div>{/each}
{:else}
	<StatTile
		tone="learn"
		label={t('summary.goal')}
		value={d.todayPuzzles}
		unit={`/${d.goal}`}
		sub={d.todayPuzzles >= d.goal
			? t('summary.goalDone')
			: t('summary.goalLeft', { n: d.goal - d.todayPuzzles })}
		href={resolve('/puzzles')}
		testid="tile-goal"
	>
		<span class="bar" aria-hidden="true"><i style:width="{goalPct}%"></i></span>
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

	<StatTile
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
	/>

	<StatTile
		tone="coach"
		label={t('summary.strength')}
		value={d.strength ? `≈${d.strength}` : '–'}
		muted={!d.strength}
		sub={t('summary.strengthGoal')}
		href={resolve('/coach')}
		testid="tile-strength"
	>
		{#if d.strength}
			<span class="bar" aria-hidden="true"
				><i style:width="{Math.min(100, (d.strength / 1200) * 100)}%"></i></span
			>
		{/if}
	</StatTile>

	<StatTile
		tone="games"
		size="m"
		label={t('summary.form')}
		value={score !== null ? score : '–'}
		unit={score !== null ? '%' : ''}
		muted={score === null}
		sub={d.form.length ? t('summary.formLast', { n: d.form.length }) : t('summary.noGames')}
		href={resolve('/analysis')}
		testid="tile-form"
	>
		{#if d.form.length}
			<span class="form" aria-label={t('summary.formAria', { pct: score ?? 0 })} role="img">
				{#each d.form as f, i (i)}<span class="dot {f}"></span>{/each}
			</span>
		{/if}
	</StatTile>

	<StatTile
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
	</StatTile>

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
</style>
