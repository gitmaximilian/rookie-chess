<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Timer from '@lucide/svelte/icons/timer';
	import Zap from '@lucide/svelte/icons/zap';
	import Rabbit from '@lucide/svelte/icons/rabbit';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { GameRow } from '#lib/db/db.js';
	import { quality } from '#lib/import/ratings.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	/**
	 * Eine Partie als Zeile – kompakt (Home) oder ausführlich (Partienliste, nach Tagen gruppiert:
	 * dann ohne Datum, dafür mit Farbe, Bedenkzeit, Zügen und Eröffnung).
	 */
	let {
		game,
		flat = false,
		detailed = false,
		opening = null
	}: { game: GameRow; flat?: boolean; detailed?: boolean; opening?: string | null } = $props();

	const SPEED_ICON = { bullet: Rabbit, blitz: Zap, rapid: Timer, classical: Timer, daily: Timer };
	const SpeedIcon = $derived(
		game.speed ? (SPEED_ICON as Record<string, typeof Timer>)[game.speed] : null
	);
	const speedName = (k: string) => {
		const s = t(`stats.speed.${k}`);
		return s.startsWith('stats.') ? k : s;
	};

	const result = $derived.by(() => {
		if (game.result === '*') return 'open';
		if (game.result === '1/2-1/2') return 'draw';
		return (game.result === '1-0') === (game.myColor === 'white') ? 'win' : 'loss';
	});
	const q = $derived(quality(game));
	const date = $derived.by(() => {
		const d = new Date(game.date);
		const sameYear = d.getFullYear() === new Date().getFullYear();
		return d.toLocaleDateString(intlLocale(), {
			day: 'numeric',
			month: 'short',
			...(sameYear ? {} : { year: 'numeric' })
		});
	});
</script>

<a class="gli {result}" class:flat class:detailed href={resolve(`/analysis?game=${game.id}`)}>
	<span class="bar" aria-hidden="true"></span>
	<span class="txt">
		{#if detailed}
			<span class="name-row">
				<b class="name">{game.opponent}</b>
				{#if game.oppRating}<span class="opp-r">{game.oppRating}</span>{/if}
			</span>
			<span class="meta">
				<span class="res">{t(`analysis.result.${result}`)}</span>
				<span
					class="side {game.myColor}"
					role="img"
					aria-label={t(game.myColor === 'white' ? 'common.white' : 'common.black')}
				></span>
				{#if SpeedIcon && game.speed}<span class="sp"
						><SpeedIcon size={13} />{speedName(game.speed)}</span
					>{:else}<span>{t(`analysis.source.${game.source}`)}</span>{/if}
				<span class="dot" aria-hidden="true">·</span>
				<span>{t('common.moves', { n: Math.ceil(game.moves.length / 2) })}</span>
			</span>
			{#if opening}<span class="op"><BookOpen size={12} /> {opening}</span>{/if}
		{:else}
			<b class="name">{t('analysis.vs', { name: game.opponent })}</b>
			<span class="meta">
				<span class="res">{t(`analysis.result.${result}`)}</span>
				<span class="dot" aria-hidden="true">·</span>
				<span>{t(`analysis.source.${game.source}`)}</span>
				<span class="dot" aria-hidden="true">·</span>
				<span>{date}</span>
			</span>
		{/if}
	</span>
	{#if q}
		<span class="q">
			<b class:hi={q.accuracy >= 80} class:lo={q.accuracy < 65}>{q.accuracy}%</b>
			{#if q.blunders || q.mistakes}
				<span class="errs">
					{#if q.blunders}<span class="qb">{t('analysis.blundersShort', { n: q.blunders })}</span
						>{/if}
					{#if q.mistakes && !q.blunders}<span class="qm"
							>{t('analysis.mistakesShort', { n: q.mistakes })}</span
						>{/if}
				</span>
			{/if}
		</span>
	{:else if !game.analysis?.done}
		<span class="analyse">{t('analysis.analyseShort')}</span>
	{/if}
	<ChevronRight size={18} class="chev" />
</a>

<style>
	.gli {
		--c: var(--text-3);
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 60px;
		padding: 0.6rem 0.7rem 0.6rem 1rem;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--text);
		overflow: hidden;
		transition:
			transform var(--dur-fast) var(--ease-out),
			background-color var(--dur) var(--ease-out);
	}

	.gli.flat {
		background: var(--surface-2);
		border-color: transparent;
		box-shadow: none;
	}

	.gli:active {
		transform: scale(0.985);
	}

	@media (hover: hover) {
		.gli:hover {
			background: color-mix(in srgb, var(--text) 3%, var(--surface));
		}
	}

	.gli.win {
		--c: var(--good);
		--ct: var(--good-text);
	}
	.gli.loss {
		--c: var(--bad);
		--ct: var(--bad-text);
	}
	.gli.draw,
	.gli.open {
		--ct: var(--text-2);
	}

	.bar {
		position: absolute;
		inset: 0 auto 0 0;
		width: 4px;
		background: var(--c);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		line-height: 1.3;
	}

	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		display: flex;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta > span {
		flex: none;
	}

	.dot {
		color: var(--text-3);
	}

	.res {
		font-weight: 700;
		color: var(--ct);
	}

	.q {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.05rem;
		font-family: var(--font-num);
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		line-height: 1.2;
	}

	.q b {
		font-size: 1rem;
		font-weight: 600;
		color: var(--warn-text);
	}

	.q b.hi {
		color: var(--good-text);
	}

	.q b.lo {
		color: var(--bad-text);
	}

	.errs {
		display: flex;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 650;
		white-space: nowrap;
	}

	.qb {
		color: var(--bad-text);
	}

	.qm {
		color: var(--warn-text);
	}

	.analyse {
		flex: none;
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--line-strong);
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text);
	}

	.name-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		min-width: 0;
	}

	.opp-r {
		flex: none;
		font-family: var(--font-num);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-3);
	}

	.side {
		flex: none;
		align-self: center;
		width: 11px;
		height: 11px;
		border-radius: 50%;
		border: 1.5px solid var(--text-3);
	}

	.side.black {
		background: var(--text-2);
		border-color: var(--text-2);
	}

	.side.white {
		background: #fff;
	}

	.sp {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.sp :global(svg) {
		color: var(--warn);
	}

	.op {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.op :global(svg) {
		flex: none;
	}

	.gli.detailed {
		min-height: 72px;
	}

	.gli :global(.chev) {
		flex: none;
		color: var(--text-3);
	}
</style>
