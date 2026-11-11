<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import type { GameRow } from '#lib/db/db.js';
	import { quality } from '#lib/import/ratings.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	/** Eine Partie als kompakte Zeile – gleich in Home und „Meine Partien“ */
	let { game, flat = false }: { game: GameRow; flat?: boolean } = $props();

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

<a class="gli {result}" class:flat href={resolve(`/analysis?game=${game.id}`)}>
	<span class="bar" aria-hidden="true"></span>
	<span class="txt">
		<b class="name">{t('analysis.vs', { name: game.opponent })}</b>
		<span class="meta">
			<span class="res">{t(`analysis.result.${result}`)}</span>
			<span class="dot" aria-hidden="true">·</span>
			<span>{t(`analysis.source.${game.source}`)}</span>
			<span class="dot" aria-hidden="true">·</span>
			<span>{date}</span>
			{#if game.myRating}<span class="dot" aria-hidden="true">·</span><span>{game.myRating}</span
				>{/if}
		</span>
	</span>
	{#if q}
		<span class="q">
			<b class:hi={q.accuracy >= 80} class:lo={q.accuracy < 65}>{q.accuracy}%</b>
			{#if q.blunders || q.mistakes}
				<span class="errs">
					{#if q.blunders}<span class="qb">{q.blunders}??</span>{/if}
					{#if q.mistakes}<span class="qm">{q.mistakes}?</span>{/if}
				</span>
			{/if}
		</span>
	{:else if !game.analysis?.done}
		<span class="pending" title={t('analysis.notYet')}>
			<Hourglass size={15} />
			<span class="sr-only">{t('analysis.notYet')}</span>
		</span>
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
		border-radius: var(--radius-m);
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-1);
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
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		line-height: 1.2;
	}

	.q b {
		font-size: 1rem;
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
		font-weight: 700;
	}

	.qb {
		color: var(--bad-text);
	}

	.qm {
		color: var(--warn-text);
	}

	.pending {
		flex: none;
		display: grid;
		place-items: center;
		color: var(--text-3);
	}

	.gli :global(.chev) {
		flex: none;
		color: var(--text-3);
	}
</style>
