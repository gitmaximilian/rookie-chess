<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Target from '@lucide/svelte/icons/target';
	import Bomb from '@lucide/svelte/icons/bomb';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Flame from '@lucide/svelte/icons/flame';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Play from '@lucide/svelte/icons/play';
	import Square from '@lucide/svelte/icons/square';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import CoachTabs from '#lib/ui/CoachTabs.svelte';
	import AvatarButton from '#lib/ui/AvatarButton.svelte';
	import RatingHistory from '#lib/ui/RatingHistory.svelte';
	import SkillRadar from '#lib/ui/SkillRadar.svelte';
	import AccuracyTrend, { type AccPoint } from '#lib/ui/AccuracyTrend.svelte';
	import { skillProfile, weakestSkill, type SkillValue } from '#lib/training/skills.js';
	import { quality } from '#lib/import/ratings.js';
	import { db } from '#lib/db/db.js';
	import { loadOpenings, openingFor } from '#lib/data/openings.js';
	import {
		computeStats,
		insights as findInsights,
		outcomeOf,
		type GameStats,
		type Insight,
		type Motif,
		type Outcome
	} from '#lib/training/gamestats.js';
	import { themeStats, weakest } from '#lib/training/stats.js';
	import { themeName } from '#lib/data/themes.js';
	import { getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { currentStrength } from '#lib/training/planData.js';
	import { getLinked, syncState, analyseBatch, pauseBackground } from '#lib/import/sync.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	interface Advice {
		icon: typeof Target;
		title: string;
		text: string;
		href: string;
		cta: string;
		c: string;
	}

	interface Data {
		name: string;
		games: number;
		stats: GameStats;
		last: { id: number; o: Outcome }[];
		rating: { value: number; label: string; delta: number | null } | null;
		strength: number | null;
		puzzle: { rating: number; provisional: boolean };
		mistakes: number;
		advice: Advice[];
		notes: Insight[];
		puzzleHist: { date: number; rating: number }[];
		skills: SkillValue[];
		accuracy: AccPoint[];
		coverage: { done: number; total: number };
	}

	let d = $state<Data | null>(null);

	/** Puzzle-Thema, mit dem man eine typische Fehlerart trainiert */
	const MOTIF_THEME: Partial<Record<Motif, string>> = {
		hanging: 'hangingPiece',
		fork: 'fork',
		'mate-missed': 'mateIn2',
		'mate-allowed': 'mateIn2',
		'missed-win': 'hangingPiece'
	};

	const speedName = (k: string) => {
		const s = t(`stats.speed.${k}`);
		return s.startsWith('stats.') ? k : s;
	};

	let busy = false;
	let again = false;
	/** Daten laden; läuft während einer Analyse mehrfach – überlappende Aufrufe werden zusammengefasst */
	async function load() {
		if (busy) {
			again = true;
			return;
		}
		busy = true;
		try {
			await loadNow();
		} finally {
			busy = false;
			if (again) {
				again = false;
				void load();
			}
		}
	}

	async function loadNow() {
		try {
			await loadOpenings();
		} catch {
			/* offline: ohne Eröffnungsnamen */
		}
		const [games, attempts, puzzle, strength, linked, mistakes, ratingRows] = await Promise.all([
			db.games.toArray(),
			db.puzzleAttempts.toArray(),
			getPuzzleRating(),
			currentStrength(),
			getLinked(),
			db.mistakes.count(),
			db.ratings.orderBy('date').toArray()
		]);
		// nur Partien, die sich analysieren lassen (beendet, mehr als ein paar Züge)
		const analysable = games.filter((g) => g.result !== '*' && g.moves.length >= 6);
		const stats = computeStats(games, (m) => openingFor(m)?.name ?? null);
		const sorted = [...games].sort((a, b) => b.date - a.date);
		const last = sorted
			.map((g) => ({ id: g.id!, o: outcomeOf(g) }))
			.filter((x): x is { id: number; o: Outcome } => x.o !== null)
			.slice(0, 30);

		// Hauptwertung: die Online-Reihe mit den meisten Partien; Veränderung über 30 Tage
		const main = [...stats.ratingSeries].sort((a, b) => b.points.length - a.points.length)[0];
		let rating: Data['rating'] = null;
		if (main) {
			const pts = main.points;
			const now = pts[pts.length - 1];
			const before = [...pts].reverse().find((p) => p.date <= now.date - 30 * 86_400_000);
			rating = {
				value: now.rating,
				label: `${t(`stats.source.${main.source}`)} · ${speedName(main.speed)}`,
				delta: before ? now.rating - before.rating : null
			};
		}

		// Woran arbeiten? Konkrete Schritte mit Knopf – die wichtigsten zuerst
		const advice: Advice[] = [];
		if (mistakes > 0)
			advice.push({
				icon: Target,
				title: t('coachTab.adv.mistakesTitle', { n: mistakes }),
				text: t('coachTab.adv.mistakesText'),
				href: resolve('/puzzles?mode=mistakes'),
				cta: t('coachTab.adv.practise'),
				c: 'var(--bad)'
			});
		const top = stats.motifs.find((m) => m.motif !== 'positional');
		if (top && top.n >= 2) {
			const theme = MOTIF_THEME[top.motif];
			advice.push({
				icon: Bomb,
				title: t('coachTab.adv.motifTitle', { motif: t(`stats.motif.${top.motif}`), n: top.n }),
				text: t(`coachTab.adv.motif.${top.motif}`),
				href: theme ? resolve(`/puzzles?theme=${theme}`) : resolve('/puzzles'),
				cta: t('coachTab.adv.train'),
				c: 'var(--warn)'
			});
		}
		const weakTheme = weakest(themeStats(attempts), 1)[0];
		if (weakTheme)
			advice.push({
				icon: Puzzle,
				title: t('coachTab.adv.themeTitle', {
					theme: themeName(weakTheme.theme),
					pct: Math.round(weakTheme.rate * 100)
				}),
				text: t('coachTab.adv.themeText'),
				href: resolve(`/puzzles?theme=${weakTheme.theme}`),
				cta: t('coachTab.adv.train'),
				c: 'var(--c-puzzle)'
			});
		const phases = (Object.entries(stats.phaseAccuracy) as [string, number | null][]).filter(
			(e): e is [string, number] => e[1] !== null
		);
		if (phases.length >= 2) {
			const [weak] = [...phases].sort((a, b) => a[1] - b[1]);
			const [strong] = [...phases].sort((a, b) => b[1] - a[1]);
			if (strong[1] - weak[1] >= 5)
				advice.push({
					icon: ChartLine,
					title: t('coachTab.adv.phaseTitle', { phase: t(`stats.phase.${weak[0]}`), acc: weak[1] }),
					text: t(`coachTab.adv.phase.${weak[0]}`),
					href:
						weak[0] === 'opening'
							? resolve('/learn/openings')
							: weak[0] === 'endgame'
								? resolve('/learn')
								: resolve('/puzzles'),
					cta: t('coachTab.adv.train'),
					c: 'var(--c-learn)'
				});
		}
		if (!games.length)
			advice.push({
				icon: ChessKnight,
				title: t('coachTab.adv.playTitle'),
				text: t('coachTab.adv.playText'),
				href: resolve('/play'),
				cta: t('coachTab.adv.play'),
				c: 'var(--c-play)'
			});

		d = {
			name: linked.lichess || linked.chesscom || '',
			games: games.length,
			stats,
			last,
			rating,
			strength: strength?.value ?? null,
			puzzle: { rating: Math.round(puzzle.rating), provisional: isProvisional(puzzle) },
			mistakes,
			advice: advice.slice(0, 3),
			// Erkenntnisse, die nicht schon als Ratschlag oben stehen
			notes: findInsights(stats).filter((i) => i.key !== 'motif' && i.key !== 'weakPhase'),
			puzzleHist: ratingRows.map((r) => ({ date: r.date, rating: Math.round(r.rating) })),
			skills: skillProfile(stats),
			// Genauigkeit der letzten 20 analysierten Partien, älteste links
			accuracy: sorted
				.map((g) => {
					const q = quality(g);
					const o = outcomeOf(g);
					return q && o
						? { id: g.id!, date: g.date, accuracy: q.accuracy, opponent: g.opponent, result: o }
						: null;
				})
				.filter((x): x is AccPoint => x !== null)
				.slice(0, 20)
				.reverse(),
			coverage: {
				done: analysable.filter((g) => g.analysis?.done).length,
				total: analysable.length
			}
		};
	}

	onMount(load);
	// während einer Analyse das Profil nach jeder fertigen Partie auffrischen
	$effect(() => {
		void syncState.batchDone;
		void syncState.analysing;
		untrack(() => {
			if (d) void load();
		});
	});

	const pendingN = $derived(d ? d.coverage.total - d.coverage.done : 0);

	const counts = $derived.by(() => {
		const c = { w: 0, d: 0, l: 0, streak: 0 };
		if (!d) return c;
		for (const x of d.last) c[x.o]++;
		for (const x of d.last) {
			if (x.o !== 'w') break;
			c.streak++;
		}
		return c;
	});
	const winRate = $derived(
		d && d.last.length ? Math.round(((counts.w + counts.d / 2) / d.last.length) * 100) : null
	);
	const accTrend = $derived(
		d && d.stats.accuracyRecent !== null && d.stats.accuracyPrevious !== null
			? d.stats.accuracyRecent - d.stats.accuracyPrevious
			: null
	);

	function noteText(i: Insight): string {
		return t(`stats.insight.${i.key}`, { ...i.params });
	}

	const weakSkill = $derived(d ? weakestSkill(d.skills) : null);
	const SKILL_HREF: Record<string, string> = {
		opening: resolve('/learn/openings'),
		middlegame: resolve('/puzzles'),
		tactics: resolve('/puzzles'),
		endgame: resolve('/learn'),
		safety: resolve('/puzzles?mode=mistakes')
	};

	const motifMax = $derived(d ? Math.max(1, ...d.stats.motifs.map((m) => m.n)) : 1);
	const outcomeLabel = (o: Outcome) =>
		t(o === 'w' ? 'stats.win' : o === 'd' ? 'stats.draw' : 'stats.loss');
</script>

<svelte:head><title>{t('coachTab.title')} – Rookie</title></svelte:head>

<PageHeader
	eyebrow={t('coachTab.eyebrow')}
	title={t('coachTab.title')}
	subtitle={t('coachTab.subtitle')}
>
	{#snippet action()}<AvatarButton />{/snippet}
</PageHeader>
<CoachTabs active="overview" />

{#snippet coverage()}
	{#if d && d.coverage.total}
		{@const c = d.coverage}
		<div class="cov" class:run={syncState.analysing}>
			<div class="cov-head">
				<b>{t('skills.coverage', { n: c.done, m: c.total })}</b>
				{#if c.total}<span class="cov-pct">{Math.round((c.done / c.total) * 100)}%</span>{/if}
			</div>
			<div
				class="cov-bar"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={c.total}
				aria-valuenow={c.done}
				aria-label={t('skills.coverage', { n: c.done, m: c.total })}
			>
				<span style:width="{c.total ? (c.done / c.total) * 100 : 0}%"></span>
			</div>
			{#if syncState.analysing && syncState.batchTotal}
				<p class="cov-text">
					{t('skills.running', { n: syncState.batchDone, m: syncState.batchTotal })}
					{t('skills.keepOpen')}
				</p>
				<button class="btn small secondary" onclick={pauseBackground}
					><Square size={13} /> {t('skills.stop')}</button
				>
			{:else if pendingN > 0}
				<p class="cov-text">{t('skills.onlyAnalysed', { n: pendingN })}</p>
				<div class="cov-btns">
					<button
						class="btn small"
						onclick={() => void analyseBatch(10)}
						disabled={syncState.analysing}
						><Play size={14} /> {t('skills.analyseNext', { n: Math.min(10, pendingN) })}</button
					>
					{#if pendingN > 10}
						<button
							class="btn small secondary"
							onclick={() => void analyseBatch(pendingN)}
							disabled={syncState.analysing}>{t('skills.analyseAll', { n: pendingN })}</button
						>
					{/if}
				</div>
			{:else if c.total}
				<p class="cov-text ok">{t('skills.allDone')}</p>
			{/if}
		</div>
	{/if}
{/snippet}

{#if !d}
	<div class="wrap" aria-busy="true">
		<div class="skeleton" style:height="230px"></div>
		<div class="skeleton" style:height="160px"></div>
		<div class="skeleton" style:height="260px"></div>
	</div>
{:else}
	<div class="wrap">
		<!-- Wie du spielst -->
		<section class="card block how">
			<div class="who">
				<span class="who-ini" aria-hidden="true">{(d.name || 'R')[0].toUpperCase()}</span>
				<div>
					<b class="who-name">{d.name || t('coachTab.you')}</b>
					<span class="muted">
						{t('coachTab.gamesCount', { n: d.games })}{#if d.strength}
							· {t('coachTab.strength', { n: d.strength })}{/if}
					</span>
				</div>
			</div>

			<h2>{t('coachTab.how')}</h2>
			<ul class="kpis">
				{#if d.rating}
					<li>
						<span class="k-ico"><TrendingUp size={17} /></span>
						<span class="k-lbl">{t('coachTab.rating')}<small>{d.rating.label}</small></span>
						<b class="k-val">{d.rating.value}</b>
						{#if d.rating.delta !== null}
							<span class="chip" class:up={d.rating.delta >= 0} class:down={d.rating.delta < 0}
								>{#if d.rating.delta >= 0}<TrendingUp size={13} /> +{:else}<TrendingDown
										size={13}
									/>{/if}{d.rating.delta}</span
							>
						{:else}<span></span>{/if}
					</li>
				{/if}
				<li>
					<span class="k-ico"><Trophy size={17} /></span>
					<span class="k-lbl"
						>{t('coachTab.winRate')}{#if d.last.length}<small
								>{t('coachTab.lastN', { n: d.last.length })}</small
							>{/if}</span
					>
					<b class="k-val">{winRate === null ? '–' : `${winRate}%`}</b>
					<span></span>
				</li>
				<li>
					<span class="k-ico"><Target size={17} /></span>
					<span class="k-lbl">{t('coachTab.accuracy')}<small>{t('coachTab.last10')}</small></span>
					<b class="k-val">{d.stats.accuracyRecent === null ? '–' : `${d.stats.accuracyRecent}%`}</b
					>
					{#if accTrend !== null && accTrend !== 0}
						<span class="chip" class:up={accTrend > 0} class:down={accTrend < 0}
							>{accTrend > 0 ? '+' : ''}{accTrend}</span
						>
					{:else}<span></span>{/if}
				</li>
				<li>
					<span class="k-ico"><Bomb size={17} /></span>
					<span class="k-lbl">{t('coachTab.blunders')}<small>{t('coachTab.perGame')}</small></span>
					<b class="k-val">{d.stats.analysed ? d.stats.perGame.blunders.toFixed(1) : '–'}</b>
					<span></span>
				</li>
				<li>
					<span class="k-ico"><Puzzle size={17} /></span>
					<span class="k-lbl">{t('coachTab.puzzle')}</span>
					<b class="k-val">{d.puzzle.rating}{d.puzzle.provisional ? '?' : ''}</b>
					<span></span>
				</li>
			</ul>
		</section>

		<!-- Spielerprofil als Fünfeck -->
		<section class="card block skills">
			<div class="sk-head">
				<h2>{t('skills.title')}</h2>
				<p class="muted">{t('skills.text', { n: d.stats.analysed })}</p>
			</div>
			{@render coverage()}
			<SkillRadar values={d.skills} />
			{#if weakSkill}
				<div class="sk-weak">
					<span
						>{t('skills.weakest', { name: t(`skills.name.${weakSkill.skill}`) })}
						<span class="muted">{t(`skills.tip.${weakSkill.skill}`)}</span></span
					>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- SKILL_HREF enthält resolve()-Pfade -->
					<a class="btn small" href={SKILL_HREF[weakSkill.skill]}
						>{t('coachTab.adv.train')} <ArrowRight size={15} /></a
					>
				</div>
			{:else}
				<p class="muted">{t('skills.needData', { n: d.stats.analysed })}</p>
			{/if}
		</section>

		<!-- Woran arbeiten -->
		{#if d.advice.length}
			<section class="card block advice">
				<h2>{t('coachTab.work')}</h2>
				<ul>
					{#each d.advice as a (a.title)}
						<li style:--c={a.c}>
							<span class="a-ico"><a.icon size={19} /></span>
							<span class="a-text"><b>{a.title}</b><span>{a.text}</span></span>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a.href ist bereits aufgelöst -->
							<a class="btn small a-go" href={a.href}>{a.cta} <ArrowRight size={15} /></a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Letzte 30 Partien -->
		{#if d.last.length}
			<section class="card block form">
				<h2>{t('coachTab.lastGames', { n: d.last.length })}</h2>
				<p class="legend">
					<span><i class="sq w"></i><b>{counts.w}</b> {t('coachTab.won')}</span>
					<span><i class="sq d"></i><b>{counts.d}</b> {t('coachTab.drawn')}</span>
					<span><i class="sq l"></i><b>{counts.l}</b> {t('coachTab.lost')}</span>
					{#if counts.streak >= 2}<span class="streak"
							><Flame size={15} /> <b>{counts.streak}</b> {t('coachTab.streak')}</span
						>{/if}
				</p>
				<div class="grid">
					<!-- älteste links, neueste rechts – wie ein Verlauf -->
					{#each [...d.last].reverse() as x, i (x.id)}
						<a
							class="sq {x.o}"
							class:newest={i === d.last.length - 1}
							href={resolve(`/analysis?game=${x.id}`)}
							aria-label={outcomeLabel(x.o)}
						></a>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Genauigkeit je Partie -->
		{#if d.accuracy.length >= 3}
			<section class="card block">
				<h2>{t('skills.trend')}</h2>
				<p class="muted">{t('skills.trendText', { n: d.accuracy.length })}</p>
				<AccuracyTrend points={d.accuracy} />
			</section>
		{/if}

		<!-- Typische Fehler -->
		{#if d.stats.motifs.length}
			<section class="card block motifs">
				<h2>{t('coachTab.typical')}</h2>
				<p class="muted">{t('coachTab.typicalText', { n: d.stats.analysed })}</p>
				<ul>
					{#each d.stats.motifs.slice(0, 5) as m (m.motif)}
						<li>
							<span class="m-row"><b>{t(`stats.motif.${m.motif}`)}</b><span>{m.n}×</span></span>
							<span class="bar"><span style:width="{(m.n / motifMax) * 100}%"></span></span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Wertungsverlauf -->
		{#if d.stats.ratingSeries.length || d.puzzleHist.length > 1}
			<section class="card block">
				<h2>{t('stats.rating')}</h2>
				<RatingHistory online={d.stats.ratingSeries} puzzle={d.puzzleHist} />
			</section>
		{/if}

		{#if d.notes.length}
			<section class="card block notes">
				<h2>{t('coachTab.notes')}</h2>
				<ul>
					{#each d.notes as n (n.key)}
						<li class={n.kind}>{noteText(n)}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<a class="all card pressable" href={resolve('/coach/stats')}>
			<span><b>{t('coachTab.allStats')}</b><span>{t('coachTab.allStatsText')}</span></span>
			<ArrowRight size={18} />
		</a>
	</div>
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 860px;
		margin-top: 1rem;
	}

	.block {
		padding: 1.05rem 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	h2 {
		font-size: 1.1rem;
	}

	.muted {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	/* Wer & wie */
	.who {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--line);
	}

	.who-ini {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--surface-2);
		font-family: var(--font-display);
		font-weight: 750;
		font-size: 1.25rem;
		color: var(--text-2);
	}

	.who div {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.who-name {
		font-family: var(--font-display);
		font-size: 1.35rem;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.kpis {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.kpis li {
		display: grid;
		grid-template-columns: 28px 1fr auto 4.6rem;
		align-items: center;
		gap: 0.55rem;
		min-height: 52px;
		border-top: 1px solid var(--line);
	}

	.kpis li:first-child {
		border-top: none;
	}

	.k-ico {
		color: var(--text-3);
		display: grid;
	}

	.k-lbl {
		display: flex;
		flex-direction: column;
		font-size: 0.95rem;
		line-height: 1.25;
	}

	.k-lbl small {
		font-size: 0.74rem;
		color: var(--text-3);
	}

	.k-val {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.chip {
		justify-self: end;
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		font-size: 0.82rem;
		font-weight: 750;
		font-variant-numeric: tabular-nums;
	}

	.chip.up {
		background: color-mix(in srgb, var(--good) 14%, transparent);
		color: var(--good-text);
	}

	.chip.down {
		background: color-mix(in srgb, var(--bad) 13%, transparent);
		color: var(--bad-text);
	}

	/* Wie viele Partien einfließen */
	.cov {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.8rem 0.9rem;
		border-radius: var(--radius-m);
		background: var(--surface-2);
	}

	.cov-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.cov-pct {
		font-family: var(--font-display);
		font-weight: 750;
		color: var(--c-coach);
	}

	.cov-bar {
		height: 8px;
		border-radius: 999px;
		background: var(--surface);
		overflow: hidden;
	}

	.cov-bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--c-coach);
		transition: width 400ms var(--ease-out);
	}

	.cov.run .cov-bar span {
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.6;
		}
	}

	.cov-text {
		font-size: 0.85rem;
		line-height: 1.4;
		color: var(--text-2);
	}

	.cov-text.ok {
		color: var(--good-text);
		font-weight: 650;
	}

	.cov-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.cov .btn {
		align-self: flex-start;
		gap: 0.35rem;
	}

	/* Spielerprofil */
	.sk-head {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.sk-weak {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.7rem 0.8rem;
		border-radius: var(--radius-m);
		background: var(--c-coach-soft);
		font-weight: 650;
		font-size: 0.92rem;
	}

	.sk-weak > span {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.sk-weak .btn {
		flex: none;
		gap: 0.3rem;
	}

	/* Ratschläge */
	.advice {
		border: 1.5px solid color-mix(in srgb, var(--c-coach) 35%, transparent);
		background:
			radial-gradient(120% 120% at 100% 0%, var(--c-coach-soft), transparent 65%), var(--surface);
	}

	.advice ul,
	.motifs ul,
	.notes ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.advice li {
		display: grid;
		grid-template-columns: 40px 1fr;
		gap: 0.15rem 0.75rem;
		align-items: start;
		padding: 0.75rem;
		border-radius: var(--radius-m);
		background: var(--surface);
		border: 1px solid var(--line);
	}

	.a-ico {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--c) 15%, transparent);
		color: var(--c);
	}

	.a-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		line-height: 1.35;
	}

	.a-text span {
		font-size: 0.86rem;
		color: var(--text-2);
	}

	.a-go {
		grid-column: 2;
		justify-self: start;
		margin-top: 0.45rem;
		gap: 0.3rem;
	}

	/* Form */
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.legend b {
		color: var(--text);
	}

	.legend .sq {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.streak {
		color: var(--accent);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 5px;
	}

	.sq {
		display: block;
		aspect-ratio: 1;
		border-radius: 5px;
		background: color-mix(in srgb, var(--text-3) 55%, var(--surface-2));
	}

	.sq.w {
		background: var(--good);
	}

	.sq.l {
		background: color-mix(in srgb, var(--bad) 80%, var(--surface));
	}

	.sq.newest {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--text);
	}

	/* Typische Fehler */
	.motifs li {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.m-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.92rem;
	}

	.m-row span {
		font-weight: 700;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 7px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--warn);
	}

	.notes li {
		position: relative;
		padding-left: 1rem;
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.notes li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.5em;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-3);
	}

	.notes li.good::before {
		background: var(--good);
	}

	.notes li.bad::before {
		background: var(--bad);
	}

	.all {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.95rem 1.1rem;
		color: var(--text);
	}

	.all > span {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.all > span span {
		font-size: 0.85rem;
		color: var(--text-2);
	}
</style>
