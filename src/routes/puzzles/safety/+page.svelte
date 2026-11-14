<script lang="ts">
	/**
	 * Blunder-Check: „Du willst diesen Zug spielen – ist er sicher?“ (lib/training/safety.ts)
	 * Mit ?test=1 der Kontrolltest: feste Aufgaben, Rückmeldung erst am Ende.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Check from '@lucide/svelte/icons/check';
	import Info from '@lucide/svelte/icons/info';
	import Eye from '@lucide/svelte/icons/eye';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Board from '#lib/ui/board/Board.svelte';
	import CommentBar from '#lib/ui/CommentBar.svelte';
	import Dock from '#lib/ui/Dock.svelte';
	import { Game, sanForUci } from '#lib/chess/game.js';
	import { figurine } from '#lib/chess/notation.js';
	import { db, getSetting, setSetting, bumpActivity, today } from '#lib/db/db.js';
	import { review, dueCards, formatInterval } from '#lib/training/srs.js';
	import { updateForPuzzle, type Rating } from '#lib/training/glicko2.js';
	import { getPuzzleRating } from '#lib/training/rating.js';
	import { puzzleTarget } from '#lib/training/difficulty.js';
	import {
		loadSafety,
		pickSafety,
		gradeSafety,
		isReply,
		checkupItems,
		nextForm,
		checkupTrend,
		type SafetyItem,
		type SafetyAnswer,
		type CheckupResult
	} from '#lib/training/safety.js';
	import { themeName } from '#lib/data/themes.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	type Status = 'loading' | 'ask' | 'refute' | 'done' | 'summary' | 'empty' | 'error';

	// URL-Suche gibt es beim Vorrendern nicht – erst im Browser lesen
	const testMode = $derived(
		typeof window !== 'undefined' && page.url.searchParams.get('test') === '1'
	);

	let status = $state<Status>('loading');
	let item = $state.raw<SafetyItem | null>(null);
	let game = $state.raw<Game | null>(null);
	let v = $state(0);
	let answer = $state<SafetyAnswer | null>(null);
	let refuted = $state<boolean | null>(null);
	let tries = $state(0);
	let correct = $state(false);
	let shapes = $state<{ orig: string; dest?: string; brush: 'info' | 'good' | 'bad' }[]>([]);
	let flash = $state<'' | 'good' | 'bad'>('');
	let nextReview = $state<string | null>(null);
	let errorMsg = $state('');
	let rating = $state<Rating | null>(null);
	let doneToday = $state(0);
	let sessionRight = $state(0);
	let sessionTotal = $state(0);

	// Kontrolltest
	let testItems = $state.raw<SafetyItem[]>([]);
	let testPos = $state(0);
	let testScore = $state(0);
	let testForm = $state<'A' | 'B'>('A');
	let history = $state<CheckupResult[]>([]);

	let all: SafetyItem[] = [];
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const seen = new Set<string>();

	const fen = $derived.by(() => {
		void v;
		return game?.fen ?? item?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1';
	});
	const lastMove = $derived.by(() => {
		void v;
		return game?.lastMove;
	});
	/** Spieler = Seite, die den Zug plant */
	const me = $derived<'white' | 'black'>(item?.fen.split(' ')[1] === 'b' ? 'black' : 'white');
	const opp = $derived<'white' | 'black'>(me === 'white' ? 'black' : 'white');
	const dests = $derived.by(() => {
		void v;
		return status === 'refute' && game ? game.dests() : new Map<string, string[]>();
	});
	const moveSan = $derived(item ? figurine(sanForUci(item.fen, item.move)) : '');
	const replySan = $derived.by(() => {
		if (!item?.reply) return '';
		const g = new Game(item.fen);
		g.play(item.move);
		return figurine(sanForUci(g.fen, item.reply));
	});

	onMount(async () => {
		try {
			all = await loadSafety();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error';
			status = 'error';
			return;
		}
		rating = await getSetting<Rating | null>('safetyRating', null);
		if (!rating) {
			// Start bei der Puzzle-Wertung (die Aufgaben stammen aus Puzzles derselben Skala)
			const p = await getPuzzleRating();
			rating = { rating: p.rating, rd: Math.max(p.rd, 200), vol: 0.06 };
		}
		doneToday = (await todaysAttempts()).length;
		if (testMode) {
			history = await getSetting<CheckupResult[]>('checkups', []);
			testForm = nextForm(history);
			testItems = checkupItems(all, testForm);
			testPos = 0;
			testScore = 0;
		}
		await next();
	});

	async function todaysAttempts() {
		// Tagesbeginn (lokal) – nur gelesen, nicht reaktiv
		const now = new Date(Date.now());
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		return db.puzzleAttempts
			.where('date')
			.aboveOrEqual(start)
			.filter((a) => a.source === 'safety')
			.toArray();
	}

	/** jüngste Blunder-Check-Ergebnisse (für die Schwierigkeit), älteste zuerst */
	async function recentResults(): Promise<boolean[]> {
		const rows = await db.puzzleAttempts.orderBy('date').reverse().limit(200).toArray();
		return rows
			.filter((a) => a.source === 'safety')
			.slice(0, 20)
			.map((a) => a.solved)
			.reverse();
	}

	async function pick(): Promise<SafetyItem | null> {
		if (testMode) return testItems[testPos] ?? null;
		// fällige Wiederholungen zuerst (verfehlte Aufgaben kommen nach Tagen wieder)
		const due = await dueCards('safety');
		const d = due.find((c) => !seen.has((c.data as SafetyItem | undefined)?.id ?? ''));
		if (d?.data) return d.data as SafetyItem;
		const done = await db.puzzleAttempts.orderBy('date').reverse().limit(1500).toArray();
		const exclude = new Set([
			...seen,
			...done.filter((a) => a.source === 'safety').map((a) => a.puzzleId)
		]);
		const target = puzzleTarget(rating?.rating ?? 800, await recentResults());
		return pickSafety(all, target, exclude);
	}

	async function next() {
		status = 'loading';
		answer = null;
		refuted = null;
		tries = 0;
		correct = false;
		nextReview = null;
		const it = await pick();
		if (!it) {
			item = null;
			status = testMode ? 'summary' : 'empty';
			return;
		}
		item = it;
		seen.add(it.id);
		game = new Game(it.fen);
		shapes = [];
		v++;
		status = 'ask';
		// Pfeil erst nach dem Aufbau der Stellung zeichnen (sonst fehlt er beim ersten Laden gelegentlich)
		requestAnimationFrame(() => {
			if (item?.id === it.id && status === 'ask')
				shapes = [{ orig: it.move.slice(0, 2), dest: it.move.slice(2, 4), brush: 'info' }];
		});
	}

	function blink(k: 'good' | 'bad') {
		flash = k;
		setTimeout(() => (flash = ''), 500);
	}

	function playOnBoard(uci: string) {
		if (!game) return;
		const mv = game.play(uci);
		if (mv) sound.move(!!mv.captured, game.isCheck);
		v++;
	}

	async function choose(a: SafetyAnswer) {
		if (status !== 'ask' || !item) return;
		answer = a;
		if (!item.safe && a === 'unsafe') {
			// Richtig gespürt – jetzt zeigen, was der Gegner tun kann
			playOnBoard(item.move);
			shapes = [];
			status = 'refute';
			return;
		}
		if (!item.safe && a === 'safe') {
			// Zug ausführen, dann die Widerlegung zeigen
			playOnBoard(item.move);
			shapes = [];
			await new Promise((r) => setTimeout(r, 450));
			if (item.reply) {
				playOnBoard(item.reply);
				shapes = [{ orig: item.reply.slice(0, 2), dest: item.reply.slice(2, 4), brush: 'bad' }];
			}
		}
		await finish();
	}

	function onMove(uci: string) {
		if (status !== 'refute' || !item || !game) return;
		const test = new Game(game.fen);
		const ok = isReply(item, uci) || (test.play(uci) && test.end()?.kind === 'checkmate');
		if (ok) {
			refuted = true;
			playOnBoard(uci);
			shapes = [{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'good' }];
			void finish();
			return;
		}
		tries++;
		v++;
		blink('bad');
		if (tries >= 2) showReply();
	}

	function showReply() {
		if (status !== 'refute' || !item) return;
		refuted = false;
		if (item.reply) {
			playOnBoard(item.reply);
			shapes = [{ orig: item.reply.slice(0, 2), dest: item.reply.slice(2, 4), brush: 'bad' }];
		}
		void finish();
	}

	async function finish() {
		if (!item || !answer) return;
		const g = gradeSafety(item, answer, refuted);
		correct = g.correct;
		status = 'done';
		if (!testMode) {
			blink(correct ? 'good' : 'bad');
			if (correct) sound.good();
			else sound.bad();
		}
		sessionTotal++;
		if (correct) sessionRight++;
		await db.puzzleAttempts.add({
			puzzleId: item.id,
			date: Date.now(),
			solved: correct,
			ratingAfter: Math.round(rating?.rating ?? 0),
			themes: [item.theme],
			source: testMode ? 'checkup' : 'safety'
		});
		// zählt für Serie und Aktivität, aber nicht als Puzzle (Tagesziel „Puzzles“ bleibt eindeutig)
		await bumpActivity('reviews');
		doneToday++;
		if (testMode) {
			testScore += g.score;
			return;
		}
		// eigene Wertung für den Blunder-Check (Glicko, gegen die Puzzle-Wertung der Stellung)
		if (rating) {
			rating = updateForPuzzle(rating, item.rating, g.score);
			await setSetting('safetyRating', rating);
		}
		// verfehlt → kommt in Tagen wieder; schon bekannte Karte → weiter planen
		const id = `safety:${item.id}`;
		const existing = await db.reviewCards.get(id);
		if (!correct || existing) {
			const row = await review(id, 'safety', correct ? 'good' : 'again', item);
			nextReview = formatInterval(row.due);
		}
	}

	async function nextOrSummary() {
		if (testMode) {
			testPos++;
			if (testPos >= testItems.length) return void (await saveTest());
		}
		await next();
	}

	async function saveTest() {
		const res: CheckupResult = {
			date: Date.now(),
			form: testForm,
			score: testScore,
			total: testItems.length
		};
		history = [...history, res];
		await setSetting('checkups', history);
		await setSetting('checkupDay', today());
		item = null;
		status = 'summary';
	}

	const trend = $derived(checkupTrend(history));

	const prompt = $derived(item ? t('safety.prompt', { san: moveSan }) : '');

	const resultTitle = $derived.by(() => {
		if (!item || status !== 'done') return '';
		if (testMode) return t('safety.saved');
		if (item.safe) return correct ? t('safety.rightSafe') : t('safety.wrongSafe');
		if (answer === 'safe') return t('safety.wrongUnsafe');
		return refuted ? t('safety.rightUnsafe') : t('safety.halfUnsafe');
	});
	const resultText = $derived.by(() => {
		if (!item || status !== 'done' || testMode) return '';
		if (item.safe) return t('safety.whySafe', { san: moveSan });
		return t('safety.whyUnsafe', {
			san: moveSan,
			reply: replySan,
			theme: themeName(item.theme)
		});
	});

	const bar = $derived.by(() => {
		if (!item) return null;
		const kicker = testMode
			? t('safety.testKicker', { n: testPos + 1, m: testItems.length })
			: t('safety.kicker');
		if (status === 'refute')
			return {
				kicker,
				title: t('safety.refuteTitle'),
				text: tries ? t('safety.refuteAgain') : t('safety.refuteText'),
				color: tries ? 'var(--k-inaccuracy)' : 'var(--k-mistake)'
			};
		if (status === 'done')
			return {
				kicker,
				title: resultTitle,
				text: [resultText, nextReview ? t('puzzles.reviewIn', { when: nextReview }) : '']
					.filter(Boolean)
					.join(' '),
				color: testMode ? 'var(--c-puzzle)' : correct ? 'var(--k-best)' : 'var(--k-mistake)'
			};
		return { kicker, title: prompt, text: t('safety.routine'), color: 'var(--c-puzzle)' };
	});

	function onKey(e: KeyboardEvent) {
		if (status === 'ask') {
			if (e.key === 's') void choose('safe');
			if (e.key === 'u' || e.key === 'n') void choose('unsafe');
		} else if (status === 'done' && (e.key === 'Enter' || e.key === 'ArrowRight')) {
			e.preventDefault();
			void nextOrSummary();
		}
	}
</script>

<svelte:head
	><title>{testMode ? t('safety.testTitle') : t('safety.title')} – Rookie</title></svelte:head
>
<svelte:window onkeydown={onKey} />

<div class="wrap">
	<a class="back hit44" href={resolve(testMode ? '/coach' : '/puzzles')}
		><ArrowLeft size={18} /> {testMode ? t('nav.coach') : t('nav.puzzles')}</a
	>
	<header class="top">
		<span class="eyebrow">{t('safety.eyebrow')}</span>
		<h1>{testMode ? t('safety.testTitle') : t('safety.title')}</h1>
	</header>

	{#if bar && status !== 'summary'}
		<CommentBar
			kicker={bar.kicker}
			title={bar.title}
			text={bar.text}
			color={bar.color}
			testid="safety-bar"
			{status}
		>
			{#snippet icon()}{#if status === 'done' && correct && !testMode}<Check
						size={16}
						strokeWidth={3}
					/>{:else if status === 'done'}<Info size={16} />{:else}<ShieldCheck
						size={16}
					/>{/if}{/snippet}
		</CommentBar>
	{/if}

	{#if status === 'summary'}
		<section class="summary card" data-testid="checkup-summary">
			<ShieldCheck size={28} />
			<h2>{t('safety.testScore', { n: testScore, m: testItems.length })}</h2>
			{#if trend}
				<p>
					{t('safety.testTrend', { first: trend.first, last: trend.last })}
					{trend.meaningful
						? trend.diff > 0
							? t('safety.trendUp')
							: t('safety.trendDown')
						: t('safety.trendNoise')}
				</p>
			{:else}
				<p>{t('safety.testFirst')}</p>
			{/if}
			<a class="btn" href={resolve('/coach')}>{t('safety.toCoach')} <ArrowRight size={17} /></a>
		</section>
	{:else}
		<div class="arena">
			<div class="board-col" class:with-bar={!!bar}>
				<Board
					{fen}
					orientation={me}
					turnColor={game?.turn}
					{lastMove}
					check={game?.isCheck}
					{dests}
					movableColor={status === 'refute' ? opp : undefined}
					viewOnly={status !== 'refute'}
					{shapes}
					{flash}
					isPromotion={(f, to) => game?.isPromotion(f as never, to as never) ?? false}
					{onMove}
					label={t('safety.board')}
				/>
			</div>

			<aside class="panel card">
				{#if status === 'empty'}
					<div class="empty">
						<Check size={28} />
						<h2>{t('safety.empty')}</h2>
						<a class="btn" href={resolve('/puzzles')}>{t('nav.puzzles')}</a>
					</div>
				{:else if status === 'error'}
					<div class="empty">
						<h2>{t('puzzles.loadError')}</h2>
						<p>{t('puzzles.loadErrorText', { msg: errorMsg })}</p>
					</div>
				{:else if item}
					<div class="ask-pill" class:good={status === 'done' && correct && !testMode}>
						{#if status === 'done'}{resultTitle}{:else if status === 'refute'}{t(
								'safety.refuteTitle'
							)}{:else}{prompt}{/if}
					</div>
					<p class="side-text">
						{#if status === 'done'}{resultText}{:else if status === 'refute'}{tries
								? t('safety.refuteAgain')
								: t('safety.refuteText')}{:else}{t('safety.routine')}{/if}
					</p>
					{#if !testMode}
						<p class="meta">
							<span>{t('safety.today', { n: doneToday })}</span>
							{#if sessionTotal}<span
									>{t('safety.session', { n: sessionRight, m: sessionTotal })}</span
								>{/if}
						</p>
					{/if}

					<Dock class="sf-dock" reserve={72}>
						{#if status === 'ask' || status === 'loading'}
							<div class="actions">
								<button
									class="btn grow safe"
									data-testid="answer-safe"
									disabled={status !== 'ask'}
									onclick={() => void choose('safe')}
									><ShieldCheck size={18} /> {t('safety.safe')}</button
								>
								<button
									class="btn grow unsafe"
									data-testid="answer-unsafe"
									disabled={status !== 'ask'}
									onclick={() => void choose('unsafe')}
									><ShieldAlert size={18} /> {t('safety.unsafe')}</button
								>
							</div>
						{:else if status === 'refute'}
							<div class="actions">
								<button class="btn secondary grow" onclick={showReply}
									><Eye size={18} /> {t('safety.showReply')}</button
								>
							</div>
						{:else if status === 'done'}
							<div class="actions">
								<button
									class="btn grow"
									data-testid="safety-next"
									onclick={() => void nextOrSummary()}
									>{t('common.next')} <ArrowRight size={18} /></button
								>
							</div>
						{/if}
					</Dock>
					{#if nextReview}
						<p class="sub"><Repeat size={14} /> {t('puzzles.reviewIn', { when: nextReview })}</p>
					{/if}
				{/if}
			</aside>
		</div>
	{/if}
</div>

<style>
	.wrap {
		max-width: 1100px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
		color: var(--text-2);
	}

	.top {
		margin: 0.25rem 0 1rem;
	}

	h1 {
		font-size: clamp(1.8rem, 6vw, 2.5rem);
	}

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

	.ask-pill {
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: var(--surface-2);
		font-weight: 650;
		font-size: 1.02rem;
		line-height: 1.3;
	}

	.ask-pill.good {
		background: color-mix(in srgb, var(--good) 15%, transparent);
		color: var(--good-text);
	}

	.side-text {
		font-size: 0.92rem;
		color: var(--text-2);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		font-size: 0.82rem;
		color: var(--text-3);
		font-family: var(--font-mono);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.grow {
		flex: 1;
	}

	.btn.safe {
		background: var(--good-text);
	}

	.btn.unsafe {
		background: var(--k-mistake);
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.sub {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.empty,
	.summary {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.summary {
		padding: 1.25rem;
		max-width: 560px;
	}

	@media (max-width: 767px) {
		.board-col {
			/* über dem Auslauf-Verlauf (body::after, z 39), aber unter der Aktionsleiste (z 45):
			   sonst verschwindet die unterste Brettreihe im Verlauf */
			position: relative;
			z-index: 40;
			max-width: min(
				100%,
				calc(100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 118px)
			);
		}
		.board-col.with-bar {
			max-width: min(
				100%,
				calc(
					100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 118px -
						var(--comment-h) - 0.5rem
				)
			);
		}
		.ask-pill,
		.side-text {
			display: none;
		}
	}
</style>
