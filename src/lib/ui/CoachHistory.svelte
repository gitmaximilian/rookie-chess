<script lang="ts">
	import { intlLocale, t } from '#lib/i18n/i18n.svelte.js';
	import {
		COACH_PERIODS,
		coachPeriod,
		type CoachHistoryPoint,
		type CoachPeriod
	} from '#lib/training/coachHistory.js';
	import { resolve } from '$app/paths';

	let { history }: { history: CoachHistoryPoint[] } = $props();
	let period = $state<CoachPeriod>(30);
	let selected = $state<number | null>(null);
	const summary = $derived(coachPeriod(history, period));
	const active = $derived(summary.points[selected ?? Math.max(0, summary.points.length - 1)]);
	const W = 420;
	const H = 178;
	const L = 8;
	const R = W - 38;
	const T = 14;
	const B = H - 27;
	const ticks = [0, 50, 100];
	/** Wertungslinie ohne die Einstufung neuer Konten (coachHistory.ts settledFrom) */
	const ratedPoints = $derived(summary.points.filter((p) => !p.provisional));
	/** eine Elo-Achse für Wertung und Spielniveau */
	const ratingBounds = $derived.by(() => {
		const values = [
			...ratedPoints.map((p) => p.rating),
			...summary.points.flatMap((p) => (p.index ? [p.index.value] : []))
		];
		if (!values.length) return { min: 0, max: 100 };
		let min = values[0];
		let max = min;
		for (const rating of values) {
			min = Math.min(min, rating);
			max = Math.max(max, rating);
		}
		min = Math.floor((min - 1) / 50) * 50;
		max = Math.ceil((max + 1) / 50) * 50;
		return { min, max };
	});
	const xpos = (date: number) =>
		L + (R - L) * ((date - summary.start) / Math.max(1, summary.end - summary.start));
	const ypos = (score: number) => B - ((B - T) * score) / 100;
	const eloY = (rating: number) =>
		ypos((100 * (rating - ratingBounds.min)) / (ratingBounds.max - ratingBounds.min));

	const ratingPath = $derived(
		ratedPoints.map((p, i) => `${i ? 'L' : 'M'}${xpos(p.date)},${eloY(p.rating)}`).join(' ')
	);
	const scored = $derived(summary.points.filter((p) => p.index !== null));
	const indexPath = $derived(
		scored.map((p, i) => `${i ? 'L' : 'M'}${xpos(p.date)},${eloY(p.index!.value)}`).join(' ')
	);
	const lastScored = $derived(scored.at(-1));
	const lastRating = $derived(ratedPoints.at(-1));

	function selectPeriod(value: CoachPeriod) {
		period = value;
		selected = null;
	}

	function pick(event: PointerEvent) {
		if (!summary.points.length) return;
		const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = ((event.clientX - box.left) / box.width) * W;
		const target = summary.start + ((x - L) / (R - L)) * (summary.end - summary.start);
		const first = summary.points.findIndex((point) => point.date >= target);
		if (first <= 0) {
			selected = first === 0 ? 0 : summary.points.length - 1;
			return;
		}
		selected =
			target - summary.points[first - 1].date < summary.points[first].date - target
				? first - 1
				: first;
	}

	const display = (value?: number | null) =>
		value == null ? '–' : value.toLocaleString(intlLocale());
	const delta = (value: number | null) =>
		value == null ? '' : value.toLocaleString(intlLocale(), { signDisplay: 'exceptZero' });
	const formatDate = (date: number, year = false) =>
		new Date(date).toLocaleDateString(intlLocale(), {
			day: 'numeric',
			month: 'short',
			...(year ? { year: 'numeric' as const } : {})
		});
	const decimal = (value: number) =>
		value.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
</script>

<section class="card history" aria-labelledby="coach-history-title" data-testid="coach-history">
	<h2 id="coach-history-title">{t('coachHistory.title')}</h2>
	<div class="periods" role="group" aria-label={t('coachHistory.period')}>
		{#each COACH_PERIODS as value (value)}
			<button type="button" aria-pressed={period === value} onclick={() => selectPeriod(value)}>
				{t(`coachHistory.periods.${value}`)}
			</button>
		{/each}
	</div>
	{#if !summary.points.length}
		<p class="muted">{t(history.length ? 'coachHistory.noPeriod' : 'coachHistory.noGames')}</p>
		{#if !history.length}
			<a class="btn secondary" href={resolve('/import?rapid=1')}>{t('plan.importRapid')}</a>
		{/if}
	{:else}
		<div class="totals">
			<div class="index">
				<span>{t('coachHistory.index')}</span>
				<strong>{display(summary.latestIndex?.value)} <small>{t('coachHistory.elo')}</small></strong
				>
				{#if summary.indexDelta !== null}<small>{delta(summary.indexDelta)}</small>{/if}
			</div>
			<div class="elo">
				<span>{t('coachHistory.rating')}</span>
				<strong>{display(summary.latestRating)} <small>{t('coachHistory.elo')}</small></strong>
				{#if summary.ratingDelta !== null}<small>{delta(summary.ratingDelta)}</small>{/if}
			</div>
		</div>
		{#if !summary.latestIndex}<p class="muted">{t('coachHistory.notEnough')}</p>{/if}
		<svg viewBox="0 0 {W} {H}" aria-hidden="true" onpointermove={pick} onpointerdown={pick}>
			{#each ticks as tick (tick)}
				<line class="grid" x1={L} x2={R} y1={ypos(tick)} y2={ypos(tick)} />
				<text class="elo" x={R + 5} y={ypos(tick) + 3}>
					{ratingBounds.min + ((ratingBounds.max - ratingBounds.min) * tick) / 100}
				</text>
			{/each}
			<text x={L} y={H - 4}>{formatDate(summary.start, period === 'all' || period === 365)}</text>
			<text x={R} y={H - 4} text-anchor="end"
				>{formatDate(summary.end, period === 'all' || period === 365)}</text
			>
			<path class="elo line" d={ratingPath} />
			<path class="index line" d={indexPath} />
			{#if lastScored?.index}<circle
					class="index"
					cx={xpos(lastScored.date)}
					cy={eloY(lastScored.index.value)}
					r="3.5"
				/>{/if}
			{#if lastRating}<circle
					class="elo"
					cx={xpos(lastRating.date)}
					cy={eloY(lastRating.rating)}
					r="3.5"
				/>{/if}
			{#if selected !== null && active}
				<line class="cursor" x1={xpos(active.date)} x2={xpos(active.date)} y1={T} y2={B} />
				{#if !active.provisional}<circle
						class="elo"
						cx={xpos(active.date)}
						cy={eloY(active.rating)}
						r="3.5"
					/>{/if}
				{#if active.index}<circle
						class="index"
						cx={xpos(active.date)}
						cy={eloY(active.index.value)}
						r="3.5"
					/>{/if}
			{/if}
		</svg>
		{#if active}
			<div class="point" data-testid="coach-history-point">
				{#if summary.points.length > 1}
					<input
						type="range"
						min="0"
						max={summary.points.length - 1}
						value={selected ?? summary.points.length - 1}
						aria-label={t('coachHistory.selectGame')}
						aria-valuetext={formatDate(active.date, true)}
						oninput={(event) => (selected = event.currentTarget.valueAsNumber)}
					/>
				{/if}
				<p class="muted">
					{formatDate(active.date, true)} · {t('coachHistory.index')}
					{display(active.index?.value)} · {t('coachHistory.elo')}
					{display(active.rating)}{#if active.provisional}
						({t('coachHistory.provisional')}){/if}
				</p>
				{#if active.index}
					<p class="muted">
						{t('coachHistory.sample', {
							analysed: active.index.analysed,
							moves: active.index.moves,
							rate: decimal(active.index.blundersPer30),
							accuracy: decimal(active.index.accuracy)
						})}
					</p>
				{/if}
			</div>
		{/if}
		<dl class="stats">
			<div>
				<dt>{t('coachHistory.coverage')}</dt>
				<dd>{summary.analysed}/{summary.points.length}</dd>
			</div>
			<div>
				<dt>{t('coachHistory.outcomes')}</dt>
				<dd>{summary.wins} / {summary.draws} / {summary.losses}</dd>
			</div>
			<div>
				<dt>{t('coachHistory.converted')}</dt>
				<dd>
					{summary.conversion === null
						? '–'
						: `${summary.conversion} % · ${summary.conversionGames}`}
				</dd>
			</div>
		</dl>
	{/if}
	<details>
		<summary>{t('coachHistory.how')}</summary>
		<p>{t('coachHistory.basis')}</p>
		<p>{t('coachHistory.formula')}</p>
		<p>{t('coachHistory.safety')}</p>
		<p>{t('coachHistory.eloSource')}</p>
	</details>
</section>

<style>
	.history {
		display: grid;
		gap: 0.85rem;
		padding: clamp(0.85rem, 4vw, 1.3rem);
	}
	h2 {
		font-size: 1.25rem;
	}
	.periods {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		padding: 0.2rem;
		background: var(--surface-2);
		border-radius: 14px;
	}
	.periods button {
		min-height: 44px;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--text);
		cursor: pointer;
		font-size: 0.83rem;
	}
	.periods button[aria-pressed='true'] {
		background: var(--text);
		color: var(--bg);
		font-weight: 750;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}
	.totals > div {
		display: flex;
		flex-direction: column;
	}
	.totals span {
		font-size: 0.85rem;
		font-weight: 650;
	}
	.totals strong {
		font-size: 1.55rem;
	}
	small,
	.muted,
	.stats dt,
	details p {
		color: var(--text-2);
		font-size: 0.8rem;
	}
	.index {
		color: var(--good);
	}
	.elo {
		color: var(--c-puzzle);
	}
	svg {
		width: min(100%, 690px);
		height: auto;
		justify-self: center;
		touch-action: pan-y;
	}
	svg text {
		font: 11px var(--font-body);
		fill: var(--text-2);
	}
	svg .index {
		color: var(--good);
		fill: currentColor;
	}
	svg .elo {
		color: var(--c-puzzle);
		fill: currentColor;
	}
	svg .line {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.25;
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
	}
	svg .line.elo,
	.cursor {
		stroke-dasharray: 4 3;
	}
	.grid {
		stroke: var(--line);
	}
	.cursor {
		stroke: var(--text-2);
	}
	.point input {
		display: block;
		width: 100%;
		min-height: 24px;
		margin: 0 0 0.3rem;
		accent-color: var(--accent);
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		margin: 0;
	}
	.stats div {
		flex: 1 1 6rem;
	}
	.stats dd {
		margin-left: 0;
		font-weight: 700;
	}
	details {
		border-top: 1px solid var(--line);
		padding-top: 0.65rem;
	}
	summary {
		cursor: pointer;
		min-height: 32px;
		font-weight: 650;
	}
	details p + p {
		margin-top: 0.45rem;
	}
</style>
