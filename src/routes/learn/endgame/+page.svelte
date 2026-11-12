<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import LessonIcon from '#lib/ui/LessonIcon.svelte';
	import Stars from '#lib/ui/Stars.svelte';
	import { Game } from '#lib/chess/game.js';
	import { colorName } from '#lib/chess/labels.js';
	import {
		LESSONS,
		lessonById,
		lessonTitle,
		lessonSubtitle,
		lessonSteps,
		goalText,
		type Lesson
	} from '#lib/endgames/lessons.js';
	import { probe, rateMove, type TbResult } from '#lib/endgames/tablebase.js';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ArrowLeftIcon from '@lucide/svelte/icons/chevron-left';
	import {
		afterPlayerMove,
		afterOpponentMove,
		stars as starsFor,
		type Verdict
	} from '#lib/endgames/judge.js';
	import { db, bumpActivity } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let lesson = $state<Lesson | null>(null);
	let posIdx = $state(0);
	let game = $state.raw(new Game());
	let v = $state(0);
	let status = $state<'loading' | 'playing' | 'thinking' | 'done'>('loading');
	let verdict = $state<Verdict | null>(null);
	let playerMoves = $state(0);
	let hints = $state(0);
	let shapes = $state<Shape[]>([]);
	let startDtm = $state<number | null>(null);
	let offline = $state(false);
	let earned = $state(0);
	let best = $state(0);
	// Theorie vor der Aufgabe
	let theoryIdx = $state<number | null>(null);
	// Coach: Rückmeldung zum letzten eigenen Zug
	let coach = $state<{ kind: 'best' | 'good' | 'slow' | 'holds' | 'warn'; text: string } | null>(
		null
	);
	let tbBefore: TbResult | null = null;
	let hintStage = $state(0);

	const fen = $derived.by(() => {
		void v;
		return game.fen;
	});
	const lastMove = $derived.by(() => {
		void v;
		return game.lastMove;
	});
	const check = $derived.by(() => {
		void v;
		return game.isCheck;
	});
	const turn = $derived.by(() => {
		void v;
		return game.turn;
	});
	const dests = $derived.by(() => {
		void v;
		return status === 'playing' && lesson && game.turn === lesson.player
			? game.dests()
			: new Map<string, string[]>();
	});

	onMount(async () => {
		const id = page.url.searchParams.get('id') ?? LESSONS[0].id;
		lesson = lessonById(id) ?? LESSONS[0];
		best = (await db.endgames.get(lesson.id))?.stars ?? 0;
		// Neue Lektion: erst die Technik zeigen
		if (!best) theoryIdx = 0;
		start(0);
	});

	async function start(i: number) {
		if (!lesson) return;
		posIdx = i % lesson.positions.length;
		game = new Game(lesson.positions[posIdx]);
		v++;
		playerMoves = 0;
		hints = 0;
		shapes = [];
		verdict = null;
		earned = 0;
		coach = null;
		hintStage = 0;
		status = 'playing';
		const tb = await probe(game.fen);
		offline = tb.source !== 'tablebase';
		startDtm = tb.dtm;
		tbBefore = tb;
	}

	async function onMove(uci: string) {
		if (!lesson || status !== 'playing') return;
		const mv = game.play(uci);
		if (!mv) {
			v++;
			return;
		}
		playerMoves++;
		shapes = [];
		hintStage = 0;
		sound.move(!!mv.captured, game.isCheck);
		v++;
		status = 'thinking';
		const tb: TbResult | null = game.end() ? null : await probe(game.fen);
		if (tb) offline = tb.source !== 'tablebase';
		const res = afterPlayerMove(lesson, game, playerMoves, tb);
		if (res.status !== 'continue') return finish(res);
		coach = coachFor(uci);

		// Gegner antwortet mit dem besten Zug
		await new Promise((r) => setTimeout(r, 380));
		const reply = tb?.best;
		if (!reply) {
			status = 'playing';
			return;
		}
		const om = game.play(reply);
		if (om) sound.move(!!om.captured, game.isCheck);
		v++;
		const after = afterOpponentMove(lesson, game);
		if (after.status !== 'continue') return finish(after);
		status = 'playing';
		tbBefore = await probe(game.fen);
	}

	/** Rückmeldung zum eigenen Zug: Tablebase-Vergleich plus Patt-Warnung */
	function coachFor(uci: string): typeof coach {
		if (!lesson || !tbBefore) return null;
		const win = lesson.goal !== 'draw';
		// Patt-Gefahr: gegnerischer König hat nur noch ein Feld und steht nicht im Schach
		if (win && !game.isCheck && game.legalUcis().length === 1)
			return { kind: 'warn', text: t('endgame.coach.stalemate') };
		const r = rateMove(tbBefore, uci, win);
		if (!r) return null;
		const mate = lesson.goal === 'mate' && r.mine !== undefined;
		switch (r.kind) {
			case 'best':
				return {
					kind: 'best',
					text: mate ? t('endgame.coach.bestMate', { n: r.mine! }) : t('endgame.coach.best')
				};
			case 'good':
				return {
					kind: 'good',
					text: mate ? t('endgame.coach.goodMate', { n: r.mine! }) : t('endgame.coach.good')
				};
			case 'slow':
				return {
					kind: 'slow',
					text: mate
						? t('endgame.coach.slowMate', { san: r.better ?? '', n: r.best!, m: r.mine! })
						: t('endgame.coach.slow', { san: r.better ?? '' })
				};
			default:
				return { kind: 'holds', text: t('endgame.coach.holds') };
		}
	}

	async function finish(res: Verdict) {
		if (!lesson) return;
		verdict = res;
		status = 'done';
		if (res.status === 'success') {
			earned = starsFor(lesson, playerMoves, hints, startDtm);
			sound.end('win');
			const prev = await db.endgames.get(lesson.id);
			if (!prev || earned > prev.stars || (prev.bestMoves ?? 99) > playerMoves) {
				await db.endgames.put({
					id: lesson.id,
					stars: Math.max(earned, prev?.stars ?? 0),
					bestMoves: Math.min(playerMoves, prev?.bestMoves ?? 99),
					date: Date.now()
				});
			}
			best = Math.max(best, earned);
			await bumpActivity('reviews');
		} else {
			sound.bad();
		}
	}

	/** Tipp in zwei Stufen: erst die Figur, dann der Zug */
	async function hint() {
		if (status !== 'playing') return;
		const tb = await probe(game.fen);
		if (!tb.best) return;
		hintStage = Math.min(2, hintStage + 1);
		shapes =
			hintStage === 1
				? [{ orig: tb.best.slice(0, 2), brush: 'hint' }]
				: [{ orig: tb.best.slice(0, 2), dest: tb.best.slice(2, 4), brush: 'hint' }];
		hints++;
	}

	const theoryStep = $derived(lesson && theoryIdx !== null ? lesson.theory[theoryIdx] : null);

	const msg = $derived(
		verdict && verdict.status !== 'continue' ? t(verdict.message, verdict.params) : ''
	);
	const left = $derived(lesson ? Math.max(0, lesson.maxMoves - playerMoves) : 0);
</script>

<svelte:head
	><title>{lesson ? lessonTitle(lesson) : t('learn.endgames')} – Rookie</title></svelte:head
>

{#if lesson}
	<div class="top-line">
		<a class="back" href={resolve('/learn')}><ArrowLeft size={18} /> {t('endgame.back')}</a>
		{#if lesson.positions.length > 1}
			<span class="pos">{t('endgame.position', { i: posIdx + 1, n: lesson.positions.length })}</span
			>
		{/if}
	</div>

	<div class="arena">
		<div class="board-col">
			<Board
				fen={theoryStep ? theoryStep.fen : fen}
				orientation={lesson.player}
				turnColor={theoryStep ? undefined : turn}
				lastMove={theoryStep ? undefined : lastMove}
				check={theoryStep ? false : check}
				dests={theoryStep ? new Map() : dests}
				movableColor={lesson.player}
				shapes={theoryStep ? theoryStep.shapes : shapes}
				flash={verdict?.status === 'success' ? 'good' : verdict?.status === 'fail' ? 'bad' : ''}
				isPromotion={(f, to) => game.isPromotion(f as never, to as never)}
				{onMove}
				label={t('endgame.board')}
			/>
			{#if coach && !theoryStep && status !== 'done'}
				<p class="coach {coach.kind}" role="status">{coach.text}</p>
			{/if}
		</div>

		<aside class="panel card">
			<div class="head">
				<span class="icon"><LessonIcon icon={lesson.icon} size={24} /></span>
				<div>
					<h1>{lessonTitle(lesson)}</h1>
					<p class="sub">{lessonSubtitle(lesson)}</p>
				</div>
			</div>

			<div class="goal-row">
				<span class="goal">{goalText(lesson)}</span>
				<Stars n={best} size={15} />
			</div>

			{#if theoryStep && theoryIdx !== null}
				<div class="theory">
					<span class="t-step"
						>{t('endgame.theoryStep', { i: theoryIdx + 1, n: lesson.theory.length })}</span
					>
					<div class="t-dots">
						{#each lesson.theory.map((_, i) => i) as i (i)}<span class:on={i <= theoryIdx}
							></span>{/each}
					</div>
					<p class="t-text">{lessonSteps(lesson)[theoryIdx]}</p>
					<div class="actions">
						{#if theoryIdx > 0}
							<button
								class="btn secondary"
								onclick={() => (theoryIdx = theoryIdx! - 1)}
								aria-label={t('common.back')}><ArrowLeftIcon size={18} /></button
							>
						{/if}
						{#if theoryIdx < lesson.theory.length - 1}
							<button class="btn grow" onclick={() => (theoryIdx = theoryIdx! + 1)}
								>{t('common.next')} <ArrowRight size={18} /></button
							>
						{:else}
							<button class="btn grow" onclick={() => (theoryIdx = null)}
								>{t('endgame.startChallenge')} <ArrowRight size={18} /></button
							>
						{/if}
					</div>
				</div>
			{:else if status === 'done' && verdict}
				<div class="result {verdict.status}">
					<h2>{verdict.status === 'success' ? t('endgame.success') : t('endgame.fail')}</h2>
					{#if verdict.status === 'success'}<Stars n={earned} size={26} animate />{/if}
					<p>{msg}</p>
				</div>
				<div class="actions">
					{#if verdict.status === 'success' && lesson.positions.length > 1}
						<button class="btn grow" onclick={() => start(posIdx + 1)}>
							{t('endgame.nextPos')}
							<ArrowRight size={18} />
						</button>
						<button class="btn secondary" onclick={() => start(posIdx)} title={t('endgame.again')}
							><RotateCcw size={18} /></button
						>
					{:else}
						<button class="btn grow" onclick={() => start(posIdx)}>
							<RotateCcw size={18} />
							{t('endgame.again')}
						</button>
					{/if}
				</div>
			{:else}
				<div class="state">
					<span class="dot" class:thinking={status === 'thinking'}></span>
					<span>
						{status === 'thinking'
							? t('endgame.opponent')
							: `${t('endgame.yourTurn')} · ${t('endgame.youPlay', { side: colorName(lesson.player) })}`}
					</span>
					<span class="left">{t('endgame.movesLeft', { n: left })}</span>
				</div>
				<div class="meter" aria-hidden="true">
					<div class="fill" style:width="{(playerMoves / lesson.maxMoves) * 100}%"></div>
				</div>
				<div class="actions">
					<button class="btn secondary grow" onclick={hint} disabled={status !== 'playing'}>
						<Lightbulb size={18} />
						{t('common.hint')}
					</button>
					<button class="btn secondary" onclick={() => start(posIdx)} title={t('endgame.again')}>
						<RotateCcw size={18} />
					</button>
				</div>
			{/if}

			{#if offline}
				<p class="offline"><WifiOff size={15} /> {t('endgame.offline')}</p>
			{/if}

			{#if !theoryStep}
				<button class="btn ghost" onclick={() => (theoryIdx = 0)}
					><BookOpen size={17} /> {t('endgame.showTheory')}</button
				>
			{/if}

			{#if !theoryStep}
				<div class="howto">
					<h3>{t('endgame.howTo')}</h3>
					<ol>
						{#each lessonSteps(lesson) as step, i (i)}
							<li>{step}</li>
						{/each}
					</ol>
				</div>
			{/if}
		</aside>
	</div>
{/if}

<style>
	.theory {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.t-step {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-learn);
	}

	.t-dots {
		display: flex;
		gap: 5px;
	}

	.t-dots span {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-2);
		transition: background-color var(--dur) var(--ease-out);
	}

	.t-dots span.on {
		background: var(--c-learn);
	}

	.t-text {
		font-size: 1.05rem;
		line-height: 1.5;
		animation: fade 300ms var(--ease-out);
	}

	.coach {
		margin-top: 0.55rem;
		padding: 0.65rem 0.8rem;
		border-radius: 12px;
		font-size: 0.92rem;
		line-height: 1.4;
		border: 1px solid var(--line);
		border-left: 3px solid var(--line-strong);
		background: var(--surface);
		animation: fade 260ms var(--ease-out);
	}

	.coach.best,
	.coach.holds {
		border-color: var(--good);
	}

	.coach.good {
		border-color: var(--c-learn);
	}

	.coach.slow,
	.coach.warn {
		border-color: var(--warn);
	}

	.btn.ghost {
		background: none;
		color: var(--text-2);
		box-shadow: none;
		align-self: flex-start;
		padding-inline: 0.2rem;
	}

	@keyframes fade {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}

	.top-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	.pos {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-3);
	}

	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	.board-col {
		width: 100%;
		max-width: min(640px, calc(100dvh - 220px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
		.board-col {
			max-width: min(680px, calc(100dvh - 160px));
		}
		.panel {
			position: sticky;
			top: 2rem;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.15rem;
	}

	.head {
		display: flex;
		gap: 0.8rem;
		align-items: center;
	}

	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 15px;
		background: var(--c-learn);
		color: #fff;
	}

	h1 {
		font-size: 1.4rem;
	}

	.sub {
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.goal-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.8rem;
		border-radius: 12px;
		background: var(--c-learn-soft);
	}

	.goal {
		font-weight: 650;
		font-size: 0.92rem;
		color: var(--c-learn);
	}

	.state {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 600;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--accent);
	}

	.dot.thinking {
		background: var(--text-3);
		animation: blink 1s ease-in-out infinite;
	}

	.left {
		margin-left: auto;
		font-size: 0.82rem;
		color: var(--text-3);
		font-weight: 600;
	}

	.meter {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--c-learn), var(--accent));
		transition: width 400ms var(--ease-out);
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
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		text-align: center;
		padding: 0.9rem;
		border-radius: 14px;
		animation: rise 360ms var(--ease-out);
	}

	.result.success {
		background: color-mix(in srgb, var(--good) 12%, transparent);
	}

	.result.fail {
		background: color-mix(in srgb, var(--bad) 10%, transparent);
	}

	.result h2 {
		font-size: 1.35rem;
	}

	.result.success h2 {
		color: var(--good-text);
	}

	.result p {
		color: var(--text-2);
		font-size: 0.95rem;
	}

	.offline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.howto {
		padding-top: 0.8rem;
		border-top: 1px solid var(--line);
	}

	.howto h3 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}

	ol {
		margin: 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		color: var(--text-2);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	li::marker {
		color: var(--c-learn);
		font-weight: 700;
	}

	@keyframes blink {
		50% {
			opacity: 0.3;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
