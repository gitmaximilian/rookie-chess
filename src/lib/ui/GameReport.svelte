<script lang="ts">
	/**
	 * Partie-Bewertung (lib/analysis/report.ts): gespielte Elo beider Seiten mit Spanne, Vergleich mit
	 * der Wertung, Phasen, Wendepunkt, Chancen und ein Lernpunkt mit passender Übung.
	 */
	import { resolve } from '$app/paths';
	import Gauge from '@lucide/svelte/icons/gauge';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { percentileAt, type GameReport } from '#lib/analysis/report.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let {
		report,
		myColor,
		opponent,
		myRating = null,
		oppRating = null,
		moveLabel,
		onGo
	}: {
		report: GameReport;
		myColor: 'white' | 'black';
		opponent: string;
		myRating?: number | null;
		oppRating?: number | null;
		/** „23. ♘xe4“ für einen Halbzug */
		moveLabel: (ply: number) => string;
		onGo: (ply: number) => void;
	} = $props();

	const me = $derived(report[myColor]);
	const opp = $derived(report[myColor === 'white' ? 'black' : 'white']);
	/** Vergleich mit Gleichstarken: eigene Wertung (online) bzw. Rookies Schätzung, Gegner: Bot/Online-Wertung */
	const pctMe = $derived(myRating ? percentileAt(me.accuracy, myRating) : null);
	const pctOpp = $derived(oppRating ? percentileAt(opp.accuracy, oppRating) : null);
	const phaseLabel = (a: number | null) =>
		a === null ? '' : a >= 85 ? 'strong' : a >= 70 ? 'ok' : 'weak';
	const lessonHref = $derived(
		report.lesson?.motif === 'hanging' || report.lesson?.motif === 'mate-allowed'
			? resolve('/puzzles/safety')
			: resolve('/puzzles?mode=mistakes')
	);
</script>

<section class="card report" data-testid="game-report">
	<h3><Gauge size={18} /> {t('report.title')}</h3>

	<div class="perf">
		{#each [{ s: me, who: t('common.you'), pct: pctMe, rating: myRating, mine: true }, { s: opp, who: opponent, pct: pctOpp, rating: oppRating, mine: false }] as x (x.mine)}
			<div class="p-side" class:mine={x.mine}>
				<span class="p-who">{x.who}</span>
				<b class="p-elo">{x.s.accuracy}<small>%</small></b>
				{#if x.s.level}
					<span class="p-range"
						>{t(
							x.s.level.edge === 'below'
								? 'report.levelBelow'
								: x.s.level.edge === 'above'
									? 'report.levelAbove'
									: 'report.level',
							{ elo: x.s.level.elo }
						)}</span
					>
				{:else}
					<span class="p-range">{t('report.tooShort')}</span>
				{/if}
				{#if x.pct !== null && x.rating && x.s.level}
					<span class="p-vs" class:above={x.pct >= 70} class:below={x.pct <= 30}
						>{t('report.percentile', { p: x.pct, r: x.rating })}</span
					>
				{/if}
			</div>
		{/each}
	</div>

	<ul class="facts">
		<li>
			<span class="f-k">{t('report.phases')}</span>
			<span class="phases">
				{#each ['opening', 'middlegame', 'endgame'] as const as p (p)}
					{@const a = me.phases[p]}
					{#if a !== null}
						<span class="ph {phaseLabel(a)}">{t(`stats.phase.${p}`)} <b>{a}%</b></span>
					{/if}
				{/each}
				{#if me.phases.opening === null && me.phases.middlegame === null && me.phases.endgame === null}
					<span class="muted">–</span>
				{/if}
			</span>
		</li>
		{#if report.turning}
			<li>
				<span class="f-k">{t('report.turning')}</span>
				<button class="link-btn" onclick={() => onGo(report.turning!.ply)}
					>{moveLabel(report.turning.ply)}
					{report.turning.mover === myColor ? t('report.byYou') : t('report.byOpp')} ·
					{t('report.lost', { pct: Math.round(report.turning.loss * 50) })}</button
				>
			</li>
		{/if}
		<li>
			<span class="f-k">{t('report.chances')}</span>
			<span
				>{me.chances.total
					? t('report.chancesText', { n: me.chances.taken, m: me.chances.total })
					: t('report.noChances')}{#if report.missed}
					·
					<button class="link-btn" onclick={() => onGo(report.missed!.ply)}
						>{t('report.missed', { move: moveLabel(report.missed.ply) })}</button
					>{/if}</span
			>
		</li>
		{#if report.lesson}
			<li class="lesson">
				<span class="f-k">{t('report.lesson')}</span>
				<a href={lessonHref}
					>{t('report.lessonText', {
						motif: t(`stats.motif.${report.lesson.motif}`),
						n: report.lesson.n
					})}
					<ArrowRight size={14} /></a
				>
			</li>
		{/if}
	</ul>
	<p class="note">{t('report.note')}</p>
</section>

<style>
	.report {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem;
	}

	h3 {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 1.02rem;
	}

	.perf {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.p-side {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.7rem 0.8rem;
		border-radius: 14px;
		background: var(--surface-2);
		min-width: 0;
	}

	.p-side.mine {
		background: var(--c-learn-soft, var(--surface-2));
	}

	.p-who {
		font-size: 0.8rem;
		font-weight: 650;
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.p-elo {
		font-family: var(--font-num);
		font-size: 1.45rem;
		font-weight: 600;
	}

	.p-range,
	.p-acc {
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.p-vs {
		font-size: 0.78rem;
		font-weight: 650;
	}

	.p-vs.above {
		color: var(--good-text);
	}

	.p-vs.below {
		color: var(--warn-text);
	}

	.facts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		font-size: 0.9rem;
	}

	.facts li {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.f-k {
		font-size: 0.75rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-3);
	}

	.phases {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.ph {
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		font-size: 0.82rem;
		background: var(--surface-2);
	}

	.ph.strong {
		color: var(--good-text);
	}

	.ph.weak {
		color: var(--warn-text);
	}

	.link-btn {
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		color: var(--accent-text, var(--accent));
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.lesson a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 650;
		color: var(--accent-text, var(--accent));
	}

	.note {
		font-size: 0.78rem;
		color: var(--text-3);
		line-height: 1.4;
	}
</style>
