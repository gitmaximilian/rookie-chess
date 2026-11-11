<script lang="ts">
	import Dock from '#lib/ui/Dock.svelte';
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
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Dumbbell from '@lucide/svelte/icons/dumbbell';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Target from '@lucide/svelte/icons/target';
	import Compass from '@lucide/svelte/icons/compass';
	import { depthFor, type Trap } from '#lib/openings/depth.js';
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
	import { notifyProgress } from '#lib/ui/progress.js';

	let course = $state.raw<Course>(COURSES[0]);
	let progress = $state<CourseProgress>({});
	let view = $state<'overview' | 'learn' | 'done' | 'study' | 'quiz'>('overview');
	const depth = $derived(depthFor(course.id));

	// ── Lernen (Zug für Zug mit Erklärung) ──
	let study = $state.raw<{
		kind: 'line' | 'trap';
		line?: CourseLine;
		trap?: Trap;
		ucis: string[];
		notes: Record<number, { en: string; de: string }>;
	} | null>(null);
	let si = $state(0);
	const studyGame = $derived(study ? Game.fromUciMoves(study.ucis.slice(0, si)) : null);
	const studyNote = $derived.by(() => {
		if (!study || si === 0) return '';
		const before = Game.fromUciMoves(study.ucis.slice(0, si - 1)).fen;
		return loc(study.notes[si - 1]) || autoNote(before, study.ucis[si - 1]);
	});
	const studySan = $derived.by(() => {
		if (!study || si === 0) return '';
		const before = Game.fromUciMoves(study.ucis.slice(0, si - 1)).fen;
		return sanForUci(before, study.ucis[si - 1]);
	});
	const studyShapes = $derived.by((): Shape[] => {
		if (!study) return [];
		const out: Shape[] = [];
		const isMistake = study.kind === 'trap' && si - 1 === study.trap!.mistake;
		if (si > 0 && isMistake) {
			const u = study.ucis[si - 1];
			out.push({ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: 'bad' });
		}
		const nx = study.ucis[si];
		if (nx) out.push({ orig: nx.slice(0, 2), dest: nx.slice(2, 4), brush: 'info' });
		return out;
	});

	function startStudy(l: CourseLine) {
		stopTimers();
		study = { kind: 'line', line: l, ucis: lineUcis(l), notes: l.notes };
		si = 0;
		view = 'study';
	}

	function startTrap(tr: Trap) {
		stopTimers();
		study = {
			kind: 'trap',
			trap: tr,
			ucis: lineUcis({ id: tr.id, name: tr.name, moves: tr.moves, notes: tr.notes }),
			notes: tr.notes
		};
		si = 0;
		view = 'study';
	}

	function studyStep(d: number) {
		if (!study) return;
		const n = Math.max(0, Math.min(study.ucis.length, si + d));
		if (n === si) return;
		si = n;
		if (d > 0) {
			const g = Game.fromUciMoves(study.ucis.slice(0, si));
			const mv = g.moves.at(-1);
			if (mv) sound.move(!!mv.captured, g.isCheck);
		}
	}

	function onStudyKey(e: KeyboardEvent) {
		if (view !== 'study') return;
		if (e.key === 'ArrowRight' || e.key === ' ') {
			e.preventDefault();
			studyStep(1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			studyStep(-1);
		}
	}

	// ── Quiz: gemischte Stellungen aus allen (gelernten) Varianten ──
	interface QuizItem {
		fen: string;
		uci: string;
		line: CourseLine;
		ply: number;
	}
	let quiz = $state.raw<QuizItem[]>([]);
	let qi = $state(0);
	let qScore = $state(0);
	let qState = $state<'await' | 'right' | 'wrong' | 'done'>('await');
	let qGame = $state.raw<Game | null>(null);
	let qv = $state(0);
	let qFeedback = $state<MoveFeedback | null>(null);
	const learnedLines = $derived(course.lines.filter((l) => progress[course.id]?.[l.id]));

	function startQuiz() {
		stopTimers();
		const pool: QuizItem[] = [];
		// nur lokal zum Aussortieren doppelter Stellungen
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Set<string>();
		for (const l of learnedLines.length ? learnedLines : course.lines) {
			const u = lineUcis(l);
			const g = new Game();
			u.forEach((m, i) => {
				// die ersten Züge sind trivial – erst ab dem 3. eigenen Zug abfragen
				if (isOwnPly(course, i) && i >= 4 && !seen.has(g.fen)) {
					seen.add(g.fen);
					pool.push({ fen: g.fen, uci: m, line: l, ply: i });
				}
				g.play(m);
			});
		}
		for (let i = pool.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[pool[i], pool[j]] = [pool[j], pool[i]];
		}
		quiz = pool.slice(0, 10);
		qi = 0;
		qScore = 0;
		loadQuiz();
		view = 'quiz';
	}

	function loadQuiz() {
		const it = quiz[qi];
		if (!it) {
			qState = 'done';
			void bumpActivity('reviews');
			notifyProgress();
			return;
		}
		qGame = new Game(it.fen);
		qState = 'await';
		qFeedback = null;
		qv++;
	}

	async function onQuizMove(uci: string) {
		const it = quiz[qi];
		if (!it || qState !== 'await' || !qGame) return;
		if (uci === it.uci || uci + 'q' === it.uci) {
			const mv = qGame.play(it.uci);
			sound.move(!!mv?.captured, qGame.isCheck);
			qScore++;
			qState = 'right';
			flash = 'good';
			setTimeout(() => (flash = ''), 500);
		} else {
			sound.bad();
			qState = 'wrong';
			flash = 'bad';
			setTimeout(() => (flash = ''), 500);
			abort = new AbortController();
			qFeedback = await feedbackFor(it.fen, uci, abort.signal).catch(() => null);
		}
		qv++;
	}

	const quizShapes = $derived.by((): Shape[] => {
		void qv;
		const it = quiz[qi];
		if (!it || qState !== 'wrong') return [];
		return [{ orig: it.uci.slice(0, 2), dest: it.uci.slice(2, 4), brush: 'good' }];
	});

	function stopTimers() {
		if (timer) clearTimeout(timer);
		abort?.abort();
	}

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
		notifyProgress();
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
		stopTimers();
		study = null;
		view = 'overview';
	}
</script>

<svelte:head><title>{loc(course.name)} – Rookie</title></svelte:head>
<svelte:window onkeydown={onStudyKey} />

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
			<div class="how">
				<b>{t('course.howItWorks')}</b>
				<ol>
					<li><BookOpen size={15} /> {t('course.step1')}</li>
					<li><Dumbbell size={15} /> {t('course.step2')}</li>
					<li><Shuffle size={15} /> {t('course.step3')}</li>
				</ol>
			</div>
			<button class="btn big" onclick={() => startStudy(firstOpen())}
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
						<span class="l-btns">
							<button
								class="btn small secondary"
								onclick={() => startStudy(l)}
								aria-label="{t('course.study')}: {loc(l.name)}"><BookOpen size={15} /></button
							>
							<button class="btn small" class:secondary={!!done} onclick={() => startLine(l)}
								>{done ? t('course.repeat') : t('course.practise')}</button
							>
						</span>
					</li>
				{/each}
			</ul>
			<button class="btn secondary quiz-btn" onclick={startQuiz}
				><Shuffle size={17} /> {t('course.quizTitle')}</button
			>
			<p class="muted small">{t('course.quizText')}</p>
		</section>

		{#if depth.plans.length}
			<section class="card block">
				<h2><Compass size={18} /> {t('course.plans')}</h2>
				<p class="muted">{t('course.plansText')}</p>
				<ul class="plain">
					{#each depth.plans as pl, i (i)}<li>{loc(pl)}</li>{/each}
				</ul>
				{#if depth.pitfalls.length}
					<h3><TriangleAlert size={16} /> {t('course.pitfalls')}</h3>
					<ul class="plain warn">
						{#each depth.pitfalls as pf, i (i)}<li>{loc(pf)}</li>{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if depth.traps.length}
			<section class="card block">
				<h2><Target size={18} /> {t('course.traps')}</h2>
				<p class="muted">{t('course.trapsText')}</p>
				<ul class="lines">
					{#each depth.traps as tr (tr.id)}
						<li>
							<span class="state trap {tr.kind}"
								>{#if tr.kind === 'set'}<Target size={14} />{:else}<TriangleAlert
										size={14}
									/>{/if}</span
							>
							<span class="l-text">
								<b>{loc(tr.name)}</b>
								<span class="l-moves"
									>{tr.kind === 'set' ? t('course.trapSet') : t('course.trapAvoid')}</span
								>
							</span>
							<button class="btn small secondary" onclick={() => startTrap(tr)}
								><BookOpen size={15} /> {t('course.study')}</button
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{:else if view === 'study' && study && studyGame}
	<button class="back" onclick={toOverview}
		><ArrowLeft size={18} /> {t('course.backToCourse')}</button
	>
	<div class="arena">
		<div class="board-col">
			<Board
				fen={studyGame.fen}
				orientation={course.color}
				turnColor={studyGame.turn}
				lastMove={studyGame.lastMove}
				viewOnly
				shapes={studyShapes}
			/>
			<Dock order={2}>
				<div class="stepper">
					<button
						class="step-btn"
						onclick={() => studyStep(-1)}
						disabled={si === 0}
						aria-label={t('course.prev')}><ChevronLeft size={22} /></button
					>
					<span class="step-count">{t('course.moveOf', { n: si, m: study.ucis.length })}</span>
					<button
						class="btn step-next"
						onclick={() => studyStep(1)}
						disabled={si >= study.ucis.length}>{t('course.next')} <ChevronRight size={18} /></button
					>
				</div>
			</Dock>
		</div>

		<aside class="panel card">
			<p class="crumb">
				{loc(course.name)} · {study.kind === 'line' ? loc(study.line!.name) : loc(study.trap!.name)}
			</p>
			{#if study.kind === 'trap'}
				<span class="trap-tag {study.trap!.kind}"
					>{study.trap!.kind === 'set' ? t('course.trapSet') : t('course.trapAvoid')}</span
				>
			{/if}
			<div class="dots" aria-hidden="true">
				{#each study.ucis as u, i (i + u)}
					<button
						class="dot"
						class:on={i < si}
						class:own={isOwnPly(course, i)}
						class:bad={study.kind === 'trap' && i === study.trap!.mistake}
						tabindex="-1"
						aria-label={t('course.moveOf', { n: i + 1, m: study.ucis.length })}
						onclick={() => (si = i + 1)}
					></button>
				{/each}
			</div>
			<Dock order={1}>
				{#if si === 0}
					<div class="study-card">
						<p>{t('course.studyIntro')}</p>
					</div>
				{:else}
					{@const own = isOwnPly(course, si - 1)}
					{@const mistake = study.kind === 'trap' && si - 1 === study.trap!.mistake}
					<div class="study-card" class:own class:mistake>
						<span class="who"
							>{mistake
								? t('course.theMistake')
								: own
									? t('course.you')
									: t('course.opponent')}</span
						>
						<b class="s-san">{Math.ceil(si / 2)}{si % 2 === 1 ? '.' : '…'} {figurine(studySan)}</b>
						{#if studyNote}<p>{studyNote}</p>{/if}
					</div>
				{/if}
				{#if si >= study.ucis.length}
					{#if study.kind === 'line'}
						<div class="done-box">
							<p class="muted">{t('course.studyDoneText')}</p>
							<button class="btn" onclick={() => startLine(study!.line!)}
								><Dumbbell size={17} /> {t('course.studyDone')}</button
							>
						</div>
					{:else}
						<button class="btn secondary" onclick={toOverview}>{t('course.backToCourse')}</button>
					{/if}
				{/if}
			</Dock>
		</aside>
	</div>
{:else if view === 'quiz'}
	<button class="back" onclick={toOverview}
		><ArrowLeft size={18} /> {t('course.backToCourse')}</button
	>
	<div class="arena">
		<div class="board-col">
			{#key qv}
				<Board
					fen={qGame?.fen ?? quiz[0]?.fen ?? ''}
					orientation={course.color}
					turnColor={qGame?.turn}
					lastMove={qGame?.lastMove}
					dests={qState === 'await' && qGame ? qGame.dests() : new Map()}
					movableColor={course.color}
					shapes={quizShapes}
					{flash}
					isPromotion={(f, to) => qGame?.isPromotion(f as never, to as never) ?? false}
					onMove={(u) => void onQuizMove(u)}
				/>
			{/key}
		</div>
		<aside class="panel card">
			<p class="crumb">{loc(course.name)} · {t('course.quizTitle')}</p>
			<Dock>
				{#if qState === 'done'}
					<div class="done">
						<span class="done-ico"><Check size={26} /></span>
						<h2>{t('course.quizDone', { n: qScore, m: quiz.length })}</h2>
						<div class="row-btns">
							<button class="btn" onclick={startQuiz}
								><Shuffle size={17} /> {t('course.quizAgain')}</button
							>
							<button class="btn secondary" onclick={toOverview}>{t('course.backToCourse')}</button>
						</div>
					</div>
				{:else if quiz[qi]}
					{@const it = quiz[qi]}
					<span class="step-count">{qi + 1} / {quiz.length}</span>
					<p class="prompt waiting">{t('course.quizPrompt', { line: loc(it.line.name) })}</p>
					{#if qState === 'right'}
						<p class="ok-text">{t('course.quizCorrect')}</p>
						{#if it.line.notes[it.ply]}<p class="muted">{loc(it.line.notes[it.ply])}</p>{/if}
					{:else if qState === 'wrong'}
						{#if qFeedback}<div class="fb {qFeedback.kind}">
								<b>{qFeedback.title}</b>
								<p>{qFeedback.text}</p>
							</div>{/if}
						<p>
							{t('course.quizWrong', { san: figurine(sanForUci(it.fen, it.uci)) })}
						</p>
						{#if it.line.notes[it.ply]}<p class="muted">{loc(it.line.notes[it.ply])}</p>{/if}
					{/if}
					{#if qState !== 'await'}
						<button
							class="btn"
							onclick={() => {
								qi++;
								loadQuiz();
							}}>{t('common.next')} <ArrowRight size={17} /></button
						>
					{/if}
				{/if}
			</Dock>
		</aside>
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
			{#if feedback}
				<div class="fb strip {feedback.kind}" role="status">
					<b>{feedback.title}</b>
					<p>{feedback.text}</p>
				</div>
			{:else if log[0] && view === 'learn'}
				<div class="strip note {log[0].who}" role="status">
					<span class="who">{log[0].who === 'you' ? t('course.you') : t('course.opponent')}</span>
					<b>{figurine(log[0].san)}</b>
					{#if log[0].text}<p>{log[0].text}</p>{/if}
				</div>
			{/if}
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
				<Dock>
					<div class="prompt" class:waiting={status === 'await'}>
						{#if status === 'checking'}
							{t('course.checking')}
						{:else if status === 'await'}
							{t('course.yourMove')}
						{:else}
							{t('course.watch')}
						{/if}
					</div>

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
				</Dock>
			{/if}

			<ol class="log">
				{#each view === 'learn' ? log.slice(1) : log as e, i (log.length - i)}
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
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
		max-width: 1040px;
	}

	@media (min-width: 860px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
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

	.how {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.75rem 0.9rem;
		border-radius: 12px;
		background: var(--surface-2);
		font-size: 0.88rem;
	}

	.how ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		color: var(--text-2);
		line-height: 1.4;
	}

	.how li {
		display: flex;
		gap: 0.45rem;
		align-items: flex-start;
	}

	.how li :global(svg) {
		flex: none;
		margin-top: 2px;
		color: var(--c-learn);
	}

	.block h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.block h3 {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.98rem;
		margin-top: 0.3rem;
	}

	.plain {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		line-height: 1.45;
	}

	.plain.warn li::marker {
		color: var(--bad);
	}

	.small {
		font-size: 0.8rem;
	}

	.quiz-btn {
		align-self: flex-start;
		margin-top: 0.3rem;
	}

	.l-btns {
		display: flex;
		gap: 0.35rem;
		flex: none;
	}

	.state.trap {
		color: #fff;
		border-color: transparent;
	}

	.state.trap.set {
		background: var(--c-learn);
	}

	.state.trap.avoid {
		background: var(--bad);
	}

	:global(.docked) .stepper {
		margin-top: 0;
	}

	/* feste Höhe: das Brett springt nicht, wenn die Erklärung länger oder kürzer ist */
	:global(.docked) .study-card {
		height: 7.2rem;
		overflow-y: auto;
		padding: 0.6rem 0.8rem;
		gap: 0.2rem;
		font-size: 0.92rem;
		animation: none;
	}

	:global(.docked) .s-san {
		font-size: 1.1rem;
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.6rem;
	}

	.step-btn {
		display: grid;
		place-items: center;
		width: 48px;
		height: 46px;
		border-radius: 14px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}

	.step-btn:disabled {
		opacity: 0.4;
	}

	.step-count {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.step-next {
		min-width: 130px;
		justify-content: center;
	}

	.trap-tag {
		align-self: flex-start;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		color: #fff;
		background: var(--c-learn);
	}

	.trap-tag.avoid {
		background: var(--bad);
	}

	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.dot {
		width: 12px;
		height: 12px;
		padding: 0;
		border-radius: 4px;
		border: 1px solid var(--line-strong);
		background: transparent;
		cursor: pointer;
	}

	.dot.own {
		border-color: var(--c-learn);
	}

	.dot.on {
		background: var(--text-3);
		border-color: var(--text-3);
	}

	.dot.on.own {
		background: var(--c-learn);
		border-color: var(--c-learn);
	}

	.dot.bad {
		border-color: var(--bad);
	}

	.dot.on.bad {
		background: var(--bad);
	}

	.study-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: var(--surface-2);
		border-left: 3px solid var(--text-3);
		line-height: 1.5;
		animation: rise 300ms var(--ease-out) both;
	}

	.study-card.own {
		border-left-color: var(--c-learn);
	}

	.study-card.mistake {
		border-left-color: var(--bad);
		background: color-mix(in srgb, var(--bad) 9%, var(--surface));
	}

	.s-san {
		font-family: var(--font-display);
		font-size: 1.25rem;
	}

	.done-box {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: flex-start;
	}

	.ok-text {
		font-weight: 750;
		color: var(--good-text);
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

	.strip {
		margin-top: 0.55rem;
		padding: 0.65rem 0.85rem;
		border-radius: 14px;
		line-height: 1.4;
		animation: rise 260ms var(--ease-out) both;
	}

	.strip p {
		margin-top: 0.15rem;
		font-size: 0.92rem;
	}

	.strip.note {
		background: var(--surface);
		border: 1px solid var(--line);
		border-left: 3px solid var(--line-strong);
	}

	.strip.note.you {
		border-left-color: var(--c-learn);
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
	/* Handy: Brett so groß, dass es neben der Aktionsleiste ganz sichtbar bleibt */
	@media (max-width: 767px) {
		.board-col {
			max-width: min(
				100%,
				calc(100dvh - var(--dock-h) - var(--tabbar-h) - var(--safe-bottom) - var(--safe-top) - 75px)
			);
		}
	}
</style>
