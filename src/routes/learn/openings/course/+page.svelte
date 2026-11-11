<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Check from '@lucide/svelte/icons/check';
	import Play from '@lucide/svelte/icons/play';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Eye from '@lucide/svelte/icons/eye';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import { Game, sanForUci } from '#lib/chess/game.js';
	import { figurine } from '#lib/chess/notation.js';
	import {
		COURSES,
		courseById,
		lineUcis,
		isOwnPly,
		loc,
		autoNote,
		type Course,
		type CourseLine
	} from '#lib/openings/courses.js';
	import { feedbackFor, type MoveFeedback } from '#lib/openings/feedback.js';
	import {
		getCourseProgress,
		saveLineResult,
		type CourseProgress
	} from '#lib/openings/progress.js';
	import { addLine } from '#lib/openings/repertoire.js';
	import { bumpActivity } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let course = $state.raw<Course>(COURSES[0]);
	let progress = $state<CourseProgress>({});
	let view = $state<'overview' | 'learn' | 'done'>('overview');

	// ── Lernen ──
	let line = $state.raw<CourseLine | null>(null);
	let ucis: string[] = [];
	let game = $state.raw(new Game());
	let v = $state(0);
	let status = $state<'auto' | 'await' | 'checking'>('auto');
	let hintLevel = $state(0);
	let mistakes = $state(0);
	let firstTry = $state(0);
	let ownTotal = $state(0);
	let flash = $state<'' | 'good' | 'bad'>('');
	let feedback = $state<MoveFeedback | null>(null);
	let log = $state<{ who: 'you' | 'opp'; san: string; text: string }[]>([]);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let abort: AbortController | null = null;

	const fen = $derived.by(() => {
		void v;
		return game.fen;
	});
	const lastMove = $derived.by(() => {
		void v;
		return game.lastMove;
	});
	const turn = $derived.by(() => {
		void v;
		return game.turn;
	});
	const dests = $derived.by(() => {
		void v;
		return status === 'await' ? game.dests() : new Map<string, string[]>();
	});
	const expected = $derived.by(() => {
		void v;
		return ucis[game.ply] ?? '';
	});
	const shapes = $derived.by((): Shape[] => {
		if (status !== 'await' || !expected) return [];
		if (hintLevel >= 3)
			return [{ orig: expected.slice(0, 2), dest: expected.slice(2, 4), brush: 'good' }];
		if (hintLevel >= 2) return [{ orig: expected.slice(0, 2), brush: 'good' }];
		return [];
	});
	const hintPiece = $derived.by(() => {
		void v;
		if (!expected) return '';
		const role = game.pieceAt(expected.slice(0, 2));
		return role ? t(`pieces.name.${role}`) : '';
	});
	const learnedCount = $derived(course.lines.filter((l) => progress[course.id]?.[l.id]).length);

	onMount(async () => {
		course = courseById(page.url.searchParams.get('id') ?? '') ?? COURSES[0];
		progress = await getCourseProgress();
		const lineId = page.url.searchParams.get('line');
		if (lineId) {
			const l = course.lines.find((x) => x.id === lineId);
			if (l) startLine(l);
		}
	});

	onDestroy(() => {
		if (timer) clearTimeout(timer);
		abort?.abort();
	});

	function startLine(l: CourseLine) {
		if (timer) clearTimeout(timer);
		abort?.abort();
		line = l;
		ucis = lineUcis(l);
		game = new Game();
		v++;
		firstTry = 0;
		ownTotal = ucis.filter((_, i) => isOwnPly(course, i)).length;
		log = [];
		feedback = null;
		view = 'learn';
		step();
	}

	function noteAt(ply: number, fenBefore: string): string {
		return loc(line?.notes[ply]) || autoNote(fenBefore, ucis[ply]);
	}

	function step() {
		if (!line) return;
		if (game.ply >= ucis.length) return finishLine();
		if (!isOwnPly(course, game.ply)) {
			status = 'auto';
			timer = setTimeout(() => {
				const ply = game.ply;
				const before = game.fen;
				const mv = game.play(ucis[ply]);
				if (mv) {
					sound.move(!!mv.captured, game.isCheck);
					log = [{ who: 'opp', san: mv.san, text: noteAt(ply, before) }, ...log];
				}
				v++;
				step();
			}, 750);
			return;
		}
		status = 'await';
		hintLevel = 0;
		mistakes = 0;
	}

	async function onMove(uci: string) {
		if (status !== 'await') return;
		const ply = game.ply;
		const before = game.fen;
		if (uci === ucis[ply] || uci + 'q' === ucis[ply]) {
			const mv = game.play(ucis[ply])!;
			if (mistakes === 0 && hintLevel < 3) firstTry++;
			sound.move(!!mv.captured, game.isCheck);
			flash = 'good';
			setTimeout(() => (flash = ''), 500);
			feedback = null;
			log = [{ who: 'you', san: mv.san, text: noteAt(ply, before) }, ...log];
			v++;
			status = 'auto';
			timer = setTimeout(step, 450);
			return;
		}
		// falscher Zug: Brett zurücksetzen, Stockfish erklärt warum
		mistakes++;
		v++;
		flash = 'bad';
		setTimeout(() => (flash = ''), 500);
		sound.bad();
		status = 'checking';
		abort = new AbortController();
		feedback = await feedbackFor(before, uci, abort.signal);
		if (abort.signal.aborted) return;
		if (mistakes >= 2) hintLevel = Math.max(hintLevel, 3);
		status = 'await';
	}

	function hint() {
		hintLevel = Math.min(3, hintLevel + 1);
	}

	async function finishLine() {
		if (!line) return;
		view = 'done';
		sound.good();
		await saveLineResult(course.id, line.id, {
			firstTry,
			total: ownTotal,
			date: Date.now()
		});
		await addLine(course.color, ucis);
		await bumpActivity('reviews');
		progress = await getCourseProgress();
	}

	function nextLine(): CourseLine | null {
		if (!line) return course.lines[0];
		const i = course.lines.indexOf(line);
		return course.lines[i + 1] ?? null;
	}

	function firstOpen(): CourseLine {
		return course.lines.find((l) => !progress[course.id]?.[l.id]) ?? course.lines[0];
	}

	function toOverview() {
		if (timer) clearTimeout(timer);
		abort?.abort();
		view = 'overview';
	}
</script>

<svelte:head><title>{loc(course.name)} – Rookie</title></svelte:head>

{#if view === 'overview'}
	<a class="back" href={resolve('/learn/openings')}><ArrowLeft size={18} /> {t('openings.title')}</a
	>
	<header class="head">
		<span class="swatch {course.color}"></span>
		<div>
			<span class="eyebrow">{t(`course.level${course.level}`)}</span>
			<h1>{loc(course.name)}</h1>
			<p class="tagline">{loc(course.tagline)}</p>
		</div>
	</header>

	<div class="grid">
		<section class="card block">
			<h2>{t('course.ideas')}</h2>
			<ol class="ideas">
				{#each course.ideas as idea, i (i)}
					<li style:--i={i}><span class="num">{i + 1}</span>{loc(idea)}</li>
				{/each}
			</ol>
			<button class="btn big" onclick={() => startLine(firstOpen())}
				><Play size={18} /> {t('course.start')}</button
			>
		</section>

		<section class="card block">
			<h2>{t('course.lines')}</h2>
			<p class="muted">
				{t('course.progress', { n: learnedCount, m: course.lines.length })}
			</p>
			<ul class="lines">
				{#each course.lines as l (l.id)}
					{@const done = progress[course.id]?.[l.id]}
					<li>
						<span class="state" class:done
							>{#if done}<Check size={15} />{/if}</span
						>
						<span class="l-text">
							<b>{loc(l.name)}</b>
							<span class="l-moves">{l.moves.split(' ').slice(0, 6).join(' ')} …</span>
						</span>
						<button class="btn small" class:secondary={!!done} onclick={() => startLine(l)}
							>{done ? t('course.repeat') : t('course.learn')}</button
						>
					</li>
				{/each}
			</ul>
		</section>
	</div>
{:else}
	<button class="back" onclick={toOverview}
		><ArrowLeft size={18} /> {t('course.backToCourse')}</button
	>
	<div class="arena">
		<div class="board-col">
			<Board
				{fen}
				orientation={course.color}
				turnColor={turn}
				{lastMove}
				{dests}
				movableColor={course.color}
				{shapes}
				{flash}
				onMove={(u) => void onMove(u)}
			/>
		</div>

		<aside class="panel card">
			<p class="crumb">{loc(course.name)} · {line ? loc(line.name) : ''}</p>

			{#if view === 'done'}
				<div class="done">
					<span class="done-ico"><Check size={26} /></span>
					<h2>{t('course.lineDone')}</h2>
					<p class="muted">{t('course.lineDoneText', { n: firstTry, m: ownTotal })}</p>
					<div class="row-btns">
						{#if nextLine()}
							<button class="btn" onclick={() => startLine(nextLine()!)}
								>{t('course.nextLine')} <ArrowRight size={17} /></button
							>
						{/if}
						<button class="btn secondary" onclick={() => line && startLine(line)}
							><RotateCcw size={16} /> {t('course.again')}</button
						>
						<a class="btn secondary" href={resolve('/learn/openings')}>{t('course.review')}</a>
					</div>
				</div>
			{:else}
				<div class="prompt" class:waiting={status === 'await'}>
					{#if status === 'checking'}
						{t('course.checking')}
					{:else if status === 'await'}
						{t('course.yourMove')}
					{:else}
						{t('course.watch')}
					{/if}
				</div>

				{#if feedback}
					<div class="fb {feedback.kind}" role="status">
						<b>{feedback.title}</b>
						<p>{feedback.text}</p>
					</div>
				{/if}

				{#if status === 'await'}
					<div class="row-btns">
						{#if hintLevel < 3}
							<button class="btn secondary" onclick={hint}
								><Lightbulb size={17} /> {t('course.hint')}</button
							>
						{/if}
						{#if hintLevel < 3}
							<button class="btn ghost" onclick={() => (hintLevel = 3)}
								><Eye size={17} /> {t('course.showMove')}</button
							>
						{/if}
					</div>
					{#if hintLevel >= 1}
						<p class="hint-text">
							<Lightbulb size={15} />
							{hintLevel >= 3
								? figurine(sanForUci(fen, expected))
								: t('course.hintPiece', { piece: hintPiece })}
						</p>
					{/if}
				{/if}
			{/if}

			<ol class="log">
				{#each log as e, i (log.length - i)}
					<li class={e.who} class:latest={i === 0}>
						<span class="who">{e.who === 'you' ? t('course.you') : t('course.opponent')}</span>
						<b>{figurine(e.san)}</b>
						{#if e.text}<p>{e.text}</p>{/if}
					</li>
				{/each}
			</ol>
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
		margin-bottom: 0.75rem;
	}

	.head {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}

	.head h1 {
		font-size: clamp(1.8rem, 6vw, 2.6rem);
		line-height: 1.05;
	}

	.tagline {
		color: var(--text-2);
		margin-top: 0.35rem;
	}

	.swatch {
		flex: none;
		width: 26px;
		height: 26px;
		margin-top: 0.3rem;
		border-radius: 8px;
		border: 1px solid var(--line-strong);
	}

	.swatch.white {
		background: #fff;
	}

	.swatch.black {
		background: #222;
	}

	.grid {
		display: grid;
		gap: 0.75rem;
		max-width: 1040px;
	}

	@media (min-width: 860px) {
		.grid {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.2rem 1.25rem;
	}

	.block h2 {
		font-size: 1.15rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.ideas {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.ideas li {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		line-height: 1.45;
		animation: rise 420ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 70ms);
	}

	.num {
		flex: none;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--c-learn-soft);
		color: var(--c-learn);
		font-weight: 750;
		font-size: 0.85rem;
	}

	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.lines li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem;
		border-radius: 14px;
		background: var(--surface-2);
	}

	.state {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid var(--line-strong);
	}

	.state.done {
		border-color: var(--good);
		background: var(--good);
		color: #fff;
	}

	.l-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	.l-moves {
		font-size: 0.8rem;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	.board-col {
		width: 100%;
		max-width: min(620px, calc(100dvh - 220px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 360px;
			align-items: start;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.1rem;
	}

	.crumb {
		font-size: 0.8rem;
		font-weight: 650;
		color: var(--text-2);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.prompt {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--text-2);
	}

	.prompt.waiting {
		color: var(--text);
	}

	.fb {
		padding: 0.8rem 0.9rem;
		border-radius: 14px;
		border: 1px solid;
		animation: rise 300ms var(--ease-out) both;
	}

	.fb p {
		margin-top: 0.2rem;
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.fb.playable {
		border-color: color-mix(in srgb, var(--c-puzzle) 35%, transparent);
		background: color-mix(in srgb, var(--c-puzzle) 9%, transparent);
	}

	.fb.dubious {
		border-color: color-mix(in srgb, var(--warn) 45%, transparent);
		background: color-mix(in srgb, var(--warn) 10%, transparent);
	}

	.fb.bad {
		border-color: color-mix(in srgb, var(--bad) 40%, transparent);
		background: color-mix(in srgb, var(--bad) 9%, transparent);
	}

	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn.ghost {
		background: none;
		color: var(--text-2);
		box-shadow: none;
	}

	.hint-text {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 650;
		color: var(--c-learn);
	}

	.log {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-height: 360px;
		overflow-y: auto;
	}

	.log li {
		padding: 0.6rem 0.75rem;
		border-radius: 12px;
		background: var(--surface-2);
		opacity: 0.6;
	}

	.log li.latest {
		opacity: 1;
		animation: rise 320ms var(--ease-out) both;
	}

	.log li.you {
		border-left: 3px solid var(--c-learn);
	}

	.log li.opp {
		border-left: 3px solid var(--line-strong);
	}

	.who {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-2);
		margin-right: 0.35rem;
	}

	.log p {
		margin-top: 0.15rem;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.done {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: flex-start;
	}

	.done-ico {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--good);
		color: #fff;
		animation: pop 420ms var(--ease-spring) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	@keyframes pop {
		from {
			transform: scale(0.5);
			opacity: 0;
		}
	}
</style>
