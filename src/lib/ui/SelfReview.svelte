<script lang="ts">
	/**
	 * „Erst du“ (lib/analysis/selfreview.ts): die eigene Partie ohne Bewertungen durchgehen und bis zu drei
	 * vermutete Fehler markieren; danach Auflösung durch Stockfish. Stockfish rechnet währenddessen weiter.
	 * Brettseite wie alle anderen: Kommentarleiste über dem Brett, Steuerung in der Aktionsleiste (Dock).
	 */
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import Flag from '@lucide/svelte/icons/flag';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Search from '@lucide/svelte/icons/search';
	import Board from '#lib/ui/board/Board.svelte';
	import CommentBar from '#lib/ui/CommentBar.svelte';
	import Dock from '#lib/ui/Dock.svelte';
	import type { Game } from '#lib/chess/game.js';
	import { figurine } from '#lib/chess/notation.js';
	import { MAX_MARKS, scoreSelfReview, type SelfReviewScore } from '#lib/analysis/selfreview.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let {
		game,
		myColor,
		/** Fehler laut Analyse (Halbzüge) – null, solange Stockfish noch rechnet */
		mistakes,
		progress,
		onFinish,
		onSkip
	}: {
		game: Game;
		myColor: 'white' | 'black';
		mistakes: number[] | null;
		progress: number;
		onFinish: (marked: number[], score: SelfReviewScore) => void;
		onSkip: () => void;
	} = $props();

	let ply = $state(0);
	let marked = $state<number[]>([]);
	let score = $state<SelfReviewScore | null>(null);

	const total = $derived(game.ply);
	const fen = $derived(game.fenAt(ply));
	const lastMove = $derived.by((): [string, string] | undefined => {
		const m = ply > 0 ? game.moves[ply - 1] : null;
		return m ? [m.from, m.to] : undefined;
	});
	/** eigener Zug, der gerade gezeigt wird? (weiß zieht in ungeraden Halbzügen) */
	const mine = $derived(ply > 0 && (ply % 2 === 1) === (myColor === 'white'));
	const isMarked = $derived(marked.includes(ply));

	const label = (p: number) =>
		`${Math.ceil(p / 2)}${p % 2 === 1 ? '.' : '…'} ${figurine(game.moves[p - 1].san)}`;

	function go(p: number) {
		ply = Math.max(0, Math.min(total, p));
	}

	function toggle() {
		if (!mine || score) return;
		if (isMarked) marked = marked.filter((p) => p !== ply);
		else if (marked.length < MAX_MARKS) marked = [...marked, ply].sort((a, b) => a - b);
	}

	function resolve() {
		if (!mistakes || score) return;
		score = scoreSelfReview(marked, mistakes);
		onFinish(marked, score);
	}

	const shapes = $derived.by(() => {
		if (!score || ply === 0) return [];
		const m = game.moves[ply - 1];
		if (score.missed.includes(ply) || score.found.includes(ply))
			return [{ orig: m.from, dest: m.to, brush: 'bad' as const }];
		return [];
	});

	const bar = $derived.by(() => {
		if (score)
			return {
				kicker: t('selfReview.kicker'),
				title: score.total
					? t('selfReview.result', { n: score.found.length, m: score.total })
					: t('selfReview.noMistakes'),
				text: score.total ? t('selfReview.resultText') : '',
				color: score.found.length === score.total ? 'var(--k-best)' : 'var(--c-learn)'
			};
		return {
			kicker: `${t('selfReview.kicker')} · ${ply ? label(ply) : t('review.start')}`,
			title: t('selfReview.title'),
			text: t('selfReview.text', { n: MAX_MARKS }),
			color: 'var(--c-learn)'
		};
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') go(ply - 1);
		else if (e.key === 'ArrowRight') go(ply + 1);
		else if (e.key === 'm' || e.key === 'f') toggle();
		else return;
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKey} />

<CommentBar
	kicker={bar.kicker}
	title={bar.title}
	text={bar.text}
	color={bar.color}
	testid="self-review-bar"
>
	{#snippet icon()}<Search size={16} />{/snippet}
</CommentBar>

<div class="arena">
	<div class="board-col with-bar">
		<Board {fen} orientation={myColor} {lastMove} viewOnly {shapes} label={t('selfReview.board')} />
		<Dock order={2}>
			<div class="nav">
				<button onclick={() => go(0)} aria-label={t('analysis.nav.first')}
					><ChevronsLeft size={22} /></button
				>
				<button onclick={() => go(ply - 1)} aria-label={t('analysis.nav.prev')}
					><ChevronLeft size={22} /></button
				>
				<button onclick={() => go(ply + 1)} aria-label={t('analysis.nav.next')}
					><ChevronRight size={22} /></button
				>
				<button onclick={() => go(total)} aria-label={t('analysis.nav.last')}
					><ChevronsRight size={22} /></button
				>
			</div>
		</Dock>
	</div>

	<aside class="panel card" data-testid="self-review">
		<h2 class="sr-title">{score ? bar.title : t('selfReview.title')}</h2>
		{#if score?.total}<p class="muted">{t('selfReview.resultText')}</p>{/if}
		{#if !score}
			<p class="muted">{t('selfReview.text', { n: MAX_MARKS })}</p>
		{/if}

		<ul class="marks" aria-label={t('selfReview.marked')}>
			{#each score ? [...new Set( [...score.found, ...score.missed, ...score.extra] )].sort((a, b) => a - b) : marked as p (p)}
				{@const st = score
					? score.found.includes(p)
						? 'found'
						: score.missed.includes(p)
							? 'missed'
							: 'extra'
					: 'marked'}
				<li>
					<button class="mark {st}" class:on={p === ply} onclick={() => go(p)}>
						{#if st === 'found'}<Check size={15} />{:else if st === 'missed'}<X
								size={15}
							/>{:else}<Flag size={15} />{/if}
						<span>{label(p)}</span>
						{#if score}<small>{t(`selfReview.state.${st}`)}</small>{/if}
					</button>
				</li>
			{:else}
				<li class="muted empty">{t('selfReview.none')}</li>
			{/each}
		</ul>

		<Dock class="sr-dock" reserve={128}>
			<div class="actions">
				{#if !score}
					<button
						class="btn secondary grow"
						class:on={isMarked}
						data-testid="mark-move"
						disabled={!mine || (!isMarked && marked.length >= MAX_MARKS)}
						onclick={toggle}
					>
						<Flag size={17} />
						{isMarked ? t('selfReview.unmark') : t('selfReview.mark')}
					</button>
					<button class="btn grow" data-testid="resolve" disabled={!mistakes} onclick={resolve}>
						{mistakes
							? t('selfReview.resolve')
							: t('selfReview.waiting', { pct: Math.round(progress * 100) })}
					</button>
				{:else}
					<button class="btn grow" data-testid="self-review-next" onclick={() => onSkip()}>
						{score.total ? t('selfReview.toRetry') : t('selfReview.toAnalysis')}
						<ArrowRight size={17} />
					</button>
				{/if}
			</div>
		</Dock>
		{#if !score}
			<button class="link skip" onclick={onSkip}>{t('selfReview.skip')}</button>
		{/if}
	</aside>
</div>

<style>
	.arena {
		display: grid;
		gap: 1rem;
	}

	.board-col {
		width: 100%;
		max-width: min(640px, calc(100svh - 260px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 320px;
			align-items: start;
		}
		.board-col {
			max-width: min(680px, calc(100svh - 220px));
		}
		.panel {
			position: sticky;
			top: 2rem;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.15rem;
	}

	.sr-title {
		font-size: 1.1rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.nav {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}

	.nav button {
		flex: 1;
		display: grid;
		place-items: center;
		height: 44px;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}

	.marks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.mark {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0.4rem 0.7rem;
		border: 1.5px solid transparent;
		border-radius: 12px;
		background: var(--surface-2);
		color: var(--text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.mark.on {
		border-color: var(--line-strong);
	}

	.mark small {
		margin-left: auto;
		font-weight: 500;
		color: var(--text-2);
	}

	.mark.found {
		color: var(--good-text);
	}

	.mark.missed {
		color: var(--warn-text);
	}

	.empty {
		padding: 0.25rem 0;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.grow {
		flex: 1;
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.btn.secondary.on {
		outline: 2px solid var(--warn);
	}

	.skip {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0.25rem 0;
		color: var(--text-2);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	@media (max-width: 767px) {
		.board-col.with-bar {
			max-width: min(
				100%,
				calc(
					100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 80px - var(--comment-h) -
						0.5rem
				)
			);
		}
		.sr-title,
		.panel > .muted {
			display: none;
		}
	}
</style>
