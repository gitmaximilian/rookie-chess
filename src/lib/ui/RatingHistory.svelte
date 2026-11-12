<script lang="ts">
	import { resolve } from '$app/paths';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import { summarise, byMonth, type RatingPoint, type RatingSeries } from '#lib/import/ratings.js';
	import SegmentedSwitch from './bento/SegmentedSwitch.svelte';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	interface Series {
		key: string;
		label: string;
		points: RatingPoint[];
		color: string;
	}

	let {
		online,
		puzzle = []
	}: {
		online: RatingSeries[];
		puzzle?: { date: number; rating: number }[];
	} = $props();

	const speedName = (k: string) => {
		const s = t(`stats.speed.${k}`);
		return s.startsWith('stats.') ? k : s;
	};

	const all = $derived<Series[]>([
		...online.map((s) => ({
			key: s.key,
			label: `${t(`stats.source.${s.source}`)} · ${speedName(s.speed)}`,
			points: s.points,
			color: s.source === 'lichess' ? 'var(--c-play)' : '#5d8a3a'
		})),
		...(puzzle.length > 1
			? [
					{
						key: 'puzzle',
						label: t('stats.hist.puzzles'),
						points: puzzle.map((p) => ({ ...p, result: null, opponent: '' })),
						color: 'var(--c-puzzle)'
					}
				]
			: [])
	]);

	let key = $state('');
	const series = $derived(all.find((s) => s.key === key) ?? all[0]);

	const RANGES = [
		['m1', 30],
		['m3', 91],
		['y1', 365],
		['all', 0]
	] as const;
	let range = $state<(typeof RANGES)[number][0]>('m3');
	const DAY = 86_400_000;

	const view = $derived.by(() => {
		if (!series) return { pts: [] as RatingPoint[], prev: undefined };
		const days = RANGES.find((r) => r[0] === range)![1];
		const all = series.points;
		if (!days) return { pts: all, prev: undefined };
		const from = all.at(-1)!.date - days * DAY;
		const i = all.findIndex((p) => p.date >= from);
		return { pts: i < 0 ? [] : all.slice(i), prev: i > 0 ? all[i - 1] : undefined };
	});
	// zu wenige Punkte im kurzen Zeitraum → automatisch die letzten 20 zeigen
	const pts = $derived(
		view.pts.length >= 2 ? view.pts : (series?.points.slice(-20) ?? ([] as RatingPoint[]))
	);
	const sum = $derived(summarise(pts, view.pts.length >= 2 ? view.prev : undefined));
	const months = $derived(series ? byMonth(series.points) : []);
	let allMonths = $state(false);

	// ── Diagramm ──
	const W = 360;
	const H = 170;
	const PAD = { l: 36, r: 10, t: 12, b: 22 };
	const min = $derived(Math.floor((Math.min(...pts.map((p) => p.rating)) - 15) / 25) * 25);
	const max = $derived(Math.ceil((Math.max(...pts.map((p) => p.rating)) + 15) / 25) * 25);
	const t0 = $derived(pts[0]?.date ?? 0);
	const t1 = $derived(pts.at(-1)?.date ?? 1);
	const x = (d: number) => PAD.l + ((d - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
	const y = (r: number) => PAD.t + (1 - (r - min) / Math.max(1, max - min)) * (H - PAD.t - PAD.b);
	const line = $derived(
		pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ')
	);
	const area = $derived(
		pts.length
			? `${line} L${x(t1).toFixed(1)},${H - PAD.b} L${x(t0).toFixed(1)},${H - PAD.b} Z`
			: ''
	);
	const yTicks = $derived.by(() => {
		const step = Math.max(25, Math.ceil((max - min) / 3 / 25) * 25);
		const out: number[] = [];
		for (let v = min; v <= max; v += step) out.push(v);
		return out;
	});
	const xTicks = $derived(
		t1 > t0 ? [0, 1 / 3, 2 / 3, 1].map((f) => t0 + f * (t1 - t0)) : ([] as number[])
	);
	const fmtShort = (d: number) =>
		new Date(d).toLocaleDateString(intlLocale(), {
			day: 'numeric',
			month: 'short',
			...(t1 - t0 > 200 * DAY ? { year: '2-digit' } : {})
		});
	const fmtLong = (d: number) =>
		new Date(d).toLocaleDateString(intlLocale(), {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	const fmtMonth = (m: string) =>
		new Date(`${m}-15`).toLocaleDateString(intlLocale(), { month: 'short', year: 'numeric' });

	let hover = $state<number | null>(null);
	let svg = $state<SVGSVGElement>();
	function onMove(e: PointerEvent) {
		if (!svg || !pts.length) return;
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		let best = 0;
		for (let i = 1; i < pts.length; i++)
			if (Math.abs(x(pts[i].date) - px) < Math.abs(x(pts[best].date) - px)) best = i;
		hover = best;
	}
	const hp = $derived(hover !== null ? pts[hover] : null);
	const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
</script>

{#if series}
	<div class="rh" style:--rc={series.color}>
		{#if all.length > 1}
			<div class="chips" role="tablist" aria-label={t('stats.rating')}>
				{#each all as s (s.key)}
					<button
						class="chip"
						role="tab"
						aria-selected={s.key === series.key}
						class:on={s.key === series.key}
						onclick={() => {
							key = s.key;
							hover = null;
						}}>{s.label} <b>{s.points.at(-1)?.rating}</b></button
					>
				{/each}
			</div>
		{/if}

		<div class="head">
			<div>
				<span class="cur">{sum?.current ?? '–'}</span>
				{#if sum && sum.change !== 0}
					<span class="chg" class:up={sum.change > 0}
						>{#if sum.change > 0}<TrendingUp size={15} />{:else}<TrendingDown
								size={15}
							/>{/if}{signed(sum.change)}</span
					>
				{/if}
				<span class="lab">{series.label}</span>
			</div>
			<SegmentedSwitch
				label={t('stats.hist.range')}
				options={RANGES.map(([r]) => ({ value: r, label: t(`stats.hist.${r}`) }))}
				bind:value={range}
			/>
		</div>
		{#if view.pts.length < 2}
			<p class="note">{t('stats.hist.fewInRange')}</p>
		{/if}

		<div class="chart">
			<svg
				bind:this={svg}
				viewBox="0 0 {W} {H}"
				role="img"
				aria-label="{series.label}: {sum?.current}"
				onpointermove={onMove}
				onpointerdown={onMove}
				onpointerleave={() => (hover = null)}
			>
				<defs>
					<linearGradient id="rh-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color="var(--rc)" stop-opacity="0.2" />
						<stop offset="1" stop-color="var(--rc)" stop-opacity="0" />
					</linearGradient>
				</defs>
				{#each yTicks as tk (tk)}
					<line x1={PAD.l} x2={W - PAD.r} y1={y(tk)} y2={y(tk)} class="grid" />
					<text x={PAD.l - 6} y={y(tk) + 3.5} class="tick" text-anchor="end">{tk}</text>
				{/each}
				{#each xTicks as tk, i (i)}
					<text
						x={x(tk)}
						y={H - 6}
						class="tick"
						text-anchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
						>{fmtShort(tk)}</text
					>
				{/each}
				{#if sum}
					<line
						x1={PAD.l}
						x2={W - PAD.r}
						y1={y(sum.peak.rating)}
						y2={y(sum.peak.rating)}
						class="peak"
					/>
				{/if}
				<path d={area} fill="url(#rh-fill)" />
				<path d={line} class="line" />
				{#if pts.length <= 60}
					{#each pts as p, i (i)}
						<circle cx={x(p.date)} cy={y(p.rating)} r="2.4" class="pt {p.result ?? ''}" />
					{/each}
				{/if}
				{#if pts.length}
					<circle cx={x(t1)} cy={y(pts.at(-1)!.rating)} r="4.5" class="end" />
				{/if}
				{#if hp}
					<line x1={x(hp.date)} x2={x(hp.date)} y1={PAD.t} y2={H - PAD.b} class="cross" />
					<circle cx={x(hp.date)} cy={y(hp.rating)} r="5" class="end" />
				{/if}
			</svg>
			{#if hp}
				<div class="tip" style:left="{Math.min(80, Math.max(20, (x(hp.date) / W) * 100))}%">
					<b>{hp.rating}</b>
					<span>{fmtLong(hp.date)}</span>
					{#if hp.opponent}
						<span class="res {hp.result}"
							>{hp.result ? t(`stats.hist.res.${hp.result}`) : ''}
							{t('stats.hist.vs', { name: hp.opponent })}{hp.oppRating
								? ` (${hp.oppRating})`
								: ''}</span
						>
					{/if}
				</div>
			{/if}
		</div>
		<div class="legend-row">
			<span><i class="sw peakline"></i>{t('stats.hist.peak')}</span>
			{#if series.key !== 'puzzle' && pts.length <= 60}
				<span><i class="sw dot w"></i>{t('stats.win')}</span>
				<span><i class="sw dot d"></i>{t('stats.draw')}</span>
				<span><i class="sw dot l"></i>{t('stats.loss')}</span>
			{/if}
		</div>

		{#if sum}
			<dl class="kpis">
				<div>
					<dt>{t('stats.hist.peak')}</dt>
					<dd>{sum.peak.rating}<small>{fmtLong(sum.peak.date)}</small></dd>
				</div>
				<div>
					<dt>{t('stats.hist.low')}</dt>
					<dd>{sum.low.rating}<small>{fmtLong(sum.low.date)}</small></dd>
				</div>
				<div>
					<dt>{t('stats.hist.games')}</dt>
					<dd>
						{sum.games}
						{#if series.key !== 'puzzle'}<small
								>{sum.w}
								{t('stats.hist.wShort')} · {sum.d}
								{t('stats.hist.dShort')} · {sum.l}
								{t('stats.hist.lShort')}</small
							>{/if}
					</dd>
				</div>
				{#if sum.performance}
					<div>
						<dt>{t('stats.hist.performance')}</dt>
						<dd>
							{sum.performance}<small>{t('stats.hist.avgOpp', { n: sum.avgOpp ?? 0 })}</small>
						</dd>
					</div>
				{/if}
				{#if sum.bestWin}
					<div>
						<dt>{t('stats.hist.bestWin')}</dt>
						<dd>{sum.bestWin.rating}<small>{sum.bestWin.opponent}</small></dd>
					</div>
				{/if}
				{#if sum.winStreak > 1}
					<div>
						<dt>{t('stats.hist.streak')}</dt>
						<dd>{sum.winStreak}<small>{t('stats.hist.streakSub')}</small></dd>
					</div>
				{/if}
			</dl>
		{/if}

		{#if series.key !== 'puzzle' && months.length > 1}
			<h3>{t('stats.hist.months')}</h3>
			<table class="months">
				<thead>
					<tr>
						<th>{t('stats.hist.month')}</th>
						<th>{t('stats.hist.end')}</th>
						<th>±</th>
						<th>{t('stats.hist.games')}</th>
						<th>{t('stats.hist.score')}</th>
					</tr>
				</thead>
				<tbody>
					{#each allMonths ? months : months.slice(0, 6) as m (m.month)}
						<tr>
							<td>{fmtMonth(m.month)}</td>
							<td><b>{m.end}</b></td>
							<td class:up={m.change > 0} class:down={m.change < 0}>{signed(m.change)}</td>
							<td>{m.games}</td>
							<td>{m.score}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if months.length > 6}
				<button class="more" onclick={() => (allMonths = !allMonths)}
					>{allMonths
						? t('stats.hist.less')
						: t('stats.hist.allMonths', { n: months.length })}</button
				>
			{/if}
		{/if}
	</div>
{:else}
	<p class="muted">{t('stats.noRating')}</p>
	<a class="btn secondary" href={resolve('/import')}>{t('stats.linkAccount')}</a>
{/if}

<style>
	.rh {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.chips {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 -0.2rem;
		padding: 0 0.2rem;
	}

	.chip b {
		margin-left: 0.25rem;
		font-variant-numeric: tabular-nums;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.cur {
		font-family: var(--font-num);
		font-size: 2.3rem;
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.chg {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-left: 0.4rem;
		font-weight: 750;
		color: var(--bad);
	}

	.chg.up {
		color: var(--good-text);
	}

	.lab {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.82rem;
		color: var(--text-2);
	}

	.note {
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.chart {
		position: relative;
		touch-action: pan-y;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}

	.peak {
		stroke: var(--rc);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.55;
	}

	.tick {
		font-size: 9.5px;
		fill: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.line {
		fill: none;
		stroke: var(--rc);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.pt {
		fill: var(--text-3);
		stroke: var(--surface);
		stroke-width: 1;
	}

	.pt.w {
		fill: var(--good);
	}

	.pt.l {
		fill: var(--bad);
	}

	.end {
		fill: var(--rc);
		stroke: var(--surface);
		stroke-width: 2;
	}

	.cross {
		stroke: var(--text-3);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}

	.tip {
		position: absolute;
		top: -0.4rem;
		transform: translate(-50%, -100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.35rem 0.6rem;
		border-radius: 10px;
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-2, var(--shadow-1));
		font-size: 0.75rem;
		color: var(--text-2);
		white-space: nowrap;
		pointer-events: none;
		z-index: 2;
	}

	.tip b {
		font-size: 1rem;
		color: var(--text);
	}

	.res.w {
		color: var(--good-text);
	}

	.res.l {
		color: var(--bad);
	}

	.legend-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.legend-row span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.sw {
		display: inline-block;
	}

	.peakline {
		width: 14px;
		border-top: 1.5px dashed var(--rc);
	}

	.sw.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-3);
	}

	.sw.dot.w {
		background: var(--good);
	}

	.sw.dot.l {
		background: var(--bad);
	}

	.kpis {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0;
	}

	@media (min-width: 700px) {
		.kpis {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	/* ungerade Anzahl in zwei Spalten: letzte Kachel über die volle Breite */
	@media (max-width: 699px) {
		.kpis div:last-child:nth-child(odd) {
			grid-column: span 2;
		}
	}

	.kpis div {
		min-width: 0;
		padding: 0.6rem 0.75rem;
		border-radius: 12px;
		background: var(--surface-2);
	}

	dt {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-2);
	}

	dd {
		margin: 0.15rem 0 0;
		font-family: var(--font-num);
		font-size: 1.3rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	dd small {
		display: block;
		font-family: var(--font-body, inherit);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	h3 {
		font-size: 0.95rem;
		margin-top: 0.3rem;
	}

	.months {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.86rem;
		font-variant-numeric: tabular-nums;
	}

	.months th {
		text-align: left;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-2);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0 0.3rem 0.35rem;
	}

	.months td {
		padding: 0.4rem 0.3rem;
		border-top: 1px solid var(--line);
	}

	.months td.up {
		color: var(--good-text);
		font-weight: 700;
	}

	.months td.down {
		color: var(--bad);
		font-weight: 700;
	}

	.more {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--accent);
		cursor: pointer;
	}
</style>
