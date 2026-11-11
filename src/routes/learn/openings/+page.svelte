<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Play from '@lucide/svelte/icons/play';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Flame from '@lucide/svelte/icons/flame';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { Game } from '#lib/chess/game.js';
	import { figurine } from '#lib/chess/notation.js';
	import { db, type RepertoireNodeRow, bumpActivity } from '#lib/db/db.js';
	import {
		addLine,
		movesAt,
		removeNode,
		repertoireStats,
		afterFen,
		type Side
	} from '#lib/openings/repertoire.js';
	import { review, dueCards } from '#lib/training/srs.js';
	import { openingFor, continuations, onOpeningsLoaded } from '#lib/data/openings.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { COURSES, loc, noteFor, type Course } from '#lib/openings/courses.js';
	import { getCourseProgress, type CourseProgress } from '#lib/openings/progress.js';

	type View = 'overview' | 'edit' | 'train';
	let view = $state<View>('overview');
	let color = $state<Side>('white');

	let stats = $state<Record<Side, { mine: number; due: number }>>({
		white: { mine: 0, due: 0 },
		black: { mine: 0, due: 0 }
	});
	let openingsReady = $state(0);

	onMount(() => {
		void (async () => {
			await refresh();
			// aus dem Tagesplan: direkt mit der Seite starten, die fällige Züge hat
			if (new URLSearchParams(location.search).get('train') === 'due') {
				const side = stats.white.due ? 'white' : stats.black.due ? 'black' : null;
				if (side) await startTraining(side);
			}
		})();
		return onOpeningsLoaded(() => openingsReady++);
	});

	async function refresh() {
		stats = { white: await repertoireStats('white'), black: await repertoireStats('black') };
		courseProgress = await getCourseProgress();
	}

	// ── Editor ──
	let game = $state.raw(new Game());
	let v = $state(0);
	let here = $state<RepertoireNodeRow[]>([]);
	let book = $state<{ uci: string; name: string; san: string }[]>([]);

	const fen = $derived.by(() => {
		void v;
		return game.fen;
	});
	const lastMove = $derived.by(() => {
		void v;
		return game.lastMove;
	});
	const editTurn = $derived.by(() => {
		void v;
		return game.turn;
	});
	const editDests = $derived.by(() => {
		void v;
		return game.dests();
	});
	const pathMoves = $derived.by(() => {
		void v;
		return [...game.moves];
	});
	const ucis = $derived.by(() => {
		void v;
		return game.moves.map((m) => m.uci);
	});
	const opening = $derived.by(() => {
		void openingsReady;
		return openingFor(ucis);
	});

	async function loadHere() {
		here = await movesAt(color, game.fen);
		void openingsReady;
		book = continuations(ucis)
			.slice(0, 6)
			.map((c) => ({ ...c, san: sanOf(c.uci) }));
	}

	function sanOf(uci: string): string {
		const g = Game.fromUciMoves(ucis, game.startFen);
		return g.play(uci)?.san ?? uci;
	}

	function openEditor(c: Side) {
		color = c;
		game = new Game();
		v++;
		view = 'edit';
		loadHere();
	}

	async function onEditMove(uci: string) {
		const mv = game.play(uci);
		if (!mv) return void v++;
		sound.move(!!mv.captured, game.isCheck);
		v++;
		await addLine(color, ucis);
		await loadHere();
	}

	function follow(uci: string) {
		onEditMove(uci);
	}

	function back(n = 1) {
		game.undo(n);
		v++;
		loadHere();
	}

	async function removeHere(node: RepertoireNodeRow) {
		if (!confirm(t('openings.removeConfirm'))) return;
		await removeNode(node);
		await loadHere();
	}

	// ── Training ──
	let trainNode = $state<RepertoireNodeRow | null>(null);
	let trainGame = $state.raw(new Game());
	let tv = $state(0);
	let trainStatus = $state<'idle' | 'waiting' | 'correct' | 'wrong' | 'done' | 'empty'>('idle');
	let trainShapes = $state<Shape[]>([]);
	let wrongSan = $state('');
	let wrongWhy = $state('');
	let streak = $state(0);

	const tFen = $derived.by(() => {
		void tv;
		return trainGame.fen;
	});
	const tLast = $derived.by(() => {
		void tv;
		return trainGame.lastMove;
	});
	const tTurn = $derived.by(() => {
		void tv;
		return trainGame.turn;
	});
	const tDests = $derived.by(() => {
		void tv;
		return trainStatus === 'waiting' ? trainGame.dests() : new Map<string, string[]>();
	});

	async function startTraining(c: Side) {
		color = c;
		view = 'train';
		streak = 0;
		await nextCard();
	}

	async function nextCard() {
		trainShapes = [];
		const due = (await dueCards('repertoire')).filter((r) => r.id.startsWith(`rep:${color}:`));
		if (!due.length) {
			trainStatus = 'empty';
			return;
		}
		const nodeId = (due[0].data as { nodeId: string }).nodeId;
		const node = await db.repertoire.get(nodeId);
		if (!node) {
			await db.reviewCards.delete(due[0].id);
			return nextCard();
		}
		await presentNode(node);
	}

	async function presentNode(node: RepertoireNodeRow) {
		trainNode = node;
		trainGame = new Game(node.fen + ' 0 1');
		// Gegnerzug, der zu dieser Stellung führte, als „letzten Zug“ zeigen
		const parent = await db.repertoire
			.filter((r) => r.color === color && !r.mine && afterFen(r) === node.fen)
			.first();
		if (parent) {
			trainGame = new Game(parent.fen + ' 0 1');
			trainGame.play(parent.uci);
		}
		tv++;
		trainStatus = 'waiting';
	}

	async function onTrainMove(uci: string) {
		if (!trainNode || trainStatus !== 'waiting') return;
		const options = (await movesAt(color, trainGame.fen)).filter((n) => n.mine);
		const hit = options.find((o) => o.uci === uci || o.uci === uci + 'q');
		if (!hit) {
			trainStatus = 'wrong';
			wrongSan = trainNode.san;
			wrongWhy = noteFor(trainGame.fen, trainNode.uci);
			trainShapes = [
				{ orig: trainNode.uci.slice(0, 2), dest: trainNode.uci.slice(2, 4), brush: 'good' }
			];
			sound.bad();
			streak = 0;
			tv++;
			await review(`rep:${trainNode.id}`, 'repertoire', 'again', { nodeId: trainNode.id });
			return;
		}
		const mv = trainGame.play(hit.uci);
		sound.move(!!mv?.captured, trainGame.isCheck);
		tv++;
		trainStatus = 'correct';
		streak++;
		await review(`rep:${hit.id}`, 'repertoire', 'good', { nodeId: hit.id });
		await bumpActivity('reviews');
		// Variante weiterspielen: Gegnerantwort + nächster eigener Zug
		const replies = await movesAt(color, trainGame.fen);
		if (!replies.length) {
			setTimeout(() => (trainStatus = 'done'), 450);
			return;
		}
		setTimeout(async () => {
			const r = replies[Math.floor(Math.random() * replies.length)];
			const om = trainGame.play(r.uci);
			sound.move(!!om?.captured, trainGame.isCheck);
			tv++;
			const mine = (await movesAt(color, trainGame.fen)).filter((n) => n.mine);
			if (!mine.length) {
				trainStatus = 'done';
				return;
			}
			trainNode = mine[0];
			trainStatus = 'waiting';
		}, 500);
	}

	function retryWrong() {
		if (!trainNode) return;
		trainShapes = [];
		trainStatus = 'waiting';
		tv++;
	}

	function backToOverview() {
		view = 'overview';
		refresh();
	}

	const sides: Side[] = ['white', 'black'];

	const COURSE_GROUPS = [
		{ key: 'w', label: 'course.forWhite', match: (c: Course) => c.color === 'white' },
		{
			key: 'e4',
			label: 'course.vsE4',
			match: (c: Course) => c.color === 'black' && c.group === 'e4'
		},
		{
			key: 'd4',
			label: 'course.vsD4',
			match: (c: Course) => c.color === 'black' && c.group === 'd4'
		}
	];
	let courseProgress = $state<CourseProgress>({});
</script>

<svelte:head><title>{t('openings.title')} – Rookie</title></svelte:head>

{#if view === 'overview'}
	<a class="back" href={resolve('/learn')}><ArrowLeft size={18} /> {t('endgame.back')}</a>
	<PageHeader title={t('openings.title')} subtitle={t('openings.subtitle')} />

	<div class="sides">
		{#each sides as c (c)}
			<section class="side card {c}">
				<div class="side-head">
					<span class="swatch {c}"></span>
					<h2>{c === 'white' ? t('openings.asWhite') : t('openings.asBlack')}</h2>
				</div>
				<p class="meta">
					{t('openings.moves', { n: stats[c].mine })}
					{#if stats[c].due}· <b class="due">{t('openings.due', { n: stats[c].due })}</b>{/if}
				</p>
				<div class="row-btns">
					<button class="btn" onclick={() => startTraining(c)} disabled={!stats[c].mine}>
						<Play size={17} />
						{t('openings.train')}
					</button>
					<button class="btn secondary" onclick={() => openEditor(c)}>
						<PenLine size={17} />
						{t('openings.edit')}
					</button>
				</div>
			</section>
		{/each}
	</div>

	<h2 class="sec">{t('course.courses')}</h2>
	<p class="sec-text">{t('course.coursesText')}</p>
	{#each COURSE_GROUPS as grp (grp.key)}
		<h3 class="grp">{t(grp.label)}</h3>
		<div class="courses">
			{#each COURSES.filter(grp.match) as c, i (c.id)}
				{@const learned = c.lines.filter((l) => courseProgress[c.id]?.[l.id]).length}
				<a
					class="course card pressable"
					style:--i={i}
					href={resolve(`/learn/openings/course?id=${c.id}`)}
				>
					<span class="c-top">
						<span class="swatch {c.color}"></span>
						<span class="lvl l{c.level}">{t(`course.level${c.level}`)}</span>
					</span>
					<b>{loc(c.name)}</b>
					<span class="c-tag">{loc(c.tagline)}</span>
					<span class="c-bar"><span style:width="{(learned / c.lines.length) * 100}%"></span></span>
					<span class="c-prog">{t('course.progress', { n: learned, m: c.lines.length })}</span>
				</a>
			{/each}
		</div>
	{/each}
{:else if view === 'edit'}
	<button class="back" onclick={backToOverview}
		><ArrowLeft size={18} /> {t('openings.title')}</button
	>
	<div class="arena">
		<div class="board-col">
			<Board
				{fen}
				orientation={color}
				turnColor={editTurn}
				{lastMove}
				dests={editDests}
				movableColor="both"
				isPromotion={(f, to) => game.isPromotion(f as never, to as never)}
				onMove={onEditMove}
			/>
			<div class="nav">
				<button onclick={() => back(game.ply)} aria-label={t('openings.toStart')}
					><ChevronsLeft size={20} /></button
				>
				<button onclick={() => back(1)} disabled={game.ply === 0} aria-label={t('common.back')}
					><ChevronLeft size={20} /></button
				>
			</div>
		</div>
		<aside class="panel card">
			<h1>
				{t('openings.editorTitle', {
					side: color === 'white' ? t('common.white') : t('common.black')
				})}
			</h1>
			<p class="hint">{t('openings.editorHint')}</p>
			{#if opening}<p class="opening"><BookOpen size={15} /> {opening.name}</p>{/if}
			<p class="path">
				{#each pathMoves as m, i (i)}{#if i % 2 === 0}<span class="no">{i / 2 + 1}.</span
						>{/if}{figurine(m.san)}
				{/each}
			</p>
			<div class="moves-here">
				{#if here.length === 0}
					<p class="muted">{t('openings.noMoves')}</p>
				{/if}
				{#each here as n (n.id)}
					<div class="node" class:mine={n.mine}>
						<button class="follow" onclick={() => follow(n.uci)}>
							<b>{figurine(n.san)}</b>
							<span>{n.mine ? t('openings.yourMove') : t('openings.theirMove')}</span>
						</button>
						<button class="del" onclick={() => removeHere(n)} aria-label={t('openings.remove')}
							><Trash2 size={15} /></button
						>
					</div>
				{/each}
			</div>
			{#if book.length}
				<div class="book">
					<h3>{t('openings.explorer')}</h3>
					{#each book as b (b.uci)}
						<button class="book-move" onclick={() => follow(b.uci)}>
							<b>{figurine(b.san)}</b>
							<span>{b.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</aside>
	</div>
{:else}
	<button class="back" onclick={backToOverview}
		><ArrowLeft size={18} /> {t('openings.title')}</button
	>
	<div class="arena">
		<div class="board-col">
			<Board
				fen={tFen}
				orientation={color}
				turnColor={tTurn}
				lastMove={tLast}
				dests={tDests}
				movableColor={color}
				shapes={trainShapes}
				flash={trainStatus === 'correct' ? 'good' : trainStatus === 'wrong' ? 'bad' : ''}
				isPromotion={(f, to) => trainGame.isPromotion(f as never, to as never)}
				onMove={onTrainMove}
			/>
		</div>
		<aside class="panel card">
			<h1>{t('openings.trainTitle')}</h1>
			{#if trainStatus === 'empty'}
				<div class="empty">
					<Check size={28} />
					<h2>{stats[color].mine ? t('openings.nothingDue') : t('openings.empty')}</h2>
					<p class="muted">
						{stats[color].mine ? t('openings.nothingDueText') : t('openings.emptyText')}
					</p>
					<button class="btn secondary" onclick={() => openEditor(color)}
						><PenLine size={17} /> {t('openings.edit')}</button
					>
				</div>
			{:else}
				<div
					class="pill"
					class:ok={trainStatus === 'correct' || trainStatus === 'done'}
					class:bad={trainStatus === 'wrong'}
				>
					{#if trainStatus === 'wrong'}
						{t('openings.wrong', { san: figurine(wrongSan) })}
					{:else if trainStatus === 'done'}
						{t('openings.lineDone')}
					{:else if trainStatus === 'correct'}
						{t('openings.correct')}
					{:else}
						{t('openings.trainPrompt')}
					{/if}
				</div>
				{#if trainStatus === 'wrong' && wrongWhy}<p class="why">{wrongWhy}</p>{/if}
				<p class="streak"><Flame size={18} /> {streak}</p>
				<div class="row-btns">
					{#if trainStatus === 'wrong'}
						<button class="btn" onclick={retryWrong}>{t('common.retry')}</button>
						<button class="btn secondary" onclick={nextCard}>{t('common.next')}</button>
					{:else if trainStatus === 'done'}
						<button class="btn" onclick={nextCard}>{t('common.next')}</button>
					{/if}
				</div>
			{/if}
		</aside>
	</div>
{/if}

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
		color: var(--text-2);
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		margin-bottom: 0.5rem;
	}

	.grp {
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-2);
		margin: 1.1rem 0 0.55rem;
	}

	.courses {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.6rem;
		max-width: 1040px;
	}

	.course {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1rem;
		color: var(--text);
		animation: rise 420ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 45ms);
	}

	.c-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
	}

	.lvl {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
	}

	.lvl.l1 {
		color: var(--c-learn);
		background: var(--c-learn-soft);
	}

	.lvl.l3 {
		color: var(--c-play);
		background: var(--c-play-soft);
	}

	.course b {
		font-size: 1.05rem;
	}

	.c-tag {
		font-size: 0.85rem;
		color: var(--text-2);
		line-height: 1.35;
		flex: 1;
	}

	.c-bar {
		height: 5px;
		margin-top: 0.4rem;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.c-bar span {
		display: block;
		height: 100%;
		background: var(--c-learn);
		border-radius: inherit;
	}

	.c-prog {
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.why {
		font-size: 0.92rem;
		line-height: 1.45;
		color: var(--text-2);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	.sides {
		display: grid;
		gap: 0.75rem;
		max-width: 1040px;
	}

	@media (min-width: 700px) {
		.sides {
			grid-template-columns: 1fr 1fr;
		}
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.2rem;
	}

	.side-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.side h2 {
		font-size: 1.3rem;
	}

	.swatch {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 7px;
		border: 1px solid var(--line-strong);
	}

	.swatch.white {
		background: #fff;
	}

	.swatch.black {
		background: #222;
	}

	.meta {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.due {
		color: var(--accent);
	}

	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn:disabled {
		opacity: 0.45;
	}

	.btn.small {
		min-height: 36px;
		padding: 0 0.85rem;
		font-size: 0.88rem;
	}

	.sec {
		font-size: 1.25rem;
		margin-top: 1.5rem;
	}

	.sec-text {
		color: var(--text-2);
		margin: 0.2rem 0 0.75rem;
	}

	.starters {
		display: grid;
		gap: 0.5rem;
		max-width: 1040px;
	}

	.starter {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
	}

	.st-text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.st-text span {
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.added {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--good);
	}

	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	.board-col {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		max-width: min(620px, calc(100dvh - 220px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
		.panel {
			position: sticky;
			top: 2rem;
		}
	}

	.nav {
		display: flex;
		gap: 0.4rem;
	}

	.nav button {
		display: grid;
		place-items: center;
		width: 52px;
		height: 42px;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		box-shadow: var(--shadow-1);
		color: var(--text);
		cursor: pointer;
	}

	.nav button:disabled {
		opacity: 0.4;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.15rem;
	}

	.panel h1 {
		font-size: 1.35rem;
	}

	.hint,
	.muted {
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.opening {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		align-self: flex-start;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--c-learn);
		background: var(--c-learn-soft);
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
	}

	.path {
		font-weight: 600;
		line-height: 1.6;
		min-height: 1.6em;
	}

	.path .no {
		color: var(--text-3);
		margin: 0 0.15rem 0 0.3rem;
	}

	.moves-here {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.node {
		display: flex;
		align-items: center;
		border-radius: 12px;
		background: var(--surface-2);
	}

	.node.mine {
		background: var(--c-learn-soft);
	}

	.follow {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
	}

	.follow b {
		font-size: 1.05rem;
	}

	.follow span {
		font-size: 0.8rem;
		color: var(--text-3);
		font-weight: 600;
	}

	.node.mine .follow span {
		color: var(--c-learn);
	}

	.del {
		border: none;
		background: none;
		color: var(--text-3);
		padding: 0.5rem 0.7rem;
		cursor: pointer;
	}

	.del:hover {
		color: var(--bad);
	}

	.book {
		padding-top: 0.6rem;
		border-top: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.book h3 {
		font-size: 0.85rem;
		color: var(--text-3);
		margin-bottom: 0.25rem;
	}

	.book-move {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		padding: 0.4rem 0.5rem;
		border: none;
		border-radius: 9px;
		background: none;
		cursor: pointer;
		text-align: left;
	}

	.book-move:hover {
		background: var(--surface-2);
	}

	.book-move span {
		font-size: 0.82rem;
		color: var(--text-2);
	}

	.pill {
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: var(--surface-2);
		font-weight: 650;
	}

	.pill.ok {
		background: color-mix(in srgb, var(--good) 14%, transparent);
		color: var(--good);
	}

	.pill.bad {
		background: color-mix(in srgb, var(--bad) 12%, transparent);
		color: var(--bad);
	}

	.streak {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--accent);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		color: var(--text-2);
		padding: 0.5rem 0;
	}

	.empty h2 {
		color: var(--text);
		font-size: 1.15rem;
	}
</style>
