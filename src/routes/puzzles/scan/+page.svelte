<script lang="ts">
	/**
	 * Brett-Scan (lib/training/scan.ts): Schachs, Schlagzüge, hängende Figuren – für sich und den Gegner.
	 * Züge werden auf dem Brett gezogen (das Brett springt danach zurück), Figuren angetippt.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ScanEye from '@lucide/svelte/icons/scan-eye';
	import Check from '@lucide/svelte/icons/check';
	import Board from '#lib/ui/board/Board.svelte';
	import CommentBar from '#lib/ui/CommentBar.svelte';
	import Dock from '#lib/ui/Dock.svelte';
	import SegmentedSwitch from '#lib/ui/bento/SegmentedSwitch.svelte';
	import { Game, INITIAL_FEN } from '#lib/chess/game.js';
	import { db, bumpActivity } from '#lib/db/db.js';
	import { loadSafety } from '#lib/training/safety.js';
	import {
		SCAN_MODES,
		flipped,
		scoreScan,
		suitable,
		targetsOf,
		type ScanMode,
		type ScanScore
	} from '#lib/training/scan.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	type Shape = { orig: string; dest?: string; brush: 'good' | 'bad' | 'info' };

	let mode = $state<ScanMode>('hanging');
	let status = $state<'loading' | 'scan' | 'done' | 'error'>('loading');
	let fens: string[] = [];
	let fen = $state(INITIAL_FEN);
	/** Stellung, auf der gesucht wird (bei „Gegner“ umgedreht) */
	let workFen = $state(INITIAL_FEN);
	let targets = $state<string[]>([]);
	let found = $state<string[]>([]);
	let wrong = $state(0);
	let score = $state<ScanScore | null>(null);
	let started = 0;
	let seconds = $state(0);
	let flash = $state<'' | 'good' | 'bad'>('');
	let shapes = $state<Shape[]>([]);
	let session = $state({ n: 0, sum: 0 });

	const me = $derived<'white' | 'black'>(fen.split(' ')[1] === 'b' ? 'black' : 'white');
	const moveMode = $derived(mode !== 'hanging');
	const game = $derived(new Game(workFen));
	const dests = $derived(
		status === 'scan' && moveMode ? game.dests() : new Map<string, string[]>()
	);

	onMount(async () => {
		const m = page.url.searchParams.get('mode');
		if (m && (SCAN_MODES as string[]).includes(m)) mode = m as ScanMode;
		try {
			fens = (await loadSafety()).map((i) => i.fen);
		} catch {
			status = 'error';
			return;
		}
		next();
	});

	function next() {
		// eine Stellung, in der es etwas, aber nicht zu viel zu finden gibt
		for (let k = 0; k < 80; k++) {
			const f = fens[Math.floor(Math.random() * fens.length)];
			const tg = targetsOf(f, mode);
			if (!suitable(tg, mode)) continue;
			fen = f;
			workFen = mode === 'opponent' ? (flipped(f) ?? f) : f;
			targets = tg!;
			found = [];
			wrong = 0;
			score = null;
			shapes = [];
			started = Date.now();
			status = 'scan';
			return;
		}
		status = 'error';
	}

	function blink(k: 'good' | 'bad') {
		flash = k;
		setTimeout(() => (flash = ''), 350);
	}

	function hit(key: string) {
		if (found.includes(key)) {
			shapes = [...shapes]; // Brett zurücksetzen
			return;
		}
		if (targets.includes(key)) {
			found = [...found, key];
			sound.move(false, false);
			blink('good');
			if (found.length === targets.length) finish();
		} else {
			wrong++;
			blink('bad');
			sound.bad();
		}
		shapes = markShapes();
	}

	function markShapes(): Shape[] {
		return found.map((k) =>
			moveMode
				? { orig: k.slice(0, 2), dest: k.slice(2, 4), brush: 'good' }
				: { orig: k, brush: 'good' }
		);
	}

	function onMove(uci: string) {
		if (status !== 'scan' || !moveMode) return;
		hit(uci.slice(0, 4));
	}

	function onSquare(sq: string) {
		if (status !== 'scan' || moveMode) return;
		if (!game.pieceAt(sq)) return;
		hit(sq);
	}

	async function finish() {
		if (status !== 'scan') return;
		seconds = Math.round((Date.now() - started) / 1000);
		score = scoreScan(targets, found, wrong);
		status = 'done';
		shapes = [
			...markShapes(),
			...score.missed.map((k): Shape =>
				moveMode
					? { orig: k.slice(0, 2), dest: k.slice(2, 4), brush: 'bad' }
					: { orig: k, brush: 'bad' }
			)
		];
		session = { n: session.n + 1, sum: session.sum + score.score };
		if (score.score >= 1) sound.good();
		await db.puzzleAttempts.add({
			puzzleId: `scan:${mode}:${fen}`,
			date: Date.now(),
			solved: score.score >= 1,
			ratingAfter: Math.round(score.score * 100),
			themes: [mode],
			source: 'scan'
		});
		await bumpActivity('reviews');
	}

	function setMode(m: ScanMode) {
		mode = m;
		next();
	}

	const prompt = $derived(t(`scan.prompt.${mode}`, { n: targets.length }));
	const bar = $derived(
		status === 'done' && score
			? {
					kicker: t('scan.kicker'),
					title: t('scan.result', { n: score.found.length, m: targets.length, s: seconds }),
					text: [
						score.wrong ? t('scan.wrong', { n: score.wrong }) : '',
						score.missed.length ? t('scan.missed') : t('scan.perfect')
					]
						.filter(Boolean)
						.join(' '),
					color: score.score >= 1 ? 'var(--k-best)' : 'var(--c-learn)'
				}
			: {
					kicker: `${t('scan.kicker')} · ${found.length}/${targets.length}`,
					title: prompt,
					text: t(`scan.how.${mode}`),
					color: 'var(--c-learn)'
				}
	);
</script>

<svelte:head><title>{t('scan.title')} – Rookie</title></svelte:head>

<div class="wrap">
	<a class="back hit44" href={resolve('/puzzles')}><ArrowLeft size={18} /> {t('nav.puzzles')}</a>
	<header class="top">
		<span class="eyebrow">{t('scan.eyebrow')}</span>
		<h1>{t('scan.title')}</h1>
	</header>

	<div class="modes">
		<SegmentedSwitch
			label={t('scan.modeLabel')}
			value={mode}
			onchange={(m) => setMode(m)}
			options={SCAN_MODES.map((m) => ({ value: m, label: t(`scan.mode.${m}`) }))}
		/>
	</div>

	{#if status !== 'error'}
		<CommentBar
			kicker={bar.kicker}
			title={bar.title}
			text={bar.text}
			color={bar.color}
			testid="scan-bar"
			{status}
		>
			{#snippet icon()}{#if status === 'done' && score && score.score >= 1}<Check
						size={16}
					/>{:else}<ScanEye size={16} />{/if}{/snippet}
		</CommentBar>
	{/if}

	<div class="arena">
		<div class="board-col with-bar">
			<Board
				fen={workFen}
				orientation={me}
				turnColor={game.turn}
				{dests}
				movableColor={status === 'scan' && moveMode ? game.turn : undefined}
				{shapes}
				{flash}
				onMove={(u) => onMove(u)}
				onSquare={(s) => onSquare(s)}
				label={t('scan.board')}
			/>
		</div>

		<aside class="panel card" data-testid="scan-panel">
			{#if status === 'error'}
				<p>{t('puzzles.loadError')}</p>
			{:else}
				<p class="ask">{status === 'done' ? bar.title : prompt}</p>
				<p class="muted">{status === 'done' ? bar.text : t(`scan.how.${mode}`)}</p>
				<p class="meta">
					<span>{t('scan.progress', { n: found.length, m: targets.length })}</span>
					{#if wrong}<span>{t('scan.wrong', { n: wrong })}</span>{/if}
					{#if session.n}<span
							>{t('scan.session', {
								n: session.n,
								pct: Math.round((session.sum / session.n) * 100)
							})}</span
						>{/if}
				</p>
				<Dock reserve={72}>
					<div class="actions">
						{#if status === 'scan'}
							<button
								class="btn secondary grow"
								data-testid="scan-done"
								onclick={() => void finish()}>{t('scan.done')}</button
							>
						{:else}
							<button class="btn grow" data-testid="scan-next" onclick={next}
								>{t('common.next')} <ArrowRight size={18} /></button
							>
						{/if}
					</div>
				</Dock>
				<details class="why">
					<summary>{t('scan.whyTitle')}</summary>
					<p>{t('scan.why')}</p>
				</details>
			{/if}
		</aside>
	</div>
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
		margin: 0.25rem 0 0.75rem;
	}

	h1 {
		font-size: clamp(1.8rem, 6vw, 2.5rem);
	}

	.modes {
		margin-bottom: 0.75rem;
		overflow-x: auto;
	}

	.arena {
		display: grid;
		gap: 1rem;
	}

	.board-col {
		width: 100%;
		max-width: min(640px, calc(100svh - 300px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 320px;
			align-items: start;
		}
		.board-col {
			max-width: min(680px, calc(100svh - 260px));
		}
		.panel {
			position: sticky;
			top: 2rem;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.15rem;
	}

	.ask {
		font-weight: 650;
		font-size: 1.02rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.grow {
		flex: 1;
	}

	.why summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--text-2);
	}

	.why p {
		margin-top: 0.4rem;
		font-size: 0.88rem;
		color: var(--text-2);
		line-height: 1.45;
	}

	@media (max-width: 767px) {
		.board-col.with-bar {
			max-width: min(
				100%,
				calc(
					100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 175px -
						var(--comment-h) - 0.5rem
				)
			);
		}
		.ask,
		.panel > .muted,
		.eyebrow {
			display: none;
		}
		h1 {
			font-size: 1.6rem;
		}
		.top {
			margin: 0 0 0.5rem;
		}
	}
</style>
