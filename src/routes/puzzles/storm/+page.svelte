<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Zap from '@lucide/svelte/icons/zap';
	import Timer from '@lucide/svelte/icons/timer';
	import Trophy from '@lucide/svelte/icons/trophy';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Board from '#lib/ui/board/Board.svelte';
	import { pickPuzzle, PuzzleRun, type Puzzle } from '#lib/training/puzzles.js';
	import { getSetting, setSetting, bumpActivity } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { notifyProgress } from '#lib/ui/progress.js';

	const DURATION = 180_000;
	const PENALTY = 10_000;
	const START_RATING = 600;
	const STEP = 40;

	let phase = $state<'intro' | 'running' | 'over'>('intro');
	let run = $state.raw<PuzzleRun | null>(null);
	let v = $state(0);
	let score = $state(0);
	let streak = $state(0);
	let bestStreak = $state(0);
	let mistakes = $state(0);
	let left = $state(DURATION);
	let best = $state(0);
	let newBest = $state(false);
	let flash = $state<'' | 'good' | 'bad'>('');
	let penaltyFx = $state(false);
	let next: Promise<Puzzle> | null = null;
	let deadline = 0;
	let timer: ReturnType<typeof setInterval> | null = null;
	// nur intern für pickPuzzle, nicht Teil der Oberfläche
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const seen = new Set<string>();

	const fen = $derived.by(() => {
		void v;
		return run?.game.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1';
	});
	const lastMove = $derived.by(() => {
		void v;
		return run?.game.lastMove;
	});
	const dests = $derived.by(() => {
		void v;
		return phase === 'running' && run && run.game.turn === run.playerColor
			? run.game.dests()
			: new Map<string, string[]>();
	});

	onMount(async () => {
		best = await getSetting<number>('stormBest', 0);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	const rating = () => START_RATING + score * STEP;

	function prefetch() {
		next = pickPuzzle({ rating: rating() + STEP, exclude: seen });
	}

	async function load(p?: Puzzle) {
		const puzzle = p ?? (await pickPuzzle({ rating: rating(), exclude: seen }));
		seen.add(puzzle.id);
		const r = new PuzzleRun(puzzle);
		r.playIntro();
		run = r;
		v++;
		prefetch();
	}

	async function start() {
		score = 0;
		streak = 0;
		bestStreak = 0;
		mistakes = 0;
		newBest = false;
		seen.clear();
		phase = 'running';
		await load();
		deadline = Date.now() + DURATION;
		left = DURATION;
		timer = setInterval(() => {
			left = Math.max(0, deadline - Date.now());
			if (left === 0) void finish();
		}, 100);
	}

	async function advance() {
		const p = next ? await next.catch(() => undefined) : undefined;
		await load(p);
	}

	function blink(k: 'good' | 'bad') {
		flash = k;
		setTimeout(() => (flash = ''), 350);
	}

	async function onMove(uci: string) {
		if (phase !== 'running' || !run) return;
		const res = run.try(uci);
		if (res.result === 'wrong') {
			mistakes++;
			streak = 0;
			deadline -= PENALTY;
			penaltyFx = true;
			setTimeout(() => (penaltyFx = false), 600);
			sound.bad();
			blink('bad');
			// Puzzle verloren – weiter mit dem nächsten
			v++;
			await advance();
			return;
		}
		const mv = run.game.moves.at(-1);
		sound.move(!!mv?.captured, run.game.isCheck);
		v++;
		if (res.done) {
			score++;
			streak++;
			bestStreak = Math.max(bestStreak, streak);
			blink('good');
			await advance();
			return;
		}
		setTimeout(() => {
			if (!run) return;
			run.playReply();
			v++;
		}, 200);
	}

	async function finish() {
		if (phase !== 'running') return;
		phase = 'over';
		if (timer) clearInterval(timer);
		timer = null;
		if (score > best) {
			best = score;
			newBest = true;
			await setSetting('stormBest', score);
		}
		if (score > 0) await bumpActivity('puzzles', score);
		sound.end(newBest ? 'win' : 'draw');
		notifyProgress();
	}

	const clock = $derived(
		`${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
	);
</script>

<svelte:head><title>{t('storm.title')} – Rookie</title></svelte:head>

<a class="back" href={resolve('/puzzles')}><ArrowLeft size={18} /> {t('nav.puzzles')}</a>

<div class="arena">
	<div class="board-col">
		<div class="hud">
			<span class="score"><Zap size={18} /> {score}</span>
			<span class="clock" class:low={left < 30_000} class:hit={penaltyFx}
				><Timer size={17} /> {clock}</span
			>
		</div>
		<Board
			{fen}
			orientation={run?.playerColor ?? 'white'}
			turnColor={run?.game.turn}
			{lastMove}
			{dests}
			movableColor={run?.playerColor}
			{flash}
			isPromotion={(f, to) => run?.game.isPromotion(f as never, to as never) ?? false}
			onMove={(u) => void onMove(u)}
		/>
	</div>

	<aside class="panel card">
		{#if phase === 'intro'}
			<span class="ico"><Zap size={26} /></span>
			<h1>{t('storm.title')}</h1>
			<p class="muted">{t('storm.rules')}</p>
			{#if best}<p class="best"><Trophy size={16} /> {t('storm.best', { n: best })}</p>{/if}
			<button class="btn big" onclick={start}>{t('storm.start')}</button>
		{:else if phase === 'running'}
			<p class="muted">
				{t('storm.find', {
					side: run?.playerColor === 'white' ? t('common.white') : t('common.black')
				})}
			</p>
			<div class="stats">
				<span><b>{streak}</b> {t('storm.streak')}</span>
				<span><b>{mistakes}</b> {t('storm.mistakes')}</span>
			</div>
			<button class="btn secondary" onclick={() => void finish()}>{t('storm.stop')}</button>
		{:else}
			<span class="ico gold"><Trophy size={26} /></span>
			<h1>{t('storm.score', { n: score })}</h1>
			{#if newBest}<p class="best">{t('storm.newBest')}</p>{:else}<p class="muted">
					{t('storm.best', { n: best })}
				</p>{/if}
			<div class="stats">
				<span><b>{bestStreak}</b> {t('storm.bestStreak')}</span>
				<span><b>{mistakes}</b> {t('storm.mistakes')}</span>
			</div>
			<button class="btn big" onclick={start}><RotateCcw size={18} /> {t('storm.again')}</button>
		{/if}
	</aside>
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
		color: var(--text-2);
		margin-bottom: 0.75rem;
	}

	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	.board-col {
		width: 100%;
		max-width: min(620px, calc(100dvh - 240px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 320px;
			align-items: start;
		}
	}

	.hud {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.score,
	.clock {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 750;
		font-variant-numeric: tabular-nums;
	}

	.score {
		color: var(--c-puzzle);
	}

	.clock {
		padding: 0.15rem 0.7rem;
		border-radius: 10px;
		background: var(--surface);
		border: 1px solid var(--line);
		transition: color var(--dur) var(--ease-out);
	}

	.clock.low {
		color: var(--bad);
	}

	.clock.hit {
		animation: shake 420ms var(--ease-out);
		color: var(--bad);
	}

	.panel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1.2rem;
	}

	.panel h1 {
		font-size: 1.6rem;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--c-puzzle);
		color: #fff;
	}

	.ico.gold {
		background: var(--c-analysis);
	}

	.muted {
		color: var(--text-2);
		line-height: 1.5;
	}

	.best {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 700;
		color: var(--c-analysis);
	}

	.stats {
		display: flex;
		gap: 1.2rem;
		color: var(--text-2);
	}

	.stats b {
		font-size: 1.2rem;
		color: var(--text);
	}

	@keyframes shake {
		25% {
			transform: translateX(-4px);
		}
		75% {
			transform: translateX(4px);
		}
	}
</style>
