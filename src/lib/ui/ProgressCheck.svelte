<script lang="ts">
	/**
	 * „Wirkt dein Training?“ – die Lernkennzahlen, nicht die Fleißkennzahlen (lib/training/progress.ts):
	 * Patzer je 30 Züge (mit Zufallsbereich), Kontrolltest, Trefferquoten im Training.
	 * Lädt seine Daten selbst, damit es auf Coach und Start gleich aussieht.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import BentoGrid from '#lib/ui/bento/BentoGrid.svelte';
	import StatTile from '#lib/ui/bento/StatTile.svelte';
	import { db, getSetting } from '#lib/db/db.js';
	import { blunderSeries, blunderTrend, successRate, type Trend } from '#lib/training/progress.js';
	import {
		checkupDue,
		checkupTrend,
		CHECKUP_EVERY_DAYS,
		type CheckupResult
	} from '#lib/training/safety.js';
	import { selfReviewRate, type SelfReviewResult } from '#lib/analysis/selfreview.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let { testid = 'progress-check' }: { testid?: string } = $props();

	let trend = $state<Trend | null>(null);
	let spark = $state<number[]>([]);
	let checkups = $state<CheckupResult[]>([]);
	let safetyRate = $state<number | null>(null);
	let puzzleRate = $state<number | null>(null);
	let selfRate = $state<number | null>(null);
	let ready = $state(false);

	onMount(async () => {
		const [games, attempts, ch] = await Promise.all([
			db.games.toArray(),
			db.puzzleAttempts.orderBy('date').reverse().limit(400).toArray(),
			getSetting<CheckupResult[]>('checkups', [])
		]);
		const series = blunderSeries(games);
		trend = blunderTrend(series);
		spark = series.slice(-20).map((x) => x.per30);
		checkups = ch;
		selfRate = selfReviewRate(await getSetting<SelfReviewResult[]>('selfReviews', []));
		safetyRate = successRate(
			attempts
				.filter((a) => a.source === 'safety')
				.slice(0, 30)
				.map((a) => a.solved)
		);
		puzzleRate = successRate(
			attempts
				.filter((a) => a.source === 'lichess')
				.slice(0, 30)
				.map((a) => a.solved && !a.hinted)
		);
		ready = true;
	});

	const blunderSub = $derived.by(() => {
		if (!trend) return '';
		switch (trend.verdict) {
			case 'better':
				return t('progress.better', { d: Math.abs(trend.diff ?? 0), p: trend.previous ?? 0 });
			case 'worse':
				return t('progress.worse', { d: Math.abs(trend.diff ?? 0), p: trend.previous ?? 0 });
			case 'same':
				return t('progress.same', { p: trend.previous ?? 0 });
			default:
				return trend.recentN < 10
					? t('progress.baseline', { n: 10 - trend.recentN })
					: t('progress.compareIn', { n: trend.missing });
		}
	});

	const lastCheckup = $derived(checkups.at(-1) ?? null);
	const ctrend = $derived(checkupTrend(checkups));
	const due = $derived(checkupDue(checkups));
	const daysLeft = $derived(
		lastCheckup
			? Math.max(
					0,
					Math.ceil((lastCheckup.date + CHECKUP_EVERY_DAYS * 86_400_000 - Date.now()) / 86_400_000)
				)
			: 0
	);
	const checkupSub = $derived.by(() => {
		if (!lastCheckup) return t('progress.checkupNone');
		const tr = ctrend;
		const next = due ? t('progress.checkupDue') : t('progress.checkupNext', { n: daysLeft });
		if (!tr) return next;
		return `${t('progress.checkupFrom', { first: tr.first })} · ${next}`;
	});
</script>

<section class="progress" data-testid={testid} aria-busy={!ready}>
	<div class="p-head">
		<h2>{t('progress.title')}</h2>
		<p class="muted">{t('progress.text')}</p>
	</div>
	<BentoGrid label={t('progress.title')}>
		<StatTile
			tone="play"
			size="m"
			label={t('progress.blunders')}
			value={trend?.recent === null || !trend ? '–' : trend.recent.toFixed(1)}
			muted={!trend || trend.recent === null}
			sub={blunderSub}
			{spark}
			href={resolve('/analysis')}
		/>
		<StatTile
			tone="coach"
			label={t('progress.checkup')}
			value={lastCheckup ? Math.round((lastCheckup.score / lastCheckup.total) * 100) : '–'}
			unit={lastCheckup ? '%' : ''}
			muted={!lastCheckup}
			sub={checkupSub}
			href={resolve('/puzzles/safety?test=1')}
		/>
		<StatTile
			tone="learn"
			label={t('progress.safety')}
			value={safetyRate ?? '–'}
			unit={safetyRate === null ? '' : '%'}
			muted={safetyRate === null}
			sub={t('progress.target')}
			href={resolve('/puzzles/safety')}
		/>
		<StatTile
			tone="puzzle"
			label={t('progress.puzzles')}
			value={puzzleRate ?? '–'}
			unit={puzzleRate === null ? '' : '%'}
			muted={puzzleRate === null}
			sub={t('progress.targetSelf')}
			href={resolve('/puzzles')}
		/>
		<StatTile
			tone="games"
			label={t('progress.self')}
			value={selfRate ?? '–'}
			unit={selfRate === null ? '' : '%'}
			muted={selfRate === null}
			sub={selfRate === null ? t('progress.selfNone') : t('progress.selfSub')}
		/>
	</BentoGrid>
</section>

<style>
	.progress {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.p-head {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.p-head h2 {
		font-size: 1.25rem;
	}

	.p-head p {
		font-size: 0.9rem;
		max-width: 60ch;
	}
</style>
