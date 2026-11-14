<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Star from '@lucide/svelte/icons/star';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import { Game } from '#lib/chess/game.js';
	import {
		BASICS,
		TACTICS,
		basicById,
		isTactic,
		isPositional,
		POSITIONAL,
		soloDests,
		soloFen,
		type BasicLesson
	} from '#lib/basics/lessons.js';
	import { themeName } from '#lib/data/themes.js';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import { loc } from '#lib/openings/courses.js';
	import { getSetting, setSetting, bumpActivity } from '#lib/db/db.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let done = $state<string[]>([]);
	let set = $state<'basics' | 'tactics' | 'positional'>('basics');
	const SET = $derived(set === 'tactics' ? TACTICS : set === 'positional' ? POSITIONAL : BASICS);
	const doneKey = $derived(
		set === 'tactics' ? 'tacticsDone' : set === 'positional' ? 'positionalDone' : 'basicsDone'
	);
	let lesson = $state.raw<BasicLesson | null>(null);
	let si = $state(0);
	let finished = $state(false);

	// Sterne-Spiel
	let pos = $state('');
	let stars = $state<string[]>([]);
	let moves = $state(0);
	// Aufgabe
	let game = $state.raw(new Game());
	let gv = $state(0);
	let solved = $state(false);
	let wrong = $state(0);
	let flash = $state<'' | 'good' | 'bad'>('');

	const step = $derived(lesson ? lesson.steps[si] : null);
	/** Aufgaben können auch mit Schwarz am Zug sein (z. B. Stellungsspiel: Zurückschlagen) */
	const side = $derived<'white' | 'black'>(
		step?.kind === 'find' && step.fen.split(' ')[1] === 'b' ? 'black' : 'white'
	);

	onMount(async () => {
		const id = page.url.searchParams.get('id');
		const l = id ? basicById(id) : null;
		const q = page.url.searchParams.get('set');
		set = l
			? isTactic(l)
				? 'tactics'
				: isPositional(l)
					? 'positional'
					: 'basics'
			: q === 'tactics' || q === 'positional'
				? q
				: 'basics';
		done = await getSetting<string[]>(doneKey, []);
		if (l) open(l);
	});

	function open(l: BasicLesson | null) {
		lesson = l;
		finished = false;
		if (l) setStep(0);
	}

	function setStep(i: number) {
		if (!lesson) return;
		// Mobil: neues Brett wieder ganz sichtbar machen
		if (typeof window !== 'undefined' && window.scrollY > 0)
			window.scrollTo({ top: 0, behavior: 'smooth' });
		si = i;
		solved = false;
		wrong = 0;
		const s = lesson.steps[i];
		if (s.kind === 'stars') {
			pos = s.start;
			stars = [...s.stars];
			moves = 0;
		} else if (s.kind === 'find') {
			game = new Game(s.fen);
			gv++;
		}
	}

	function blink(kind: 'good' | 'bad') {
		flash = kind;
		setTimeout(() => (flash = ''), 450);
	}

	const boardFen = $derived.by(() => {
		void gv;
		if (!step) return '8/8/8/8/8/8/8/8 w - - 0 1';
		if (step.kind === 'info') return step.fen;
		if (step.kind === 'stars') return soloFen(step.role, pos);
		return game.fen;
	});

	const boardDests = $derived.by(() => {
		void gv;
		if (!step || solved) return new Map<string, string[]>();
		if (step.kind === 'stars') return soloDests(step.role, pos);
		if (step.kind === 'find') return game.dests();
		return new Map<string, string[]>();
	});

	const boardShapes = $derived.by((): Shape[] => {
		if (!step) return [];
		if (step.kind === 'info') return step.shapes ?? [];
		if (step.kind === 'stars') return stars.map((s) => ({ orig: s, brush: 'info' as const }));
		if (step.kind === 'find' && wrong >= 2 && !solved) {
			const u = firstAccepted();
			return u ? [{ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: 'good' as const }] : [];
		}
		return [];
	});

	function accepted(uci: string): boolean {
		if (!step || step.kind !== 'find') return false;
		const g = new Game(step.fen);
		if (!g.play(uci)) return false;
		if (step.accept === 'check') return g.isCheck;
		if (step.accept === 'mate') return g.end()?.kind === 'checkmate';
		return step.accept.includes(uci);
	}

	function firstAccepted(): string | null {
		if (!step || step.kind !== 'find') return null;
		return new Game(step.fen).legalUcis().find(accepted) ?? null;
	}

	function onMove(uci: string) {
		if (!step || solved) return;
		const to = uci.slice(2, 4);
		if (step.kind === 'stars') {
			pos = to;
			moves++;
			const hit = stars.includes(to);
			stars = stars.filter((s) => s !== to);
			sound.move(hit, false);
			if (!stars.length) {
				solved = true;
				blink('good');
				sound.good();
			}
			return;
		}
		if (step.kind === 'find') {
			if (accepted(uci) || accepted(uci.slice(0, 4) + 'q')) {
				const mv = game.play(accepted(uci) ? uci : uci.slice(0, 4) + 'q');
				sound.move(!!mv?.captured, game.isCheck);
				gv++;
				solved = true;
				blink('good');
				sound.good();
			} else {
				wrong++;
				gv++;
				blink('bad');
				sound.bad();
			}
		}
	}

	const canNext = $derived(!!step && (step.kind === 'info' || solved));

	async function next() {
		if (!lesson) return;
		if (si < lesson.steps.length - 1) return setStep(si + 1);
		// erst speichern, dann den Abschluss zeigen
		if (!done.includes(lesson.id)) {
			// einfaches Array speichern – IndexedDB kann Svelte-Proxys nicht klonen
			const list = [...done, lesson.id];
			await setSetting(doneKey, list);
			done = list;
		}
		finished = true;
		sound.end('win');
		await bumpActivity('reviews');
	}

	function nextLesson(): BasicLesson | null {
		if (!lesson) return null;
		return SET[SET.indexOf(lesson) + 1] ?? null;
	}

	function openNext() {
		const n = nextLesson();
		if (n) {
			open(n);
			void goto(resolve(`/learn/basics?id=${n.id}`), { replaceState: true });
		}
	}
	const nextId = $derived(SET.find((x) => !done.includes(x.id))?.id);
</script>

<svelte:head><title>{t('basics.title')} – Rookie</title></svelte:head>

{#if !lesson}
	<a class="back hit44" href={resolve('/learn')}><ArrowLeft size={18} /> {t('endgame.back')}</a>
	<PageHeader
		title={set === 'tactics'
			? t('tactics.title')
			: set === 'positional'
				? t('positional.title')
				: t('basics.title')}
		subtitle={set === 'tactics'
			? t('tactics.subtitle')
			: set === 'positional'
				? t('positional.subtitle')
				: t('basics.subtitle')}
	/>
	<p class="meta">{t('basics.progress', { n: done.length, m: SET.length })}</p>
	<ol class="path">
		{#each SET as l, i (l.id)}
			<li style:--i={i}>
				<button
					class="item card pressable"
					class:done={done.includes(l.id)}
					class:next={l.id === nextId}
					onclick={() => open(l)}
				>
					<span class="no"
						>{#if done.includes(l.id)}<Check size={16} />{:else}{i + 1}{/if}</span
					>
					<span class="it-text">
						<b>{loc(l.title)}</b>
						<span
							>{#if l.id === nextId}<em class="up">{t('basics.upNext')}</em> ·
							{/if}{t('basics.steps', { n: l.steps.length })}</span
						>
					</span>
					<ArrowRight size={18} />
				</button>
			</li>
		{/each}
	</ol>
{:else}
	<button class="back hit44" onclick={() => open(null)}
		><ArrowLeft size={18} /> {t('basics.overview')}</button
	>
	<div class="arena">
		<div class="board-col">
			<Board
				fen={boardFen}
				orientation={side}
				turnColor={side}
				dests={boardDests}
				movableColor={side}
				shapes={boardShapes}
				{flash}
				isPromotion={(f, to) =>
					step?.kind === 'find' ? game.isPromotion(f as never, to as never) : false}
				{onMove}
			/>
		</div>
		<aside class="panel card">
			<p class="crumb">{loc(lesson.title)}</p>
			{#if finished}
				<div class="fin">
					<span class="fin-ico"><Check size={26} /></span>
					<h2>{t('basics.lessonDone')}</h2>
					{#if lesson.theme}
						<p class="practise">{t('tactics.practiseText', { theme: themeName(lesson.theme) })}</p>
					{/if}
					<div class="row-btns">
						{#if lesson.theme}
							<a class="btn" href={resolve(`/puzzles?theme=${lesson.theme}`)}
								><Puzzle size={17} /> {t('tactics.practise')}</a
							>
						{/if}
						{#if nextLesson()}
							<button class="btn" onclick={openNext}
								>{t('basics.nextLesson')} <ArrowRight size={17} /></button
							>
						{/if}
						<button class="btn secondary" onclick={() => open(lesson)}
							><RotateCcw size={16} /> {t('basics.again')}</button
						>
					</div>
				</div>
			{:else if step}
				<div class="dots">
					{#each lesson.steps.map((_, i) => i) as i (i)}<span class:on={i <= si}></span>{/each}
				</div>
				<span class="step-no">{t('basics.step', { i: si + 1, n: lesson.steps.length })}</span>
				{#key si}<p class="text">{loc(step.text)}</p>{/key}

				{#if step.kind === 'stars'}
					<p class="status" class:ok={solved}>
						<Star size={16} />
						{solved
							? t('basics.allStars', { n: moves })
							: t('basics.starsLeft', { n: stars.length })}
					</p>
				{:else if step.kind === 'find'}
					{#if solved}
						<p class="status ok"><Check size={16} /> {loc(step.done)}</p>
					{:else if wrong}
						<p class="status bad">{t('basics.tryAgain')}</p>
					{/if}
				{/if}

				<button class="btn big" onclick={next} disabled={!canNext}
					>{t('basics.next')} <ArrowRight size={18} /></button
				>
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
		margin-bottom: 0.75rem;
	}

	.meta {
		color: var(--text-2);
		margin: -0.5rem 0 1rem;
	}

	.path {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		max-width: 640px;
	}

	.path li {
		animation: rise 400ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 35ms);
	}

	.item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--line);
		text-align: left;
		color: var(--text-2);
		font: inherit;
		cursor: pointer;
	}

	.no {
		flex: none;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--c-learn-soft);
		color: var(--c-learn);
		font-weight: 750;
	}

	.item.next {
		border: 1.5px solid color-mix(in srgb, var(--c-learn) 55%, transparent);
		background: color-mix(in srgb, var(--c-learn) 7%, var(--surface));
	}

	.item.next .no {
		background: var(--c-learn);
		color: #fff;
	}

	.up {
		font-style: normal;
		font-weight: 700;
		color: var(--c-learn);
	}

	.item.done .no {
		background: var(--good);
		color: #fff;
	}

	.it-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		color: var(--text);
	}

	.it-text span {
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	.board-col {
		width: 100%;
		max-width: min(620px, calc(100svh - 240px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.15rem;
	}

	.crumb,
	.step-no {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-2);
	}

	.step-no {
		color: var(--c-learn);
	}

	.dots {
		display: flex;
		gap: 5px;
	}

	.dots span {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-2);
		transition: background-color var(--dur) var(--ease-out);
	}

	.dots span.on {
		background: var(--c-learn);
	}

	.text {
		font-size: 1.08rem;
		line-height: 1.5;
		animation: rise 300ms var(--ease-out) both;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 650;
		color: var(--text-2);
	}

	.status.ok {
		color: var(--good-text);
	}

	.status.bad {
		color: var(--bad);
	}

	.practise {
		color: var(--text-2);
		line-height: 1.45;
	}

	.fin {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		align-items: flex-start;
	}

	.fin-ico {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--good);
		color: #fff;
	}

	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
