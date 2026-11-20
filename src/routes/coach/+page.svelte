<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Target from '@lucide/svelte/icons/target';
	import Bomb from '@lucide/svelte/icons/bomb';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Play from '@lucide/svelte/icons/play';
	import Square from '@lucide/svelte/icons/square';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import CoachTabs from '#lib/ui/CoachTabs.svelte';
	import AvatarButton from '#lib/ui/AvatarButton.svelte';
	import SkillPenta from '#lib/ui/SkillPenta.svelte';
	import LevelFocus from '#lib/ui/LevelFocus.svelte';
	import CoachHistory from '#lib/ui/CoachHistory.svelte';
	import { coachHistory, type CoachHistoryPoint } from '#lib/training/coachHistory.js';
	import ProgressCheck from '#lib/ui/ProgressCheck.svelte';
	import type { AccPoint } from '#lib/ui/AccuracyTrend.svelte';
	import {
		adviceFor,
		collectSkillsAdaptive,
		overallLevel,
		skillMirror,
		type Advice as SkillAdvice,
		type Skill,
		type SkillValue
	} from '#lib/training/skills.js';
	import { quality } from '#lib/import/ratings.js';
	import { db } from '#lib/db/db.js';
	import { loadOpenings, openingFor } from '#lib/data/openings.js';
	import {
		computeStats,
		outcomeOf,
		type GameStats,
		type Motif,
		type Outcome
	} from '#lib/training/gamestats.js';
	import { themeStats, weakest } from '#lib/training/stats.js';
	import { themeName } from '#lib/data/themes.js';
	import { getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { currentStrength } from '#lib/training/planData.js';
	import type { StrengthSource } from '#lib/training/strength.js';
	import { MOTIF_THEME, pickFocus } from '#lib/training/focus.js';
	import { getLinked, syncState, analyseBatch, pauseBackground } from '#lib/import/sync.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	interface Advice {
		icon: typeof Target;
		title: string;
		text: string;
		href: string;
		cta: string;
		c: string;
		/** der eine Schwerpunkt – derselbe wie im Tagesplan auf der Startseite */
		focus?: boolean;
		/** welche Penta-Ecke dieser Rat trainiert (für den Abgleich mit dem Penta) */
		skill?: Skill;
	}

	/** Fehlerart aus den Partien → Penta-Ecke, die sie trainiert */
	const MOTIF_SKILL: Partial<Record<Motif, Skill>> = {
		hanging: 'safety',
		'mate-allowed': 'safety',
		fork: 'safety',
		'missed-win': 'tactics',
		'mate-missed': 'tactics'
	};
	const SKILL_HREF: Record<Skill, string> = {
		safety: '/puzzles/safety',
		tactics: '/puzzles',
		opening: '/learn/openings',
		strategy: '/learn/basics?set=positional',
		endgame: '/learn/endgame'
	};

	interface Data {
		name: string;
		games: number;
		stats: GameStats;
		last: { id: number; o: Outcome }[];
		rating: { value: number; label: string; delta: number | null } | null;
		strength: number | null;
		/** woraus die Spielstärke besteht */
		strengthParts: { source: StrengthSource; value: number }[];
		puzzle: { rating: number; provisional: boolean };
		mistakes: number;
		advice: Advice[];
		puzzleHist: { date: number; rating: number }[];
		skills: SkillValue[];
		skillAdvice: SkillAdvice[];
		skillOverall: { elo: number; score: number } | null;
		skillBlunderShare: { opening: number | null; endgame: number | null };
		accuracy: AccPoint[];
		coverage: { done: number; total: number };
		ratingSpark: number[];
		history: CoachHistoryPoint[];
	}

	let d = $state<Data | null>(null);

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

		// Woran arbeiten? Zuerst der eine Schwerpunkt (derselbe wie im Tagesplan), dann weitere Schritte
		const advice: Advice[] = [];
		const weakTheme = weakest(themeStats(attempts), 1)[0];
		const focus = pickFocus({ motifs: stats.motifs, weakTheme: weakTheme?.theme ?? null });
		const motifAdvice = (motif: Motif, n: number): Advice => ({
			skill: MOTIF_SKILL[motif],
			icon: Bomb,
			title: t('coachTab.adv.motifTitle', { motif: t(`stats.motif.${motif}`), n }),
			text: t(`coachTab.adv.motif.${motif}`),
			// eigene Figur/Matt verloren → das Gegenmittel ist der Blunder-Check, nicht der Angriff
			href:
				motif === 'hanging' || motif === 'mate-allowed' || motif === 'fork'
					? resolve('/puzzles/safety')
					: MOTIF_THEME[motif]
						? resolve(`/puzzles?theme=${MOTIF_THEME[motif]}`)
						: resolve('/puzzles'),
			cta: t('coachTab.adv.train'),
			c: 'var(--warn)'
		});
		const themeAdvice = (theme: string, rate: number): Advice => ({
			skill: 'tactics',
			icon: Puzzle,
			title: t('coachTab.adv.themeTitle', { theme: themeName(theme), pct: Math.round(rate * 100) }),
			text: t('coachTab.adv.themeText'),
			href: resolve(`/puzzles?theme=${theme}`),
			cta: t('coachTab.adv.train'),
			c: 'var(--c-puzzle)'
		});
		if (focus?.source === 'games')
			advice.push({ ...motifAdvice(focus.motif!, focus.n!), focus: true });
		else if (focus && weakTheme)
			advice.push({ ...themeAdvice(weakTheme.theme, weakTheme.rate), focus: true });
		if (mistakes > 0)
			advice.push({
				icon: Target,
				title: t('coachTab.adv.mistakesTitle', { n: mistakes }),
				text: t('coachTab.adv.mistakesText'),
				href: resolve('/puzzles?mode=mistakes'),
				cta: t('coachTab.adv.practise'),
				c: 'var(--bad)'
			});
		// das Puzzle-Thema nur zusätzlich, wenn es nicht schon der Schwerpunkt ist
		if (weakTheme && focus?.source === 'games' && weakTheme.theme !== focus.theme)
			advice.push(themeAdvice(weakTheme.theme, weakTheme.rate));
		// kein Phasen-Rat mehr („Mittelspiel: nur 79 %“): das Skill-Penta misst die Phasen genauer und
		// widersprach ihm sonst (Produkt-Review 14.11.2026)
		if (!games.length)
			advice.push({
				icon: ChessKnight,
				title: t('coachTab.adv.playTitle'),
				text: t('coachTab.adv.playText'),
				href: resolve('/play'),
				cta: t('coachTab.adv.play'),
				c: 'var(--c-play)'
			});

		const skillRaw = collectSkillsAdaptive(games);
		const skills = skillMirror(skillRaw);
		d = {
			name: linked.lichess || linked.chesscom || '',
			history: coachHistory(games),
			games: games.length,
			stats,
			last,
			rating,
			strength: strength?.value ?? null,
			strengthParts: strength?.parts ?? [],
			puzzle: { rating: Math.round(puzzle.rating), provisional: isProvisional(puzzle) },
			mistakes,
			advice: advice.slice(0, 3),
			puzzleHist: ratingRows.map((r) => ({ date: r.date, rating: Math.round(r.rating) })),
			skills,
			skillAdvice: adviceFor(skills, skillRaw),
			skillOverall: overallLevel(skills),
			skillBlunderShare: skillRaw.blunderShare,
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
			},
			ratingSpark: main ? main.points.slice(-20).map((p) => p.rating) : []
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

{#snippet focusCard(data: Data)}
	{@const main = data.advice.find((a) => a.focus) ?? data.advice[0]}
	{@const lever = data.skillAdvice[0] ?? null}
	{@const agrees = !!lever && !!main && main.skill === lever.skill}
	{@const leverItem = lever
		? {
				icon: Target,
				title: t('coachTab.pentaLever', { name: t(`skills.name.${lever.skill}`) }),
				text: t(lever.viaSafety ? 'coachTab.pentaViaSafety' : `skills.howShort.${lever.skill}`),
				href: resolve((lever.viaSafety ? SKILL_HREF.safety : SKILL_HREF[lever.skill]) as '/'),
				cta: t(`skills.cta.${lever.viaSafety ? 'safety' : lever.skill}`),
				c: 'var(--c-coach)'
			}
		: null}
	{@const second =
		lever && !agrees && leverItem ? leverItem : (data.advice.find((a) => a !== main) ?? null)}
	{#if main || leverItem}
		<section class="card block advice" data-testid="coach-focus">
			<h2>{t('coachTab.focus')}</h2>
			<ul>
				{#each [main ?? leverItem, second].filter((x) => !!x) as a, i (i)}
					<li style:--c={a!.c} class:focus={i === 0}>
						<span class="a-ico"><a.icon size={19} /></span>
						<span class="a-text"
							><b>{a!.title}</b><span>{a!.text}</span>{#if i === 0 && agrees}<span class="a-agree"
									>{t('coachTab.pentaAgrees')}</span
								>{/if}</span
						>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href ist bereits aufgelöst -->
						<a class="btn small a-go" href={a!.href}>{a!.cta} <ArrowRight size={15} /></a>
					</li>
				{/each}
			</ul>
			<details class="stage">
				<summary>{t('coachTab.stageMore')} <ChevronDown size={16} /></summary>
				<LevelFocus elo={data.strength} embedded />
			</details>
		</section>
	{/if}
{/snippet}

{#snippet coverage()}
	{#if d && d.coverage.total && d.coverage.done >= d.coverage.total && !syncState.analysing}
		<!-- alles analysiert: nur eine Zeile statt Fortschrittsbox -->
		<p class="cov-done">{t('skills.coverage', { n: d.coverage.done, m: d.coverage.total })} ✓</p>
	{:else if d && d.coverage.total}
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
		<!-- Wie du spielst: eine Kennzahl je Kachel -->
		<div class="who">
			{#if d.name}<span class="who-ini" aria-hidden="true">{d.name[0].toUpperCase()}</span>{/if}
			<div>
				<b class="who-name">{d.name || t('coachTab.you')}</b>
				<span class="muted num-line">
					{t('coachTab.gamesCount', { n: d.games })}{#if d.strength}&nbsp;· {t(
							'coachTab.strength',
							{
								n: d.strength
							}
						)}{/if}
				</span>
				{#if d.strengthParts.filter((p) => p.source !== 'bots').length > 1}
					<span class="muted num-line parts" data-testid="strength-parts"
						>{d.strengthParts
							.filter((p) => p.source !== 'bots')
							.map((p) => t(`coachTab.part.${p.source}`, { n: p.value }))
							.join(' · ')}</span
					>
				{/if}
			</div>
		</div>

		<!-- 1. Wo stehst du? Spielstärke (oben) und Penta -->
		<section class="tone-coach block skills">
			{@render coverage()}
			<SkillPenta
				values={d.skills}
				advice={d.skillAdvice}
				overall={d.skillOverall}
				blunderShare={d.skillBlunderShare}
				lever={false}
			/>
		</section>

		<!-- 2. Was jetzt? Ein Schwerpunkt (derselbe wie im Tagesplan), die Stufe zum Aufklappen -->
		{@render focusCard(d)}

		<!-- 3. Wirkt es? Entwicklung und Lernkennzahlen -->
		<CoachHistory history={d.history} />
		<ProgressCheck />

		<!-- Wertungsverlauf, Genauigkeit je Partie, typische Fehler und Erkenntnisse: Tab „Statistik“ -->
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
		padding: 1.15rem;
		border-radius: var(--radius-tile);
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

	.cov-done {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-2);
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
		font-family: var(--font-num);
		font-weight: 500;
		color: var(--c-coach);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
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

	/* Ratschläge */
	.advice {
		border: 1.5px solid color-mix(in srgb, var(--c-coach) 35%, transparent);
		background:
			radial-gradient(120% 120% at 100% 0%, var(--c-coach-soft), transparent 65%), var(--surface);
	}

	.advice ul {
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

	/* der eine Schwerpunkt: hervorgehoben, gleiches Ziel wie im Tagesplan */
	.advice li.focus {
		border: 2px solid var(--c);
		background: color-mix(in srgb, var(--c) 7%, var(--surface));
	}

	.a-go {
		grid-column: 2;
		justify-self: start;
		margin-top: 0.45rem;
		gap: 0.3rem;
	}

	/* Form */

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

	/* Stufe zum Aufklappen in der Schwerpunkt-Karte */
	.stage summary {
		list-style: none;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 44px;
		margin-top: 0.4rem;
		font-weight: 600;
		color: var(--text-2);
		cursor: pointer;
	}

	.stage summary::-webkit-details-marker {
		display: none;
	}

	.stage[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	.a-agree {
		color: var(--good-text);
		font-weight: 600;
	}
</style>
