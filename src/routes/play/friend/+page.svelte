<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Flag from '@lucide/svelte/icons/flag';
	import Handshake from '@lucide/svelte/icons/handshake';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Board from '#lib/ui/board/Board.svelte';
	import MoveList from '#lib/ui/MoveList.svelte';
	import { Game, type GameEnd } from '#lib/chess/game.js';
	import { db, getSetting, setSetting, bumpActivity } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	type Color = 'white' | 'black';

	let game = $state.raw(new Game());
	let v = $state(0);
	let autoFlip = $state(true);
	let ended = $state<GameEnd | null>(null);
	let manual = $state<{ winner: Color | null } | null>(null);
	let savedId = $state<number | null>(null);

	const fen = $derived.by(() => {
		void v;
		return game.fen;
	});
	const turn = $derived.by(() => {
		void v;
		return game.turn;
	});
	const lastMove = $derived.by(() => {
		void v;
		return game.lastMove;
	});
	const check = $derived.by(() => {
		void v;
		return game.isCheck;
	});
	const moves = $derived.by(() => {
		void v;
		return [...game.moves];
	});
	const over = $derived(!!ended || !!manual);
	const dests = $derived.by(() => {
		void v;
		return over ? new Map<string, string[]>() : game.dests();
	});
	const orientation = $derived<Color>(autoFlip ? turn : 'white');

	const sideName = (c: Color) => (c === 'white' ? t('friend.white') : t('friend.black'));

	onMount(async () => {
		autoFlip = await getSetting('friendAutoFlip', true);
	});

	function onMove(uci: string) {
		if (over) return;
		const mv = game.play(uci);
		if (!mv) {
			v++;
			return;
		}
		sound.move(!!mv.captured, game.isCheck);
		v++;
		const end = game.end();
		if (end) void finish(end);
	}

	function undo() {
		if (over || game.ply === 0) return;
		game.undo(1);
		v++;
	}

	function resign() {
		const side = turn;
		if (!confirm(t('friend.resignConfirm', { side: sideName(side) }))) return;
		game.resign(side);
		manual = { winner: side === 'white' ? 'black' : 'white' };
		void save();
	}

	function draw() {
		manual = { winner: null };
		void save('1/2-1/2');
	}

	async function finish(end: GameEnd) {
		ended = end;
		sound.end('win');
		await save();
	}

	async function save(forced?: '1/2-1/2') {
		const outcome = game.outcome();
		const result =
			forced ??
			(outcome?.winner === 'white' ? '1-0' : outcome?.winner === 'black' ? '0-1' : '1/2-1/2');
		if (game.ply < 2) return;
		savedId = (await db.games.add({
			date: Date.now(),
			pgn: game.toPgn({ White: t('friend.white'), Black: t('friend.black'), Result: result }),
			moves: game.moves.map((m) => m.uci),
			startFen: game.startFen,
			result,
			myColor: 'white',
			opponent: t('stats.source.friend'),
			source: 'friend'
		})) as number;
		await bumpActivity('games');
	}

	function newGame() {
		game = new Game();
		ended = null;
		manual = null;
		savedId = null;
		v++;
	}

	async function toggleFlip() {
		autoFlip = !autoFlip;
		await setSetting('friendAutoFlip', autoFlip);
	}

	const resultText = $derived.by(() => {
		if (manual)
			return manual.winner
				? t('friend.wins', { side: sideName(manual.winner) })
				: t('friend.drawn');
		if (!ended) return '';
		const w = game.outcome()?.winner;
		return w ? t('friend.wins', { side: sideName(w) }) : t('friend.drawn');
	});
</script>

<svelte:head><title>{t('friend.title')} – Rookie</title></svelte:head>

<a class="back hit44" href={resolve('/play')}><ArrowLeft size={18} /> {t('nav.play')}</a>

<div class="arena">
	<div class="board-col">
		<p class="turn" class:white={turn === 'white'} role="status">
			<span class="dot"></span>
			{over ? resultText : t('friend.toMove', { side: sideName(turn) })}
		</p>
		<Board
			{fen}
			{orientation}
			turnColor={turn}
			{lastMove}
			{check}
			{dests}
			movableColor="both"
			isPromotion={(f, to) => game.isPromotion(f as never, to as never)}
			{onMove}
		/>
	</div>

	<aside class="side card">
		<h1>{t('friend.title')}</h1>
		<label class="flip">
			<input type="checkbox" checked={autoFlip} onchange={toggleFlip} />
			{t('friend.flip')}
		</label>
		<div class="moves"><MoveList {moves} /></div>
		{#if over}
			<p class="result">{resultText}</p>
			<div class="row">
				<button class="btn" onclick={newGame}><RotateCcw size={17} /> {t('friend.newGame')}</button>
				{#if savedId}
					<a class="btn secondary" href={resolve(`/analysis?game=${savedId}`)}
						><ChartLine size={17} /> {t('friend.analyse')}</a
					>
				{/if}
			</div>
		{:else}
			<div class="row">
				<button class="btn secondary" onclick={undo} disabled={game.ply === 0}
					><Undo2 size={17} /> {t('friend.undo')}</button
				>
				<button class="btn secondary" onclick={draw} disabled={game.ply < 2}
					><Handshake size={17} /> {t('friend.draw')}</button
				>
				<button class="btn secondary danger" onclick={resign} disabled={game.ply < 2}
					><Flag size={17} /> {t('friend.resign', { side: sideName(turn) })}</button
				>
			</div>
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
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}

	.turn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
	}

	.dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #222;
		border: 1.5px solid var(--line-strong);
	}

	.turn.white .dot {
		background: #fff;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.15rem;
	}

	.side h1 {
		font-size: 1.35rem;
	}

	.flip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.92rem;
		color: var(--text-2);
	}

	.moves {
		max-height: 260px;
		overflow-y: auto;
	}

	.result {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 750;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn.danger {
		color: var(--bad);
	}
</style>
