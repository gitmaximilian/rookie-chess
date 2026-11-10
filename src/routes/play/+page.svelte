<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Flag from '@lucide/svelte/icons/flag';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Trophy from '@lucide/svelte/icons/trophy';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Timer from '@lucide/svelte/icons/timer';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import BotAvatar from '#lib/ui/BotAvatar.svelte';
	import MoveList from '#lib/ui/MoveList.svelte';
	import { BOTS, botById, chooseBotMove, thinkDelay, type Bot } from '#lib/bots/bots.js';
	import { Game, INITIAL_FEN, type GameEnd } from '#lib/chess/game.js';
	import {
		endReason,
		verdictFor,
		resultString,
		formatClock,
		colorName
	} from '#lib/chess/labels.js';
	import { engine } from '#lib/engine/engine.js';
	import { db, getSetting, setSetting, bumpActivity } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import type { Color } from 'chessops/types';

	type TimeControl = { id: string; label: string; base: number; inc: number } | null;
	const TIME_CONTROLS: NonNullable<TimeControl>[] = [
		{ id: '10', label: '10 min', base: 600_000, inc: 0 },
		{ id: '15+10', label: '15 + 10', base: 900_000, inc: 10_000 }
	];

	interface SavedGame {
		botId: string;
		myColor: Color;
		moves: string[];
		startFen: string;
		tc: string | null;
		clocks: { white: number; black: number } | null;
		hints: number;
		undos: number;
	}

	// ── Einrichtung ──
	let phase = $state<'loading' | 'setup' | 'playing'>('loading');
	let botId = $state('tina');
	let colorChoice = $state<'white' | 'black' | 'random'>('white');
	let tcChoice = $state<string | null>(null);

	// ── Partie ──
	let game = $state.raw(new Game());
	let v = $state(0);
	let bot = $state<Bot>(BOTS[3]);
	let myColor = $state<Color>('white');
	let orientation = $state<Color>('white');
	let thinking = $state(false);
	let hintShapes = $state<Shape[]>([]);
	let hintLoading = $state(false);
	let hints = $state(0);
	let undos = $state(0);
	let ended = $state<GameEnd | null>(null);
	let savedGameId = $state<number | null>(null);
	let tc = $state<TimeControl>(null);
	let clocks = $state<{ white: number; black: number } | null>(null);
	let clockTimer: ReturnType<typeof setInterval> | null = null;
	let lastTick = 0;
	let botAbort: AbortController | null = null;
	let showResult = $state(false);

	const fen = $derived.by(() => {
		void v;
		return game.fen;
	});
	const turn = $derived.by(() => {
		void v;
		return game.turn;
	});
	const moves = $derived.by(() => {
		void v;
		return [...game.moves];
	});
	const lastMove = $derived.by(() => {
		void v;
		return game.lastMove;
	});
	const check = $derived.by(() => {
		void v;
		return game.isCheck;
	});
	const myTurn = $derived(phase === 'playing' && !ended && turn === myColor && !thinking);
	const dests = $derived.by(() => {
		void v;
		return myTurn ? game.dests() : new Map<string, string[]>();
	});
	const captured = $derived.by(() => {
		void v;
		return game.capturedPieces();
	});
	const material = $derived.by(() => {
		void v;
		return game.materialBalance();
	});

	const verdict = $derived(ended ? verdictFor(ended, myColor) : null);

	onMount(async () => {
		const saved = await getSetting<SavedGame | null>('currentGame', null);
		botId = await getSetting('lastBotId', 'tina');
		if (saved && saved.moves) {
			resume(saved);
		} else {
			phase = 'setup';
		}
	});

	onDestroy(() => {
		stopClock();
		botAbort?.abort();
	});

	function resume(s: SavedGame) {
		try {
			game = Game.fromUciMoves(s.moves, s.startFen);
		} catch {
			phase = 'setup';
			return;
		}
		bot = botById(s.botId);
		myColor = s.myColor;
		orientation = s.myColor;
		tc = TIME_CONTROLS.find((t) => t.id === s.tc) ?? null;
		clocks = s.clocks;
		hints = s.hints;
		undos = s.undos;
		ended = null;
		phase = 'playing';
		v++;
		startClock();
		maybeBotMove();
	}

	async function start() {
		bot = botById(botId);
		myColor = colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice;
		orientation = myColor;
		tc = TIME_CONTROLS.find((t) => t.id === tcChoice) ?? null;
		clocks = tc ? { white: tc.base, black: tc.base } : null;
		game = new Game(INITIAL_FEN);
		hints = 0;
		undos = 0;
		ended = null;
		savedGameId = null;
		hintShapes = [];
		showResult = false;
		phase = 'playing';
		v++;
		await setSetting('lastBotId', bot.id);
		engine.newGame();
		persist();
		startClock();
		maybeBotMove();
	}

	function persist() {
		if (ended) return setSetting('currentGame', null);
		const s: SavedGame = {
			botId: bot.id,
			myColor,
			moves: game.moves.map((m) => m.uci),
			startFen: game.startFen,
			tc: tc?.id ?? null,
			clocks: clocks ? { ...clocks } : null,
			hints,
			undos
		};
		return setSetting('currentGame', s);
	}

	// ── Uhr ──
	function startClock() {
		stopClock();
		if (!clocks) return;
		lastTick = performance.now();
		clockTimer = setInterval(() => {
			if (!clocks || ended) return;
			const now = performance.now();
			const dt = now - lastTick;
			lastTick = now;
			const side = game.turn;
			clocks[side] = Math.max(0, clocks[side] - dt);
			if (clocks[side] === 0) {
				game.timeout(side);
				finish();
			}
		}, 100);
	}

	function stopClock() {
		if (clockTimer) clearInterval(clockTimer);
		clockTimer = null;
	}

	function addIncrement(side: Color) {
		if (clocks && tc) clocks[side] += tc.inc;
	}

	// ── Züge ──
	function onMove(uci: string) {
		if (!myTurn) return;
		const played = game.play(uci);
		if (!played) {
			v++;
			return;
		}
		sound.move(!!played.captured, game.isCheck);
		addIncrement(myColor);
		hintShapes = [];
		v++;
		afterMove();
	}

	function afterMove() {
		if (game.end()) return finish();
		persist();
		maybeBotMove();
	}

	async function maybeBotMove() {
		if (ended || game.turn === myColor || game.end()) return;
		thinking = true;
		botAbort = new AbortController();
		const signal = botAbort.signal;
		const t0 = performance.now();
		const fenNow = game.fen;
		try {
			const res = await engine.analyse({
				fen: fenNow,
				nodes: bot.nodes,
				multipv: bot.multipv,
				skill: bot.skill,
				signal
			});
			if (signal.aborted || game.fen !== fenNow) return;
			const choice = chooseBotMove(bot, res.lines, game.legalUcis(), game.captureUcis());
			const wait = thinkDelay(bot, game.ply) - (performance.now() - t0);
			if (wait > 0) await new Promise((r) => setTimeout(r, wait));
			if (signal.aborted || game.fen !== fenNow || !choice) return;
			const played = game.play(choice);
			if (played) {
				sound.move(!!played.captured, game.isCheck);
				addIncrement(myColor === 'white' ? 'black' : 'white');
			}
			v++;
			if (game.end()) finish();
			else persist();
		} finally {
			if (!signal.aborted) thinking = false;
		}
	}

	async function hint() {
		if (!myTurn || hintLoading) return;
		hintLoading = true;
		const res = await engine.analyse({ fen: game.fen, depth: 14, multipv: 1 });
		hintLoading = false;
		if (res.bestmove && myTurn) {
			hintShapes = [
				{ orig: res.bestmove.slice(0, 2), dest: res.bestmove.slice(2, 4), brush: 'hint' }
			];
			hints++;
			persist();
		}
	}

	function undo() {
		if (ended || game.ply === 0) return;
		botAbort?.abort();
		thinking = false;
		// bis ich wieder am Zug bin
		const n = game.turn === myColor ? 2 : 1;
		game.undo(Math.min(n, game.ply));
		if (game.turn !== myColor && game.ply > 0) game.undo(1);
		undos++;
		hintShapes = [];
		v++;
		persist();
		maybeBotMove();
	}

	function resign() {
		if (ended) return;
		if (!confirm(t('play.resignConfirm'))) return;
		botAbort?.abort();
		thinking = false;
		game.resign(myColor);
		finish();
	}

	async function finish() {
		stopClock();
		const e = game.end();
		if (!e) return;
		ended = e;
		v++;
		sound.end(verdictFor(e, myColor));
		await setSetting('currentGame', null);
		if (game.ply >= 2) {
			const result = resultString(e);
			savedGameId = (await db.games.add({
				date: Date.now(),
				pgn: game.toPgn({
					Event: t('play.event'),
					Site: 'chess.maximilianauer.at',
					Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
					White: myColor === 'white' ? t('common.you') : bot.name,
					Black: myColor === 'black' ? t('common.you') : bot.name,
					WhiteElo: myColor === 'white' ? '?' : String(bot.elo),
					BlackElo: myColor === 'black' ? '?' : String(bot.elo)
				}),
				moves: game.moves.map((m) => m.uci),
				startFen: game.startFen,
				result,
				myColor,
				opponent: bot.name,
				source: 'bot'
			})) as number;
			await bumpActivity('games');
			if (verdictFor(e, myColor) === 'win') {
				const beaten = await getSetting<string[]>('botsBeaten', []);
				if (!beaten.includes(bot.id)) await setSetting('botsBeaten', [...beaten, bot.id]);
			}
		}
		setTimeout(() => (showResult = true), 500);
	}

	function newSetup() {
		botAbort?.abort();
		stopClock();
		thinking = false;
		setSetting('currentGame', null);
		phase = 'setup';
		ended = null;
		showResult = false;
	}

	function rematch() {
		colorChoice = myColor === 'white' ? 'black' : 'white';
		botId = bot.id;
		tcChoice = tc?.id ?? null;
		start();
	}

	const verdictText = $derived(
		t(verdict === 'win' ? 'play.won' : verdict === 'loss' ? 'play.lost' : 'play.draw')
	);

	const pieceGlyph: Record<string, string> = {
		pawn: '♟',
		knight: '♞',
		bishop: '♝',
		rook: '♜',
		queen: '♛'
	};
	const order = ['queen', 'rook', 'bishop', 'knight', 'pawn'];
	function sortRoles(r: string[]) {
		return [...r].sort((a, b) => order.indexOf(a) - order.indexOf(b));
	}

	let beatenBots = $state<string[]>([]);
	$effect(() => {
		if (phase === 'setup') getSetting<string[]>('botsBeaten', []).then((b) => (beatenBots = b));
	});

	function onKey(e: KeyboardEvent) {
		if (phase !== 'playing' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
		if (e.key === 'h') hint();
		if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			undo();
		}
		if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
	}
</script>

<svelte:head><title>{t('play.title')} – Rookie</title></svelte:head>
<svelte:window onkeydown={onKey} />

{#if phase === 'setup'}
	<PageHeader eyebrow={t('play.eyebrow')} title={t('play.title')} subtitle={t('play.subtitle')} />

	<div class="setup">
		<section>
			<h2 class="sec">{t('play.opponent')}</h2>
			<div class="bots">
				{#each BOTS as b, i (b.id)}
					<button
						class="bot card pressable"
						class:sel={botId === b.id}
						style:--h={b.hue}
						style:--i={i}
						onclick={() => (botId = b.id)}
						aria-pressed={botId === b.id}
					>
						<BotAvatar bot={b} size={52} />
						<span class="bot-text">
							<span class="bot-name">
								{b.name}
								{#if beatenBots.includes(b.id)}<Trophy size={14} class="won" />{/if}
							</span>
							<span class="bot-elo">≈ {b.elo}</span>
							<span class="bot-tag">{b.tagline}</span>
						</span>
					</button>
				{/each}
			</div>
		</section>

		<aside class="options card">
			<div class="chosen">
				<BotAvatar bot={botById(botId)} size={64} />
				<div>
					<span class="eyebrow">{t('play.yourOpponent')}</span>
					<h3>{botById(botId).name}</h3>
				</div>
			</div>

			<div class="opt">
				<span class="opt-label">{t('play.yourColor')}</span>
				<div class="seg" role="radiogroup" aria-label={t('play.yourColor')}>
					{#each [['white', 'common.white'], ['random', 'play.random'], ['black', 'common.black']] as [val, lab] (val)}
						<button
							role="radio"
							aria-checked={colorChoice === val}
							class:on={colorChoice === val}
							onclick={() => (colorChoice = val as typeof colorChoice)}
						>
							<span class="swatch {val}"></span>{t(lab)}
						</button>
					{/each}
				</div>
			</div>

			<div class="opt">
				<span class="opt-label"><Timer size={15} /> {t('play.timeControl')}</span>
				<div class="seg" role="radiogroup" aria-label={t('play.timeControl')}>
					<button
						role="radio"
						aria-checked={tcChoice === null}
						class:on={tcChoice === null}
						onclick={() => (tcChoice = null)}
					>
						{t('play.noClock')}
					</button>
					{#each TIME_CONTROLS as tc (tc.id)}
						<button
							role="radio"
							aria-checked={tcChoice === tc.id}
							class:on={tcChoice === tc.id}
							onclick={() => (tcChoice = tc.id)}
						>
							{tc.label}
						</button>
					{/each}
				</div>
			</div>

			<button class="btn big" onclick={start}>{t('play.start')}</button>
		</aside>
	</div>
{:else if phase === 'playing'}
	<div class="arena">
		<div class="board-col">
			<div class="player top">
				<BotAvatar {bot} size={40} {thinking} />
				<div class="pinfo">
					<span class="pname">{bot.name} <span class="pelo">{bot.elo}</span></span>
					<span class="pcap">
						{#each sortRoles(captured[myColor]) as r, i (i)}<span class="cap">{pieceGlyph[r]}</span
							>{/each}
						{#if (myColor === 'white' ? -material : material) > 0}<span class="adv"
								>+{Math.abs(material)}</span
							>{/if}
						{#if thinking}<span class="status">{t('play.thinking')}</span>{/if}
					</span>
				</div>
				{#if clocks}
					<span
						class="clock"
						class:run={!ended && turn !== myColor}
						class:low={clocks[myColor === 'white' ? 'black' : 'white'] < 30000}
					>
						{formatClock(clocks[myColor === 'white' ? 'black' : 'white'])}
					</span>
				{/if}
			</div>

			<Board
				{fen}
				{orientation}
				turnColor={turn}
				{lastMove}
				{check}
				{dests}
				movableColor={myColor}
				shapes={hintShapes}
				isPromotion={(f, t) => game.isPromotion(f as never, t as never)}
				{onMove}
			/>

			<div class="player bottom">
				<span class="me-avatar" aria-hidden="true">{t('common.you')}</span>
				<div class="pinfo">
					<span class="pname">{t('common.you')} <span class="pelo">{colorName(myColor)}</span></span
					>
					<span class="pcap">
						{#each sortRoles(captured[myColor === 'white' ? 'black' : 'white']) as r, i (i)}<span
								class="cap">{pieceGlyph[r]}</span
							>{/each}
						{#if (myColor === 'white' ? material : -material) > 0}<span class="adv"
								>+{Math.abs(material)}</span
							>{/if}
						{#if myTurn}<span class="status yours">{t('play.yourTurn')}</span>{/if}
					</span>
				</div>
				{#if clocks}
					<span
						class="clock"
						class:run={!ended && turn === myColor}
						class:low={clocks[myColor] < 30000}
					>
						{formatClock(clocks[myColor])}
					</span>
				{/if}
			</div>
		</div>

		<aside class="side card">
			<div class="side-moves">
				<MoveList {moves} />
			</div>
			<div class="controls">
				<button
					class="ctl"
					onclick={hint}
					disabled={!myTurn || hintLoading}
					title="{t('play.hint')} (H)"
				>
					<Lightbulb size={20} /><span>{t('play.hint')}</span>
				</button>
				<button
					class="ctl"
					onclick={undo}
					disabled={!!ended || game.ply === 0}
					title="{t('play.undo')} (⌘Z)"
				>
					<Undo2 size={20} /><span>{t('play.undo')}</span>
				</button>
				<button
					class="ctl"
					onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')}
					title="{t('common.flip')} (F)"
				>
					<RefreshCw size={20} /><span>{t('common.flip')}</span>
				</button>
				{#if !ended}
					<button class="ctl danger" onclick={resign} title={t('play.resign')}>
						<Flag size={20} /><span>{t('play.resign')}</span>
					</button>
				{:else}
					<button class="ctl" onclick={() => (showResult = true)}>
						<Trophy size={20} /><span>{t('play.result')}</span>
					</button>
				{/if}
			</div>
			{#if hints || undos}
				<p class="helpers">{t('play.helpers', { h: hints, u: undos })}</p>
			{/if}
			<button class="link-btn" onclick={newSetup}
				><ArrowLeft size={16} /> {t('play.otherOpponent')}</button
			>
		</aside>
	</div>

	{#if ended && showResult}
		<div class="sheet-backdrop" role="presentation" onclick={() => (showResult = false)}></div>
		<div class="sheet card {verdict}" role="dialog" aria-label={t('play.result')}>
			<div class="burst" aria-hidden="true">
				{#if verdict === 'win'}
					{#each Array.from({ length: 14 }, (_x, k) => k) as k (k)}<span style:--k={k}
						></span>{/each}
				{/if}
			</div>
			<BotAvatar {bot} size={64} />
			<h2>{verdictText}</h2>
			<p class="reason">{endReason(ended)}</p>
			{#if verdict === 'win' && hints === 0 && undos === 0}
				<p class="badge">{t('play.noHelp')}</p>
			{/if}
			<div class="sheet-actions">
				<button class="btn" onclick={rematch}>{t('play.rematch')}</button>
				{#if savedGameId}
					<a class="btn secondary" href={resolve(`/analysis?game=${savedGameId}`)}>
						<ChartLine size={18} />
						{t('play.analyse')}
					</a>
				{/if}
				<button class="btn secondary" onclick={newSetup}>{t('play.newOpponent')}</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* ── Einrichtung ── */
	.setup {
		display: grid;
		gap: 1.25rem;
		max-width: 1100px;
	}

	@media (min-width: 1000px) {
		.setup {
			grid-template-columns: 1fr 320px;
			align-items: start;
		}
		.options {
			position: sticky;
			top: 2rem;
		}
	}

	.sec {
		font-size: 1.1rem;
		margin-bottom: 0.75rem;
	}

	.bots {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 0.65rem;
	}

	.bot {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
		padding: 0.9rem;
		text-align: left;
		border: 1.5px solid var(--line);
		animation: rise 460ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 40ms);
	}

	.bot.sel {
		border-color: hsl(var(--h) 70% 55%);
		background: color-mix(in srgb, hsl(var(--h) 70% 55%) 7%, var(--surface));
	}

	.bot-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.bot-name {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-display);
		font-weight: 680;
		font-size: 1.05rem;
		letter-spacing: -0.01em;
	}

	.bot-name :global(.won) {
		color: var(--warn);
	}

	.bot-elo {
		font-size: 0.8rem;
		font-weight: 650;
		color: hsl(var(--h) 60% 45%);
	}

	.bot-tag {
		font-size: 0.85rem;
		color: var(--text-2);
		line-height: 1.35;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1.25rem;
	}

	.chosen {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.chosen h3 {
		font-size: 1.35rem;
	}

	.opt {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.opt-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--text-2);
	}

	.seg {
		display: flex;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}

	.seg button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 38px;
		border: none;
		border-radius: 9px;
		background: none;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text-2);
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out);
	}

	.seg button.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-1);
	}

	.swatch {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid var(--line-strong);
	}
	.swatch.white {
		background: #fff;
	}
	.swatch.black {
		background: #222;
	}
	.swatch.random {
		background: linear-gradient(135deg, #fff 50%, #222 50%);
	}

	.btn.big {
		min-height: 52px;
		font-size: 1.05rem;
		margin-top: 0.25rem;
	}

	/* ── Partie ── */
	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
		margin: 0 auto;
	}

	.board-col {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		max-width: min(640px, calc(100dvh - 210px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 300px;
			align-items: start;
		}
		.board-col {
			max-width: min(680px, calc(100dvh - 150px));
		}
		.side {
			position: sticky;
			top: 2rem;
			height: min(560px, calc(100dvh - 120px));
		}
	}

	.player {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 44px;
	}

	.me-avatar {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 32%;
		background: var(--surface-2);
		border: 1px solid var(--line);
		font-weight: 700;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.pinfo {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.pname {
		font-weight: 650;
		font-size: 0.98rem;
	}

	.pelo {
		font-weight: 500;
		color: var(--text-3);
		font-size: 0.85rem;
		margin-left: 0.2rem;
	}

	.pcap {
		display: flex;
		align-items: center;
		gap: 1px;
		min-height: 18px;
		font-size: 0.95rem;
		color: var(--text-2);
		line-height: 1;
	}

	.cap {
		opacity: 0.75;
	}

	.adv {
		margin-left: 0.3rem;
		font-size: 0.78rem;
		font-weight: 650;
		color: var(--text-3);
	}

	.status {
		margin-left: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-3);
		animation: breathe 1.4s ease-in-out infinite;
	}

	.status.yours {
		color: var(--accent);
		font-weight: 600;
		animation: none;
	}

	@keyframes breathe {
		50% {
			opacity: 0.4;
		}
	}

	.clock {
		font-family: var(--font-mono);
		font-size: 1.15rem;
		font-weight: 650;
		padding: 0.3rem 0.7rem;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
		transition: background-color var(--dur) var(--ease-out);
	}

	.clock.run {
		background: var(--text);
		color: var(--bg);
	}

	.clock.run.low {
		background: var(--bad);
		color: #fff;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.9rem;
		min-height: 0;
	}

	.side-moves {
		flex: 1;
		min-height: 0;
		max-height: 220px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	@media (min-width: 1000px) {
		.side-moves {
			max-height: none;
		}
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.4rem;
	}

	.ctl {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.55rem 0.2rem;
		border: none;
		border-radius: 12px;
		background: var(--surface-2);
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--text-2);
		cursor: pointer;
		transition:
			transform var(--dur-fast) var(--ease-out),
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out);
	}

	.ctl:hover:not(:disabled) {
		background: var(--accent-soft);
		color: var(--accent-strong);
	}

	.ctl.danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--bad) 14%, transparent);
		color: var(--bad);
	}

	.ctl:active:not(:disabled) {
		transform: scale(0.94);
	}

	.ctl:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.helpers {
		font-size: 0.8rem;
		color: var(--text-3);
		text-align: center;
	}

	.link-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border: none;
		background: none;
		color: var(--text-2);
		font-size: 0.88rem;
		font-weight: 560;
		cursor: pointer;
		padding: 0.25rem;
	}

	.link-btn:hover {
		color: var(--accent);
	}

	/* ── Ergebnis ── */
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgb(18 16 14 / 0.45);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		animation: fade 200ms ease-out;
	}

	.sheet {
		position: fixed;
		z-index: 81;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(92vw, 380px);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 1.5rem 1.5rem;
		text-align: center;
		overflow: hidden;
		animation: pop 380ms var(--ease-spring);
	}

	.sheet h2 {
		font-size: 2rem;
		margin-top: 0.4rem;
	}

	.sheet.win h2 {
		color: var(--good);
	}

	.reason {
		color: var(--text-2);
	}

	.badge {
		font-size: 0.85rem;
		font-weight: 650;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--good) 14%, transparent);
		color: var(--good);
	}

	.sheet-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.burst {
		position: absolute;
		left: 50%;
		top: 70px;
		pointer-events: none;
	}

	.burst span {
		position: absolute;
		width: 8px;
		height: 14px;
		border-radius: 3px;
		background: hsl(calc(var(--k) * 26) 80% 60%);
		animation: confetti 1100ms var(--ease-out) forwards;
		transform: rotate(calc(var(--k) * 25.7deg)) translateY(0);
	}

	@keyframes confetti {
		to {
			transform: rotate(calc(var(--k) * 25.7deg)) translateY(-130px) rotate(180deg);
			opacity: 0;
		}
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translate(-50%, -44%) scale(0.94);
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
</style>
