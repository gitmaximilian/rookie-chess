<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import { db, getSetting, today } from '#lib/db/db.js';
	import { onlineRatings, type OnlineRating } from '#lib/import/ratings.js';
	import { getLinked, syncState } from '#lib/import/sync.svelte.js';
	import { getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { currentStrength } from '#lib/training/planData.js';
	import { loadAchievementData } from '#lib/training/achievementData.js';
	import { ACHIEVEMENTS, unlocked } from '#lib/training/achievements.js';
	import { outcomeOf } from '#lib/training/gamestats.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	interface Data {
		elo: { lichess: OnlineRating | null; chesscom: OnlineRating | null };
		linked: { lichess: boolean; chesscom: boolean };
		puzzle: { rating: number; provisional: boolean };
		strength: number | null;
		form: ('w' | 'd' | 'l')[];
		games: number;
		todayPuzzles: number;
		goal: number;
		achievements: number;
	}

	let d = $state<Data | null>(null);

	/** meistgespielte Bedenkzeit je Plattform */
	const main = (rs: OnlineRating[], src: 'lichess' | 'chesscom') =>
		rs.filter((r) => r.source === src).sort((a, b) => b.games - a.games)[0] ?? null;

	async function load() {
		const [ratings, linked, puzzle, strength, games, ach] = await Promise.all([
			onlineRatings(),
			getLinked(),
			getPuzzleRating(),
			currentStrength(),
			db.games.orderBy('date').reverse().limit(10).toArray(),
			loadAchievementData()
		]);
		d = {
			elo: { lichess: main(ratings, 'lichess'), chesscom: main(ratings, 'chesscom') },
			linked: { lichess: !!linked.lichess, chesscom: !!linked.chesscom },
			puzzle: { rating: Math.round(puzzle.rating), provisional: isProvisional(puzzle) },
			strength: strength?.value ?? null,
			form: games
				.map(outcomeOf)
				.filter((o) => o !== null)
				.reverse(),
			games: await db.games.count(),
			todayPuzzles: (await db.activity.get(today()))?.puzzles ?? 0,
			goal: await getSetting('dailyGoal', 5),
			achievements: unlocked(ach).length
		};
	}

	onMount(load);
	$effect(() => {
		if (!syncState.running) void load();
	});

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
</script>

<section class="sum" aria-busy={!d}>
	{#if !d}
		{#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="skeleton tile-sk"></div>{/each}
	{:else}
		{#each [['lichess', 'Lichess'], ['chesscom', 'Chess.com']] as const as [src, label] (src)}
			{@const r = d.elo[src]}
			<a
				class="tile"
				href={resolve(d.linked[src] ? '/profile/stats' : '/import')}
				style:--c="var(--c-analysis)"
			>
				<span class="lbl"><span class="logo {src}">{label[0]}</span> {label}</span>
				{#if r}
					<span class="val">{r.rating}</span>
					<span class="sub">
						{speedName(r.speed)}
						{#if r.delta}
							<span class="d" class:up={r.delta > 0}
								>{#if r.delta > 0}<TrendingUp size={12} />+{:else}<TrendingDown
										size={12}
									/>{/if}{r.delta}</span
							>
						{/if}
					</span>
				{:else if d.linked[src]}
					<span class="val muted">…</span>
					<span class="sub">{t('summary.loading')}</span>
				{:else}
					<span class="val muted">–</span>
					<span class="sub link">{t('summary.link')}</span>
				{/if}
			</a>
		{/each}

		<a class="tile" href={resolve('/puzzles')} style:--c="var(--c-puzzle)">
			<span class="lbl">{t('summary.puzzle')}</span>
			<span class="val">{d.puzzle.rating}{d.puzzle.provisional ? '?' : ''}</span>
			<span class="sub">{t('summary.today', { n: d.todayPuzzles, m: d.goal })}</span>
		</a>

		<a class="tile" href={resolve('/profile')} style:--c="var(--accent)">
			<span class="lbl">{t('summary.strength')}</span>
			<span class="val">{d.strength ? `≈ ${d.strength}` : '–'}</span>
			<span class="sub">{t('summary.strengthSub')}</span>
		</a>

		<a class="tile" href={resolve('/analysis')} style:--c="var(--c-play)">
			<span class="lbl">{t('summary.form')}</span>
			{#if d.form.length}
				<span class="form" aria-label={t('summary.formAria', { pct: score ?? 0 })}>
					{#each d.form as f, i (i)}<span class="dot {f}"></span>{/each}
				</span>
				<span class="sub">{t('summary.formSub', { pct: score ?? 0, n: d.games })}</span>
			{:else}
				<span class="val muted">–</span>
				<span class="sub">{t('summary.noGames')}</span>
			{/if}
		</a>

		<a class="tile" href={resolve('/profile')} style:--c="var(--warn)">
			<span class="lbl">{t('summary.achievements')}</span>
			<span class="val">{d.achievements}<small>/{ACHIEVEMENTS.length}</small></span>
			<span class="sub">{t('summary.achievementsSub')}</span>
		</a>
	{/if}
</section>

<style>
	.sum {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	@media (min-width: 700px) {
		.sum {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.sum {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}

	.tile-sk {
		height: 96px;
	}

	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		padding: 0.8rem 0.9rem;
		border-radius: var(--radius-l, 18px);
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-1);
		color: var(--text);
		overflow: hidden;
		transition: transform var(--dur) var(--ease-out);
	}

	.tile::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 3px;
		background: var(--c);
	}

	.tile:active {
		transform: scale(0.98);
	}

	.lbl {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-2);
	}

	.logo {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 5px;
		font-size: 0.68rem;
		font-weight: 800;
		color: #fff;
		background: #3a3632;
	}

	.logo.chesscom {
		background: #5d8a3a;
	}

	.val {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 750;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
	}

	.val small {
		font-size: 0.95rem;
		color: var(--text-2);
	}

	.val.muted {
		color: var(--text-3);
	}

	.sub {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sub.link {
		color: var(--accent);
		font-weight: 650;
	}

	.d {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		font-weight: 700;
		color: var(--bad);
	}

	.d.up {
		color: var(--good);
	}

	.form {
		display: flex;
		gap: 3px;
		margin: 0.55rem 0 0.35rem;
	}

	.dot {
		flex: 1;
		max-width: 14px;
		height: 14px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--text-3) 60%, var(--surface-2));
	}

	.dot.w {
		background: var(--good);
	}

	.dot.l {
		background: var(--bad);
	}
</style>
