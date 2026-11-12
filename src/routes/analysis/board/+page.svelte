<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Cpu from '@lucide/svelte/icons/cpu';
	import FileInput from '@lucide/svelte/icons/file-input';
	import Copy from '@lucide/svelte/icons/copy';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import EvalBar from '#lib/ui/EvalBar.svelte';
	import MoveList from '#lib/ui/MoveList.svelte';
	import { Game, positionFromFen } from '#lib/chess/game.js';
	import { figurine } from '#lib/chess/notation.js';
	import { engine } from '#lib/engine/engine.js';
	import { toWhite, formatScore, type PvLine, type Score } from '#lib/engine/uci.js';
	import { openingFor, onOpeningsLoaded } from '#lib/data/openings.js';
	import { db } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { makeSan } from 'chessops/san';
	import { parseUci } from 'chessops/util';

	/** Alle Züge der aktuellen Linie; `ply` zeigt, wo wir stehen (Zurückblättern behält die Züge) */
	let line = $state.raw(new Game());
	let ply = $state(0);
	let v = $state(0);
	let orientation = $state<'white' | 'black'>('white');
	let engineOn = $state(true);
	let lines = $state<PvLine[]>([]);
	let depth = $state(0);
	let showLoad = $state(false);
	let loadText = $state('');
	let loadError = $state('');
	let copied = $state(false);
	let openingsReady = $state(0);
	let abort: AbortController | null = null;

	const MOBILE =
		typeof navigator !== 'undefined' && /iPhone|iPad|Android/.test(navigator.userAgent);
	const MAX_DEPTH = MOBILE ? 18 : 22;

	/** Spiel bis zum aktuellen Halbzug */
	const pos = $derived.by(() => {
		void v;
		return Game.fromUciMoves(
			line.moves.slice(0, ply).map((m) => m.uci),
			line.startFen
		);
	});
	const fen = $derived(pos.fen);
	const dests = $derived(pos.end() ? new Map<string, string[]>() : pos.dests());
	const lastMove = $derived(pos.lastMove);
	const moves = $derived.by(() => {
		void v;
		return [...line.moves];
	});
	const score = $derived<Score | null>(
		lines[0] ? toWhite({ cp: lines[0].cp, mate: lines[0].mate }, pos.turn) : null
	);
	const shapes = $derived<Shape[]>(
		engineOn && lines[0]?.pv[0]
			? [
					{
						orig: lines[0].pv[0].slice(0, 2),
						dest: lines[0].pv[0].slice(2, 4),
						brush: 'info'
					}
				]
			: []
	);
	const opening = $derived.by(() => {
		void openingsReady;
		return openingFor(pos.moves.map((m) => m.uci));
	});

	onMount(() => {
		const off = onOpeningsLoaded(() => openingsReady++);
		void (async () => {
			const p = page.url.searchParams;
			const gameId = Number(p.get('game'));
			if (gameId) {
				const r = await db.games.get(gameId);
				if (r) {
					line = Game.fromUciMoves(r.moves, r.startFen);
					orientation = r.myColor;
					ply = Math.min(Number(p.get('ply') ?? r.moves.length), r.moves.length);
					v++;
				}
			} else if (p.get('fen')) {
				try {
					line = new Game(p.get('fen')!);
					v++;
				} catch {
					/* ungültige Stellung – Grundstellung */
				}
			}
			analyse();
		})();
		return off;
	});

	onDestroy(() => {
		abort?.abort();
		engine.stop();
	});

	function sanLine(startFen: string, pv: string[], n = 10): string {
		const p = positionFromFen(startFen);
		const out: string[] = [];
		let moveNo = Number(startFen.split(' ')[5] ?? 1);
		let white = p.turn === 'white';
		for (const [i, u] of pv.slice(0, n).entries()) {
			const m = parseUci(u);
			if (!m || !p.isLegal(m)) break;
			const san = figurine(makeSan(p, m));
			if (white) out.push(`${moveNo}. ${san}`);
			else out.push(i === 0 ? `${moveNo}… ${san}` : san);
			if (!white) moveNo++;
			white = !white;
			p.play(m);
		}
		return out.join(' ');
	}

	/** Engine neu starten, sobald sich die Stellung ändert */
	function analyse() {
		abort?.abort();
		engine.stop();
		lines = [];
		depth = 0;
		if (!engineOn || pos.end()) return;
		const ctl = new AbortController();
		abort = ctl;
		const at = fen;
		void engine.analyse({
			fen: at,
			depth: MAX_DEPTH,
			multipv: 3,
			signal: ctl.signal,
			onInfo: (ls) => {
				if (ctl.signal.aborted || at !== fen) return;
				lines = ls;
				depth = ls[0]?.depth ?? 0;
			}
		});
	}

	function onMove(uci: string) {
		const g = Game.fromUciMoves(
			line.moves.slice(0, ply).map((m) => m.uci),
			line.startFen
		);
		const mv = g.play(uci);
		if (!mv) {
			v++;
			return;
		}
		// gleicher Zug wie in der Linie → einfach vorwärts, sonst neue Linie ab hier
		if (line.moves[ply]?.uci !== mv.uci) line = g;
		ply++;
		v++;
		sound.move(!!mv.captured, g.isCheck);
		analyse();
	}

	function go(p: number) {
		const next = Math.max(0, Math.min(line.moves.length, p));
		if (next === ply) return;
		ply = next;
		analyse();
	}

	function playBest(i = 0) {
		const u = lines[i]?.pv[0];
		if (u) onMove(u);
	}

	function toggleEngine() {
		engineOn = !engineOn;
		analyse();
	}

	function reset() {
		line = new Game();
		ply = 0;
		v++;
		analyse();
	}

	function load() {
		loadError = '';
		const txt = loadText.trim();
		try {
			if (/^[rnbqkpRNBQKP1-8/]+ [wb] /.test(txt)) line = new Game(txt);
			else line = Game.fromPgn(txt);
			ply = line.moves.length;
			v++;
			showLoad = false;
			loadText = '';
			analyse();
		} catch {
			loadError = t('board2.loadError');
		}
	}

	async function copy(kind: 'fen' | 'pgn') {
		await navigator.clipboard.writeText(kind === 'fen' ? fen : line.toPgn());
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
		if (e.key === 'ArrowLeft') go(ply - 1);
		else if (e.key === 'ArrowRight') go(ply + 1);
		else if (e.key === ' ') {
			e.preventDefault();
			playBest();
		} else if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
	}
</script>

<svelte:head><title>{t('board2.title')} – Rookie</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div class="top-line">
	<a class="back" href={resolve('/analysis')}><ArrowLeft size={18} /> {t('nav.games')}</a>
	{#if opening}<span class="opening">{opening.name}</span>{/if}
</div>

<div class="arena">
	<div class="board-col">
		<div class="board-row">
			<EvalBar score={engineOn ? score : null} {orientation} />
			<div class="board-wrap">
				<Board
					{fen}
					{orientation}
					turnColor={pos.turn}
					{lastMove}
					check={pos.isCheck}
					{dests}
					movableColor="both"
					{shapes}
					isPromotion={(f, to) => pos.isPromotion(f as never, to as never)}
					{onMove}
					label={t('board2.title')}
				/>
			</div>
		</div>
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
			<button onclick={() => go(line.moves.length)} aria-label={t('analysis.nav.last')}
				><ChevronsRight size={22} /></button
			>
			<button
				onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')}
				aria-label={t('analysis.nav.flip')}><RefreshCw size={19} /></button
			>
		</div>

		<!-- Engine direkt unter dem Brett -->
		<section class="engine card" class:off={!engineOn}>
			<div class="e-head">
				<button
					class="e-toggle"
					class:on={engineOn}
					onclick={toggleEngine}
					role="switch"
					aria-checked={engineOn}
				>
					<Cpu size={16} /> Stockfish
				</button>
				{#if engineOn}
					<span class="e-score">{score ? formatScore(score) : '…'}</span>
					<span class="e-depth">{t('board2.depth', { n: depth })}</span>
				{/if}
			</div>
			{#if engineOn}
				<ol class="pvs">
					{#each lines as l, i (l.multipv)}
						<li>
							<button class="pv" onclick={() => playBest(i)}>
								<b>{formatScore(toWhite({ cp: l.cp, mate: l.mate }, pos.turn))}</b>
								<span>{sanLine(fen, l.pv)}</span>
							</button>
						</li>
					{:else}
						<li class="muted">{pos.end() ? t('board2.gameOver') : t('board2.thinking')}</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>

	<aside class="side card">
		<h1>{t('board2.title')}</h1>
		<p class="muted">{t('board2.hint')}</p>
		<div class="moves">
			<MoveList
				{moves}
				current={ply}
				blackStarts={line.startFen.split(' ')[1] === 'b'}
				onSelect={go}
			/>
		</div>
		<div class="row">
			<button class="btn secondary" onclick={() => (showLoad = !showLoad)}
				><FileInput size={17} /> {t('board2.load')}</button
			>
			<button class="btn secondary" onclick={() => copy('pgn')}><Copy size={16} /> PGN</button>
			<button class="btn secondary" onclick={() => copy('fen')}><Copy size={16} /> FEN</button>
			<button class="btn secondary" onclick={reset}
				><RotateCcw size={16} /> {t('board2.reset')}</button
			>
		</div>
		{#if copied}<p class="ok">{t('board2.copied')}</p>{/if}
		{#if showLoad}
			<textarea
				bind:value={loadText}
				rows="5"
				placeholder={t('board2.loadPlaceholder')}
				spellcheck="false"
				autocapitalize="off"></textarea>
			{#if loadError}<p class="err">{loadError}</p>{/if}
			<button class="btn" onclick={load} disabled={!loadText.trim()}>{t('board2.loadGo')}</button>
		{/if}
	</aside>
</div>

<style>
	.top-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		max-width: 1100px;
		margin-bottom: 0.75rem;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
		color: var(--text-2);
	}

	.opening {
		font-size: 0.82rem;
		font-weight: 650;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		background: var(--c-learn-soft);
		color: var(--c-learn);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 60%;
	}

	.arena {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		max-width: 1100px;
	}

	.board-col {
		min-width: 0;
		width: 100%;
		max-width: min(640px, calc(100dvh - 200px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}

	.board-row {
		display: flex;
		gap: 0.5rem;
	}

	.board-wrap {
		flex: 1;
		min-width: 0;
	}

	.nav {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.nav button {
		display: grid;
		place-items: center;
		height: 44px;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-1);
		cursor: pointer;
	}

	.engine {
		min-width: 0;
		margin-top: 0.6rem;
		padding: 0.75rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.e-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.e-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 30px;
		padding: 0 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface-2);
		color: var(--text-2);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
	}

	.e-toggle.on {
		background: var(--c-analysis);
		border-color: var(--c-analysis);
		color: #1a1206;
	}

	.e-score {
		font-family: var(--font-num);
		font-size: 1.2rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.e-depth {
		margin-left: auto;
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.pvs {
		min-width: 0;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.pv {
		display: flex;
		gap: 0.6rem;
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: none;
		border-radius: 9px;
		background: var(--surface-2);
		color: var(--text);
		font: inherit;
		font-size: 0.86rem;
		text-align: left;
		cursor: pointer;
	}

	.pv b {
		flex: none;
		min-width: 3.2rem;
		font-variant-numeric: tabular-nums;
	}

	.pv span {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.1rem;
	}

	.side h1 {
		font-size: 1.35rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.moves {
		max-height: 300px;
		overflow-y: auto;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	textarea {
		width: 100%;
		padding: 0.6rem;
		border-radius: 12px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--text);
		font:
			0.85rem ui-monospace,
			monospace;
	}

	.ok {
		color: var(--good-text);
		font-weight: 650;
	}

	.err {
		color: var(--bad);
	}
</style>
