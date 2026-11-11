<script lang="ts">
	import Dock from '#lib/ui/Dock.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Eye from '@lucide/svelte/icons/eye';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Flame from '@lucide/svelte/icons/flame';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Zap from '@lucide/svelte/icons/zap';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Target from '@lucide/svelte/icons/target';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Info from '@lucide/svelte/icons/info';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import { PuzzleRun, pickPuzzle, dailyPuzzle, type Puzzle } from '#lib/training/puzzles.js';
	import { applyPuzzleResult, getPuzzleRating, isProvisional } from '#lib/training/rating.js';
	import { review, dueCards, formatInterval } from '#lib/training/srs.js';
	import { THEMES, themeName, themeAbout } from '#lib/data/themes.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { notifyProgress } from '#lib/ui/progress.js';
	import { db, bumpActivity, today, getSetting, setSetting } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { engine } from '#lib/engine/engine.js';
	import { scoreToCp } from '#lib/engine/uci.js';
	import type { Rating } from '#lib/training/glicko2.js';

	type Mode = 'rated' | 'review' | 'daily' | 'mistakes' | 'theme';

	let mode = $state<Mode>('rated');
	let theme = $state<string | null>(null);
	let showAllThemes = $state(false);

	let rating = $state<Rating | null>(null);
	let delta = $state<number | null>(null);
	let dueCount = $state(0);
	let mistakeCount = $state(0);
	let streak = $state(0);
	let solvedToday = $state(0);

	let run = $state.raw<PuzzleRun | null>(null);
	let v = $state(0);
	let status = $state<'loading' | 'intro' | 'solving' | 'solved' | 'failed' | 'empty' | 'error'>(
		'loading'
	);
	let feedback = $state<'' | 'good' | 'bad'>('');
	let shapes = $state<Shape[]>([]);
	let usedHint = $state(false);
	let usedSolution = $state(false);
	let nextReview = $state<string | null>(null);
	let errorMsg = $state('');
	let dailyDone = $state(false);
	let praiseIdx = $state(0);

	const fen = $derived.by(() => {
		void v;
		return run?.game.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1';
	});
	const lastMove = $derived.by(() => {
		void v;
		return run?.game.lastMove;
	});
	const turn = $derived.by(() => {
		void v;
		return run?.game.turn ?? 'white';
	});
	const check = $derived.by(() => {
		void v;
		return run?.game.isCheck ?? false;
	});
	const dests = $derived.by(() => {
		void v;
		return status === 'solving' && run ? run.game.dests() : new Map<string, string[]>();
	});
	const orientation = $derived(run?.playerColor ?? 'white');
	const puzzle = $derived(run?.puzzle ?? null);

	onMount(async () => {
		const q = page.url.searchParams;
		const m = q.get('mode') as Mode | null;
		if (q.get('theme')) {
			mode = 'theme';
			theme = q.get('theme');
		} else if (m && ['rated', 'review', 'daily', 'mistakes'].includes(m)) mode = m;
		rating = await getPuzzleRating();
		await refreshCounts();
		next();
	});

	async function refreshCounts() {
		dueCount = (await dueCards('puzzle')).length;
		mistakeCount = (await dueCards('mistake')).length;
		const act = await db.activity.get(today());
		solvedToday = act?.puzzles ?? 0;
		dailyDone = (await getSetting<string>('dailyDone', '')) === today();
	}

	async function seenIds(): Promise<Set<string>> {
		const recent = await db.puzzleAttempts.orderBy('date').reverse().limit(3000).toArray();
		return new Set(recent.map((a) => a.puzzleId));
	}

	async function loadPuzzle(): Promise<Puzzle | null> {
		if (mode === 'review') {
			const due = await dueCards('puzzle');
			return (due[0]?.data as Puzzle) ?? null;
		}
		if (mode === 'mistakes') {
			const due = await dueCards('mistake');
			const pick = due[0] ?? (await db.reviewCards.where('kind').equals('mistake').first());
			return (pick?.data as Puzzle) ?? null;
		}
		if (mode === 'daily') return dailyPuzzle(today());
		return pickPuzzle({
			rating: rating?.rating ?? 800,
			theme: mode === 'theme' ? theme : null,
			exclude: await seenIds()
		});
	}

	async function next() {
		status = 'loading';
		feedback = '';
		shapes = [];
		usedHint = false;
		usedSolution = false;
		nextReview = null;
		delta = null;
		try {
			const p = await loadPuzzle();
			if (!p) {
				run = null;
				status = 'empty';
				return;
			}
			run = new PuzzleRun(p);
			v++;
			if (p.source === 'mistake') {
				status = 'solving';
				return;
			}
			status = 'intro';
			await new Promise((r) => setTimeout(r, 650));
			run.playIntro();
			sound.move(!!run.game.moves.at(-1)?.captured, run.game.isCheck);
			v++;
			status = 'solving';
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error';
			status = 'error';
		}
	}

	async function onMove(uci: string) {
		if (!run || status !== 'solving') return;
		// Eigene Fehler: auch andere gute Züge gelten (Engine prüft)
		if (
			run.puzzle.source === 'mistake' &&
			uci !== run.expected &&
			!(run.expected ?? '').startsWith(uci)
		) {
			status = 'intro';
			const ok = await isGoodAlternative(run.game.fen, uci, run.expected ?? '');
			status = 'solving';
			if (ok && run.acceptAlternative(uci)) {
				sound.move(!!run.game.moves.at(-1)?.captured, run.game.isCheck);
				v++;
				return finish(true);
			}
		}
		const res = run.try(uci);
		shapes = [];
		if (res.result === 'wrong') {
			v++;
			feedback = 'bad';
			sound.bad();
			setTimeout(() => (feedback = ''), 600);
			// Erster Fehler → Puzzle zählt als verfehlt (Rating), aber man darf weiter probieren
			if (run.mistakes === 1) recordFailure();
			return;
		}
		sound.move(!!run.game.moves.at(-1)?.captured, run.game.isCheck);
		v++;
		if (res.done) return finish(true);
		feedback = 'good';
		setTimeout(() => (feedback = ''), 500);
		// Gegnerantwort nach kurzer Pause
		status = 'intro';
		setTimeout(() => {
			if (!run) return;
			run.playReply();
			sound.move(!!run.game.moves.at(-1)?.captured, run.game.isCheck);
			v++;
			status = 'solving';
		}, 450);
	}

	async function isGoodAlternative(fen: string, uci: string, best: string): Promise<boolean> {
		try {
			const res = await engine.analyse({ fen, depth: 10, multipv: 4 });
			const top = res.lines[0];
			const mine = res.lines.find((l) => l.pv[0] === uci);
			if (!top || !mine || !best) return false;
			return scoreToCp(top) - scoreToCp(mine) <= 60;
		} catch {
			return false;
		}
	}

	let failureRecorded = false;
	async function recordFailure() {
		if (failureRecorded || !run) return;
		failureRecorded = true;
		await recordResult(false);
	}

	async function recordResult(solved: boolean) {
		if (!run) return;
		const p = run.puzzle;
		const rated = (mode === 'rated' || mode === 'theme') && p.source === 'lichess';
		let ratingAfter = rating?.rating ?? 0;
		if (rated) {
			const r = await applyPuzzleResult(p.rating, solved);
			rating = r.after;
			ratingAfter = r.after.rating;
			delta = Math.round(r.after.rating - r.before.rating);
		}
		await db.puzzleAttempts.add({
			puzzleId: p.id,
			date: Date.now(),
			solved,
			ratingAfter: Math.round(ratingAfter),
			themes: p.themes,
			source: p.source
		});
		// Wiederholung planen
		const kind = p.source === 'mistake' ? 'mistake' : 'puzzle';
		const id = `${kind}:${p.id}`;
		const existing = await db.reviewCards.get(id);
		if (!solved || existing) {
			const row = await review(id, kind, solved ? (usedHint ? 'hard' : 'good') : 'again', p);
			nextReview = formatInterval(row.due);
		}
	}

	async function finish(solved: boolean) {
		if (!run) return;
		const clean = solved && run.mistakes === 0 && !usedSolution;
		praiseIdx = Math.floor(Math.random() * 4);
		status = clean ? 'solved' : 'failed';
		if (clean) {
			feedback = 'good';
			sound.good();
			streak++;
			await recordResult(true);
		} else {
			streak = 0;
			if (!failureRecorded) await recordResult(false);
		}
		failureRecorded = false;
		if (solved || usedSolution) {
			await bumpActivity('puzzles');
			notifyProgress();
			if (mode === 'daily') await setSetting('dailyDone', today());
		}
		await refreshCounts();
		setTimeout(() => (feedback = ''), 900);
	}

	function hint() {
		if (!run || status !== 'solving' || !run.expected) return;
		const exp = run.expected;
		if (!usedHint) {
			shapes = [{ orig: exp.slice(0, 2), brush: 'hint' }];
			usedHint = true;
		} else {
			shapes = [{ orig: exp.slice(0, 2), dest: exp.slice(2, 4), brush: 'hint' }];
		}
	}

	async function showSolution() {
		if (!run || status !== 'solving') return;
		usedSolution = true;
		if (!failureRecorded) await recordFailure();
		status = 'intro';
		while (run && !run.done) {
			const mv = run.showNext();
			if (mv) shapes = [{ orig: mv.slice(0, 2), dest: mv.slice(2, 4), brush: 'good' }];
			sound.move(false, run.game.isCheck);
			v++;
			await new Promise((r) => setTimeout(r, 700));
		}
		finish(false);
	}

	function retry() {
		if (!run) return;
		const p = run.puzzle;
		run = new PuzzleRun(p);
		if (p.source !== 'mistake') run.playIntro();
		v++;
		shapes = [];
		usedHint = false;
		usedSolution = false;
		status = 'solving';
	}

	function setMode(m: Mode, t: string | null = null) {
		mode = m;
		theme = t;
		streak = 0;
		next();
	}

	const coreThemes = THEMES.filter((t) => t.core);
	const prompt = $derived(
		status === 'intro'
			? t('puzzles.opponentMoves')
			: status === 'solved'
				? t('puzzles.solved')
				: status === 'failed'
					? t('puzzles.failed')
					: orientation === 'white'
						? t('puzzles.whiteToMove')
						: t('puzzles.blackToMove')
	);

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
		if (
			(e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') &&
			(status === 'solved' || status === 'failed')
		) {
			e.preventDefault();
			next();
		}
		if (e.key === 'h') hint();
	}
</script>

<svelte:head><title>{t('puzzles.title')} – Rookie</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div class="wrap">
	<header class="top">
		<div>
			<span class="eyebrow">{t('puzzles.eyebrow')}</span>
			<h1>{t('puzzles.title')}</h1>
		</div>
		<div class="stats">
			<div class="rating card" title={t('puzzles.ratingTitle')}>
				<span class="r-label">{t('puzzles.rating')}</span>
				<span class="r-val">
					{rating ? Math.round(rating.rating) : '–'}{#if rating && isProvisional(rating)}<span
							class="prov">?</span
						>{/if}
				</span>
				{#if delta !== null}
					<span class="delta" class:up={delta > 0} class:down={delta < 0}
						>{delta > 0 ? '+' : ''}{delta}</span
					>
				{/if}
			</div>
			<div class="mini card" title={t('puzzles.streakTitle')}>
				<Flame size={16} /><b>{streak}</b>
			</div>
		</div>
	</header>

	<nav class="modes" aria-label={t('puzzles.modes')}>
		<button class="chip" class:on={mode === 'rated'} onclick={() => setMode('rated')}
			><Target size={15} /> {t('puzzles.forYou')}</button
		>
		<button class="chip" class:on={mode === 'daily'} onclick={() => setMode('daily')}>
			<CalendarDays size={15} />
			{t('puzzles.daily')}
			{#if dailyDone}<Check size={14} />{/if}
		</button>
		<button class="chip" class:on={mode === 'review'} onclick={() => setMode('review')}>
			<Repeat size={15} />
			{t('puzzles.review')}
			{#if dueCount}<span class="count">{dueCount}</span>{/if}
		</button>
		<button class="chip" class:on={mode === 'mistakes'} onclick={() => setMode('mistakes')}>
			<Sparkles size={15} />
			{t('puzzles.mistakes')}
			{#if mistakeCount}<span class="count">{mistakeCount}</span>{/if}
		</button>
		<a class="chip storm" href={resolve('/puzzles/storm')}><Zap size={15} /> {t('storm.title')}</a>
		<span class="sep" aria-hidden="true"></span>
		{#each showAllThemes ? THEMES : coreThemes as th (th.key)}
			<button
				class="chip theme"
				class:on={mode === 'theme' && theme === th.key}
				onclick={() => setMode('theme', th.key)}
				title={themeAbout(th.key)}
			>
				{themeName(th.key)}
			</button>
		{/each}
		<button class="chip ghost" onclick={() => (showAllThemes = !showAllThemes)}>
			{showAllThemes ? t('puzzles.fewer') : t('puzzles.allThemes')}
		</button>
	</nav>

	<div class="arena">
		<div class="board-col">
			<Board
				{fen}
				{orientation}
				turnColor={turn}
				{lastMove}
				{check}
				{dests}
				movableColor={orientation}
				{shapes}
				flash={feedback}
				isPromotion={(f, t) => run?.game.isPromotion(f as never, t as never) ?? false}
				{onMove}
				label={t('puzzles.board')}
			/>
		</div>

		<aside class="panel card">
			{#if status === 'empty'}
				<div class="empty">
					<Check size={28} />
					<h2>{mode === 'review' ? t('puzzles.allDone') : t('puzzles.nothing')}</h2>
					<p>
						{mode === 'review' ? t('puzzles.allDoneText') : t('puzzles.nothingText')}
					</p>
					<button class="btn" onclick={() => setMode('rated')}>{t('puzzles.newPuzzles')}</button>
				</div>
			{:else if status === 'error'}
				<div class="empty">
					<X size={28} />
					<h2>{t('puzzles.loadError')}</h2>
					<p>{t('puzzles.loadErrorText', { msg: errorMsg })}</p>
					<button class="btn" onclick={next}>{t('common.retry')}</button>
				</div>
			{:else}
				<div
					class="turn-pill {orientation}"
					class:solved={status === 'solved'}
					class:failed={status === 'failed'}
				>
					{#if status === 'solved'}<Check size={18} />{:else if status === 'failed'}<Info
							size={18}
						/>{:else}<span class="dot"></span>{/if}
					<span>{prompt}</span>
				</div>

				{#if puzzle}
					<div class="meta">
						{#if puzzle.source === 'mistake'}
							<span class="tag mistake">{t('puzzles.fromGame')}</span>
							{#if puzzle.note}<p class="note">{puzzle.note}</p>{/if}
						{:else}
							<span class="tag">{t('puzzles.puzzleRating', { r: puzzle.rating })}</span>
						{/if}
						{#if status === 'solved' || status === 'failed'}
							<div class="themes">
								{#each puzzle.themes.filter( (k) => THEMES.some((x) => x.key === k && !['short', 'long', 'crushing', 'middlegame'].includes(k)) ) as k (k)}
									<button class="theme-tag" onclick={() => setMode('theme', k)}
										>{themeName(k)}</button
									>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if status === 'solved' || status === 'failed'}
					<Dock class="pz-dock">
						<div class="result" class:good={status === 'solved'}>
							{#if status === 'solved'}
								<p class="big">
									{usedHint ? t('puzzles.withHint') : t('puzzles.praise').split('|')[praiseIdx]}
								</p>
							{:else}
								<p class="big">{t('puzzles.noProblem')}</p>
							{/if}
							{#if nextReview}
								<p class="sub">
									<Repeat size={14} />
									{t('puzzles.reviewIn', { when: nextReview })}
								</p>
							{/if}
						</div>
						<div class="actions">
							<button class="btn grow" onclick={next}
								>{t('common.next')} <ArrowRight size={18} /></button
							>
							{#if status === 'failed'}
								<button class="btn secondary" onclick={retry} title={t('common.retry')}
									><RotateCcw size={18} /></button
								>
							{/if}
						</div>
					</Dock>
					<p class="kbd">{t('common.enterNext')}</p>
				{:else}
					<Dock class="pz-dock">
						{#if run && run.mistakes > 0}
							<p class="try-again">{t('puzzles.tryAgain')}</p>
						{/if}
						<div class="actions">
							<button class="btn secondary grow" onclick={hint} disabled={status !== 'solving'}>
								<Lightbulb size={18} />
								{usedHint ? t('common.moreHint') : t('common.hint')}
							</button>
							<button
								class="btn secondary grow"
								onclick={showSolution}
								disabled={status !== 'solving'}
							>
								<Eye size={18} />
								{t('common.solution')}
							</button>
						</div>
					</Dock>
				{/if}

				<div class="today">
					<span>{t('puzzles.today')}</span>
					<b>{solvedToday}</b>
				</div>
			{/if}
		</aside>
	</div>
</div>

<style>
	.wrap {
		max-width: 1100px;
	}

	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.5rem 0 1rem;
	}

	h1 {
		font-size: clamp(2rem, 6vw, 2.75rem);
	}

	.stats {
		display: flex;
		gap: 0.5rem;
	}

	.rating {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 0.45rem 0.9rem;
		min-width: 92px;
	}

	.r-label {
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.r-val {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.1;
		color: var(--c-puzzle);
	}

	.prov {
		font-size: 0.9rem;
		color: var(--text-3);
		margin-left: 1px;
	}

	.delta {
		position: absolute;
		top: -8px;
		right: -8px;
		font-size: 0.75rem;
		font-weight: 750;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: var(--surface-2);
		animation: pop 420ms var(--ease-spring);
	}

	.delta.up {
		background: var(--good);
		color: #fff;
	}

	.delta.down {
		background: var(--bad);
		color: #fff;
	}

	.mini {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.85rem;
		color: var(--accent);
		font-family: var(--font-display);
		font-size: 1.1rem;
	}

	.modes {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding: 2px 2px 0.75rem;
		margin: 0 -1.1rem 0.5rem;
		padding-inline: 1.1rem;
		scrollbar-width: none;
		flex-wrap: nowrap;
	}

	@media (min-width: 768px) {
		.modes {
			flex-wrap: wrap;
			margin-inline: 0;
			padding-inline: 2px;
		}
	}

	.chip {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 36px;
		padding: 0 0.85rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--text-2);
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out),
			transform var(--dur-fast) var(--ease-out);
	}

	.chip:active {
		transform: scale(0.95);
	}

	.chip.on {
		background: var(--c-puzzle);
		border-color: var(--c-puzzle);
		color: var(--on-accent);
	}

	.chip.theme.on {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
	}

	.chip.storm {
		color: var(--c-puzzle);
		border-color: color-mix(in srgb, var(--c-puzzle) 40%, transparent);
		text-decoration: none;
	}

	.chip.ghost {
		border-style: dashed;
	}

	.count {
		font-size: 0.72rem;
		font-weight: 750;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		line-height: 1.5;
	}

	.sep {
		flex: none;
		width: 1px;
		height: 22px;
		align-self: center;
		background: var(--line-strong);
		margin: 0 0.2rem;
	}

	.arena {
		display: grid;
		gap: 1rem;
	}

	.board-col {
		width: 100%;
		max-width: min(640px, calc(100dvh - 260px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 320px;
			align-items: start;
		}
		.board-col {
			max-width: min(680px, calc(100dvh - 220px));
		}
		.panel {
			position: sticky;
			top: 2rem;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.15rem;
	}

	.turn-pill {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: var(--surface-2);
		font-weight: 650;
		font-size: 1.02rem;
		line-height: 1.3;
		transition: background-color var(--dur) var(--ease-out);
	}

	.dot {
		flex: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--line-strong);
	}

	.turn-pill.white .dot {
		background: #fff;
	}

	.turn-pill.black .dot {
		background: #222;
	}

	.turn-pill.solved {
		background: color-mix(in srgb, var(--good) 15%, transparent);
		color: var(--good);
	}

	.turn-pill.failed {
		background: color-mix(in srgb, var(--warn) 18%, transparent);
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tag {
		align-self: flex-start;
		font-size: 0.78rem;
		font-weight: 650;
		color: var(--text-3);
	}

	.tag.mistake {
		color: var(--accent);
	}

	.note {
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.themes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.theme-tag {
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: none;
		background: var(--c-puzzle-soft);
		color: var(--c-puzzle);
		cursor: pointer;
	}

	.result {
		animation: rise 360ms var(--ease-out);
	}

	.big {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 680;
		letter-spacing: -0.01em;
	}

	.result.good .big {
		color: var(--good);
	}

	.sub {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.35rem;
		font-size: 0.88rem;
		color: var(--text-2);
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

	.kbd {
		font-size: 0.78rem;
		color: var(--text-3);
		text-align: center;
		margin-top: -0.4rem;
	}

	@media (hover: none) {
		.kbd {
			display: none;
		}
	}

	.try-again {
		color: var(--bad);
		font-weight: 600;
		font-size: 0.92rem;
		animation: rise 260ms var(--ease-out);
	}

	.today {
		display: flex;
		justify-content: space-between;
		padding-top: 0.85rem;
		border-top: 1px solid var(--line);
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.6rem;
		padding: 1rem 0.5rem;
		color: var(--text-2);
	}

	.empty h2 {
		color: var(--text);
		font-size: 1.3rem;
	}

	@keyframes pop {
		from {
			transform: scale(0.4);
			opacity: 0;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	/* Handy: Brett so groß, dass es neben der Aktionsleiste ganz sichtbar bleibt */
	@media (max-width: 767px) {
		.board-col {
			max-width: min(
				100%,
				calc(
					100dvh - var(--dock-h) - var(--tabbar-h) - var(--safe-bottom) - var(--safe-top) - 190px
				)
			);
		}
	}
</style>
