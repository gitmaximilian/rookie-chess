<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import Info from '@lucide/svelte/icons/info';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ProfileTabs from '#lib/ui/ProfileTabs.svelte';
	import RatingChart from '#lib/ui/RatingChart.svelte';
	import { db } from '#lib/db/db.js';
	import { loadOpenings, openingFor } from '#lib/data/openings.js';
	import {
		computeStats,
		insights as findInsights,
		type GameStats,
		type Insight,
		type WDL
	} from '#lib/training/gamestats.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let stats = $state<GameStats | null>(null);
	let list = $state<Insight[]>([]);
	let series = $state(0);

	onMount(async () => {
		try {
			await loadOpenings();
		} catch {
			/* offline ohne Eröffnungsnamen */
		}
		const games = await db.games.toArray();
		stats = computeStats(games, (m) => openingFor(m)?.name ?? null);
		list = findInsights(stats);
	});

	function insightText(i: Insight): string {
		const p = { ...i.params };
		if (i.key === 'weakPhase') p.phase = t(`stats.phase.${p.phase}`);
		if (i.key === 'motif') p.motif = t(`stats.motif.${p.motif}`);
		return t(`stats.insight.${i.key}`, p);
	}

	const speedName = (k: string) => {
		const s = t(`stats.speed.${k}`);
		return s.startsWith('stats.') ? k : s;
	};

	const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);
	const accColor = (a: number | null) =>
		a === null ? 'var(--text-3)' : a >= 80 ? 'var(--good)' : a >= 65 ? 'var(--warn)' : 'var(--bad)';
</script>

<svelte:head><title>{t('stats.title')} – Rookie</title></svelte:head>

{#snippet wdlBar(w: WDL)}
	<div
		class="wdl"
		role="img"
		aria-label="{t('stats.win')} {w.w}, {t('stats.draw')} {w.d}, {t('stats.loss')} {w.l}"
	>
		{#if w.w}<span class="w" style:flex={w.w}>{w.w}</span>{/if}
		{#if w.d}<span class="d" style:flex={w.d}>{w.d}</span>{/if}
		{#if w.l}<span class="l" style:flex={w.l}>{w.l}</span>{/if}
	</div>
{/snippet}

{#snippet wdlRow(label: string, w: WDL)}
	<li class="row">
		<div class="row-head">
			<b>{label}</b>
			<span>{t('stats.games', { n: w.n })} · <b>{t('stats.score', { pct: w.score })}</b></span>
		</div>
		{@render wdlBar(w)}
	</li>
{/snippet}

<PageHeader
	eyebrow={t('profile.eyebrow')}
	title={t('stats.title')}
	subtitle={t('stats.subtitle')}
/>
<ProfileTabs active="stats" />

{#if !stats}
	<div class="wrap" aria-busy="true">
		<div class="skeleton" style:height="140px"></div>
		<div class="skeleton" style:height="220px"></div>
		<div class="skeleton" style:height="220px"></div>
	</div>
{:else}
	<div class="wrap">
		<!-- Erkenntnisse -->
		<section class="card block insights">
			<h2><Sparkles size={18} /> {t('stats.insights')}</h2>
			{#if list.length}
				<ul>
					{#each list as i, n (i.key)}
						<li class={i.kind} style:--i={n}>
							<span class="ins-ico">
								{#if i.kind === 'good'}<TrendingUp
										size={16}
									/>{:else if i.kind === 'bad'}<TrendingDown size={16} />{:else}<Info
										size={16}
									/>{/if}
							</span>
							{insightText(i)}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">{t('stats.noInsights')}</p>
			{/if}
		</section>

		<!-- Ergebnisse -->
		<div class="duo">
			<section class="card block">
				<h2>{t('stats.results')}</h2>
				<div class="big">
					<span class="big-n">{stats.total.score}<small>%</small></span>
					<span class="muted">{t('stats.games', { n: stats.total.n })}</span>
				</div>
				{@render wdlBar(stats.total)}
				<div class="legend">
					<span><i class="w"></i>{t('stats.win')}</span>
					<span><i class="d"></i>{t('stats.draw')}</span>
					<span><i class="l"></i>{t('stats.loss')}</span>
				</div>
				<ul class="rows">
					{@render wdlRow(t('stats.asWhite'), stats.byColor.white)}
					{@render wdlRow(t('stats.asBlack'), stats.byColor.black)}
				</ul>
			</section>

			<section class="card block">
				<h2>{t('stats.bySource')}</h2>
				<ul class="rows">
					{#each stats.bySource as s (s.key)}
						{@render wdlRow(t(`stats.source.${s.key}`), s.wdl)}
					{/each}
				</ul>
				{#if stats.bySpeed.length}
					<h3>{t('stats.bySpeed')}</h3>
					<ul class="rows">
						{#each stats.bySpeed as s (s.key)}
							{@render wdlRow(speedName(s.key), s.wdl)}
						{/each}
					</ul>
				{/if}
				{#if stats.vsStrength.length}
					<h3>{t('stats.vsStrength')}</h3>
					<ul class="rows">
						{#each stats.vsStrength as s (s.key)}
							{@render wdlRow(t(`stats.strength.${s.key}`), s.wdl)}
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<!-- Online-Wertung -->
		<section class="card block">
			<h2>{t('stats.rating')}</h2>
			{#if stats.ratingSeries.length}
				{#if stats.ratingSeries.length > 1}
					<div class="chips">
						{#each stats.ratingSeries as s, i (s.key)}
							<button class="chip" class:on={series === i} onclick={() => (series = i)}
								>{t(`stats.source.${s.source}`)} · {speedName(s.speed)}</button
							>
						{/each}
					</div>
				{/if}
				{@const cur = stats.ratingSeries[series] ?? stats.ratingSeries[0]}
				<div class="big">
					<span class="big-n">{cur.points.at(-1)!.rating}</span>
					<span class="muted">{t(`stats.source.${cur.source}`)} · {speedName(cur.speed)}</span>
				</div>
				<RatingChart points={cur.points} color="var(--c-play)" />
			{:else}
				<p class="muted">{t('stats.noRating')}</p>
				<a class="btn secondary small-btn" href={resolve('/import')}>{t('stats.linkAccount')}</a>
			{/if}
		</section>

		<!-- Eröffnungen -->
		<section class="card block">
			<h2>{t('stats.openings')}</h2>
			{#if stats.openings.length}
				<div class="duo inner">
					{#each ['white', 'black'] as const as c (c)}
						<div>
							<h3>
								<span class="sw {c}"></span>{c === 'white'
									? t('stats.asWhite')
									: t('stats.asBlack')}
							</h3>
							<ul class="rows">
								{#each stats.openings.filter((o) => o.color === c).slice(0, 6) as o (o.name)}
									{@render wdlRow(o.name, o)}
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			{:else}
				<p class="muted">{t('stats.noOpenings')}</p>
			{/if}
		</section>

		<!-- Zugqualität -->
		<section class="card block">
			<h2>{t('stats.quality')}</h2>
			{#if stats.analysed}
				<p class="muted">{t('stats.fromAnalysed', { n: stats.analysed })}</p>
				<div class="tiles">
					<div class="tile">
						<span class="t-val" style:color={accColor(stats.accuracy)}>{stats.accuracy}%</span>
						<span class="t-lab">{t('stats.accuracy')}</span>
					</div>
					{#if stats.accuracyRecent !== null}
						<div class="tile">
							<span class="t-val" style:color={accColor(stats.accuracyRecent)}
								>{stats.accuracyRecent}%</span
							>
							<span class="t-lab">{t('stats.accuracy')} · {t('stats.last10')}</span>
						</div>
					{/if}
					<div class="tile">
						<span class="t-val bad">{stats.perGame.blunders}</span>
						<span class="t-lab">{t('stats.blunders')} · {t('stats.perGame')}</span>
					</div>
					<div class="tile">
						<span class="t-val warn">{stats.perGame.mistakes}</span>
						<span class="t-lab">{t('stats.mistakes')} · {t('stats.perGame')}</span>
					</div>
				</div>

				<div class="duo inner">
					<div>
						<h3>{t('stats.phases')}</h3>
						<ul class="bars">
							{#each ['opening', 'middlegame', 'endgame'] as const as ph (ph)}
								{@const a = stats.phaseAccuracy[ph]}
								<li>
									<span class="b-lab">{t(`stats.phase.${ph}`)}</span>
									<span class="b-track"
										><span style:width="{a ?? 0}%" style:background={accColor(a)}></span></span
									>
									<span class="b-val">{a === null ? '–' : `${a}%`}</span>
								</li>
							{/each}
						</ul>
					</div>
					<div>
						<h3>{t('stats.motifs')}</h3>
						{#if stats.motifs.length}
							<ul class="bars">
								{#each stats.motifs.slice(0, 5) as m (m.motif)}
									<li>
										<span class="b-lab">{t(`stats.motif.${m.motif}`)}</span>
										<span class="b-track"
											><span class="motif" style:width="{pct(m.n, stats.motifs[0].n)}%"
											></span></span
										>
										<span class="b-val">{m.n}</span>
									</li>
								{/each}
							</ul>
							<a class="btn small-btn" href={resolve('/puzzles?mode=mistakes')}
								>{t('stats.practise')}</a
							>
						{:else}
							<p class="muted">–</p>
						{/if}
					</div>
				</div>
			{:else}
				<p class="muted">{t('stats.noAnalysis')}</p>
			{/if}
		</section>

		<!-- Partieenden -->
		<section class="card block">
			<h2>{t('stats.endings')}</h2>
			<p class="muted">{t('stats.avgMoves', { n: stats.avgMoves })}</p>
			<ul class="bars">
				{#each ['mate', 'resign', 'time', 'draw'] as const as e (e)}
					<li>
						<span class="b-lab">{t(`stats.ending.${e}`)}</span>
						<span class="b-track"
							><span class="ending" style:width="{pct(stats.endings[e], stats.total.n)}%"
							></span></span
						>
						<span class="b-val">{stats.endings[e]}</span>
					</li>
				{/each}
			</ul>
		</section>
	</div>
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 1040px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.1rem 1.25rem;
	}

	.block h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 1.1rem;
	}

	h3 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-2);
		margin-top: 0.4rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.duo {
		display: grid;
		gap: 0.75rem;
	}

	@media (min-width: 860px) {
		.duo {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}

	.duo.inner {
		gap: 1.25rem;
	}

	.insights ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.insights li {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 0.65rem 0.75rem;
		border-radius: 12px;
		background: var(--surface-2);
		line-height: 1.45;
		animation: rise 380ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 60ms);
	}

	.ins-ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 8px;
		color: var(--text-2);
		background: var(--surface);
	}

	.insights li.good .ins-ico {
		color: var(--good);
	}

	.insights li.bad .ins-ico {
		color: var(--bad);
	}

	.big {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.big-n {
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 750;
		line-height: 1;
	}

	.big-n small {
		font-size: 1.2rem;
		margin-left: 1px;
	}

	.wdl {
		display: flex;
		gap: 2px;
		height: 22px;
		border-radius: 7px;
		overflow: hidden;
		background: var(--surface-2);
	}

	.wdl span {
		display: grid;
		place-items: center;
		min-width: 18px;
		font-size: 0.72rem;
		font-weight: 700;
		color: #fff;
	}

	.wdl .w,
	.legend .w {
		background: var(--good);
	}

	.wdl .d,
	.legend .d {
		background: color-mix(in srgb, var(--text-3) 70%, var(--surface-2));
	}

	.wdl .l,
	.legend .l {
		background: var(--bad);
	}

	.legend {
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.legend i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.row-head {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.3rem;
		font-size: 0.92rem;
	}

	.row-head > b {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-head span {
		flex: none;
		font-size: 0.82rem;
		color: var(--text-2);
	}

	.row-head span b {
		color: var(--text);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		height: 32px;
		padding: 0 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--text-2);
		font-weight: 600;
		font-size: 0.82rem;
		cursor: pointer;
	}

	.chip.on {
		background: var(--text);
		color: var(--bg);
		border-color: var(--text);
	}

	.sw {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid var(--line-strong);
	}

	.sw.white {
		background: #fff;
	}

	.sw.black {
		background: #222;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	@media (min-width: 700px) {
		.tiles {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.75rem 0.85rem;
		border-radius: 14px;
		background: var(--surface-2);
	}

	.t-val {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 750;
	}

	.t-val.bad {
		color: var(--bad);
	}

	.t-val.warn {
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
	}

	.t-lab {
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.bars li {
		display: grid;
		grid-template-columns: 7.5rem 1fr 2.6rem;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.88rem;
	}

	.b-track {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.b-track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		transition: width 600ms var(--ease-out);
	}

	.b-track .motif {
		background: var(--bad);
	}

	.b-track .ending {
		background: var(--c-analysis);
	}

	.b-val {
		text-align: right;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}

	.small-btn {
		align-self: flex-start;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
