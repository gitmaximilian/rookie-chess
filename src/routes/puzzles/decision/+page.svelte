<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Board from '#lib/ui/board/Board.svelte';
	import { Game, sanForUci } from '#lib/chess/game.js';
	import { db, getSetting, setSetting } from '#lib/db/db.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { assessDecision, DECISION_PRACTICE, DECISION_TRANSFER } from '#lib/training/decision.js';

	const test = $derived(typeof window !== 'undefined' && page.url.searchParams.get('test') === '1');
	const positions = $derived(test ? DECISION_TRANSFER : DECISION_PRACTICE);
	const empty = { candidate: '', reply: null as string | null };
	const draftKey = (id: string) => `decisionDraft:${id}`;
	let index = $state(0);
	let score = $state(0);
	let draft = $state.raw(empty);
	let ready = $state(false);
	let busy = $state(false);
	let error = $state(false);
	let result = $state.raw<Awaited<ReturnType<typeof assessDecision>> | null>(null);

	const position = $derived(positions[index]);
	const game = $derived(
		position ? Game.fromUciMoves(draft.candidate ? [draft.candidate] : [], position.fen) : null
	);
	const orientation = $derived(position?.fen.split(' ')[1] === 'b' ? 'black' : 'white');
	const locked = $derived(!!game && !!draft.candidate && (!!draft.reply || !!game.end()));

	$effect(() => {
		const transfer = test;
		const controller = new AbortController();
		void load(transfer, controller.signal);
		return () => controller.abort();
	});

	let assessment: AbortController | undefined;
	onMount(() => () => assessment?.abort());

	async function load(transfer: boolean, signal: AbortSignal) {
		assessment?.abort();
		ready = false;
		error = false;
		result = null;
		if (transfer) {
			const rows = await db.puzzleAttempts
				.where('puzzleId')
				.anyOf(DECISION_TRANSFER.map((item) => item.id))
				.toArray();
			const prior = new Map(
				rows.filter((row) => row.source === 'transfer').map((row) => [row.puzzleId, row.solved])
			);
			const next = DECISION_TRANSFER.findIndex((item) => !prior.has(item.id));
			const saved =
				next < 0 ? empty : await getSetting(draftKey(DECISION_TRANSFER[next].id), empty);
			if (signal.aborted) return;
			index = next < 0 ? DECISION_TRANSFER.length : next;
			score = Array.from(prior.values()).filter(Boolean).length;
			draft = saved;
		} else {
			index = 0;
			score = 0;
			draft = empty;
		}
		busy = false;
		ready = true;
	}

	async function move(uci: string) {
		if (!position || !game || busy || error || result || locked) return;
		const id = position.id;
		const next = draft.candidate ? { ...draft, reply: uci } : { candidate: uci, reply: null };
		busy = true;
		try {
			draft = test
				? await db.transaction('rw', db.settings, async () => {
						const latest = await getSetting<typeof empty | null>(draftKey(id), null);
						const choice = latest
							? {
									candidate: latest.candidate,
									reply: latest.reply ?? (latest.candidate === next.candidate ? next.reply : null)
								}
							: next;
						await setSetting(draftKey(id), choice);
						return choice;
					})
				: next;
		} catch {
			error = true;
		} finally {
			busy = false;
		}
		if (locked && !error) await finish();
	}

	async function finish() {
		if (!position || !locked || busy) return;
		const active = position;
		const transfer = test;
		const controller = new AbortController();
		assessment = controller;
		busy = true;
		error = false;
		try {
			const evaluated = await assessDecision(
				active.fen,
				draft.candidate,
				draft.reply,
				controller.signal
			);
			if (controller.signal.aborted) return;
			const solved = evaluated.own.good && (evaluated.opponent?.good ?? true);
			await db.transaction('rw', [db.puzzleAttempts, db.settings], async () => {
				if (transfer && (await db.puzzleAttempts.where('puzzleId').equals(active.id).count()))
					return;
				await db.puzzleAttempts.add({
					puzzleId: active.id,
					date: Date.now(),
					solved,
					ratingAfter: 0,
					themes: [],
					source: transfer ? 'transfer' : 'decision'
				});
				if (transfer) await db.settings.delete(draftKey(active.id));
			});
			if (controller.signal.aborted) return;
			if (transfer) await load(true, new AbortController().signal);
			else {
				score += Number(solved);
				result = evaluated;
			}
		} catch {
			if (!controller.signal.aborted) error = true;
		} finally {
			if (!controller.signal.aborted) busy = false;
		}
	}

	function next() {
		index++;
		draft = empty;
		result = null;
	}
</script>

<svelte:head><title>{t(test ? 'decision.test' : 'decision.title')} – Rookie</title></svelte:head>

<section class="decision">
	<a class="hit44" href={resolve('/puzzles')}>{t('nav.puzzles')}</a>
	<PageHeader title={t(test ? 'decision.test' : 'decision.title')} />
	{#if !ready}
		<p role="status">{t('decision.loading')}</p>
	{:else if !position || !game}
		<div class="card instructions" data-testid="decision-result">
			<h2>{t('decision.result', { n: score, total: positions.length })}</h2>
			{#if test}
				<p>{t('decision.testDone')}</p>
				<a class="btn" href={resolve('/puzzles/decision')}>{t('decision.title')}</a>
			{:else}
				<a class="btn" href={resolve('/puzzles/decision?test=1')}>{t('decision.test')}</a>
				<button class="btn secondary" onclick={() => void load(false, new AbortController().signal)}
					>{t('decision.again')}</button
				>
			{/if}
		</div>
	{:else}
		<div class="card instructions" aria-live="polite">
			<span class="eyebrow"
				>{t('decision.progress', { n: index + 1, total: positions.length })}</span
			>
			{#if result}
				<p>
					{t(result.own.good ? 'decision.ownGood' : 'decision.ownBetter', {
						move: sanForUci(position.fen, result.own.example)
					})}
				</p>
				{#if result.opponent}
					<p>
						{t(result.opponent.good ? 'decision.replyGood' : 'decision.replyBetter', {
							move: sanForUci(game.fen, result.opponent.example)
						})}
					</p>
				{/if}
			{:else if error}
				<p>{t('decision.error')}</p>
			{:else if busy || locked}
				<p>{t('decision.loading')}</p>
			{:else}
				<p>
					{t(draft.candidate ? 'decision.reply' : test ? 'decision.testChoose' : 'decision.choose')}
				</p>
			{/if}
		</div>
		<div class="decision-board">
			<Board
				fen={game.fen}
				{orientation}
				turnColor={game.turn}
				check={game.isCheck}
				dests={busy || result || locked || error ? undefined : game.dests()}
				lastMove={game.lastMove}
				isPromotion={(from, to) => game.isPromotion(from as never, to as never)}
				onMove={move}
			/>
		</div>
		{#if result}
			<button class="btn" onclick={next}>{t('decision.next')}</button>
		{:else if error || (locked && !busy)}
			<button class="btn" onclick={() => (locked ? void finish() : (error = false))}
				>{t(locked ? 'decision.continue' : 'decision.retry')}</button
			>
		{/if}
	{/if}
</section>

<style>
	.decision {
		width: min(100%, 540px);
		margin: 0 auto;
		display: grid;
		gap: 0.75rem;
	}

	.instructions {
		padding: 0.85rem;
	}

	.instructions p + p {
		margin-top: 0.4rem;
	}

	.instructions .btn {
		margin-top: 0.6rem;
	}

	.decision-board {
		width: 100%;
	}
</style>
