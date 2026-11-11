<script lang="ts">
	import Dock from '#lib/ui/Dock.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import EvalBar from '#lib/ui/EvalBar.svelte';
	import EvalGraph from '#lib/ui/EvalGraph.svelte';
	import MoveList from '#lib/ui/MoveList.svelte';
	import { db, addTombstone, type GameRow } from '#lib/db/db.js';
	import { Game, sanForUci } from '#lib/chess/game.js';
	import { figurine } from '#lib/chess/notation.js';
	import {
		analyseGame,
		reviewMoves,
		createMistakePuzzles,
		type MoveReview
	} from '#lib/analysis/run.js';
	import { accuracy, MARK, judgementLabel, type PlyEval } from '#lib/analysis/classify.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';
	import { formatScore } from '#lib/engine/uci.js';
	import { openingFor, onOpeningsLoaded } from '#lib/data/openings.js';
	import { feedbackFor, type MoveFeedback } from '#lib/openings/feedback.js';
	import { getSetting, setSetting } from '#lib/db/db.js';
	import { notifyProgress } from '#lib/ui/progress.js';
	import { quality } from '#lib/import/ratings.js';
	import LinkedAccounts from '#lib/ui/LinkedAccounts.svelte';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Target from '@lucide/svelte/icons/target';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';

	// ── Liste ──
	let games = $state<GameRow[]>([]);
	let pgnText = $state('');
	let pgnError = $state('');

	// ── Einzelne Partie ──
	let row = $state.raw<GameRow | null>(null);
	let game = $state.raw<Game | null>(null);
	let ply = $state(0);
	let evals = $state<PlyEval[]>([]);
	let progress = $state(0);
	let analysing = $state(false);
	let orientation = $state<'white' | 'black'>('white');
	let showBest = $state(true);
	let mistakesCreated = $state<number | null>(null);
	let abort: AbortController | null = null;
	let loading = $state(true);
	let listLimit = $state(100);
	let gameCount = $state(0);

	type Filter = 'all' | 'lichess' | 'chesscom' | 'bot' | 'friend' | 'mistakes';
	let filter = $state<Filter>('all');
	const FILTERS: Filter[] = ['all', 'lichess', 'chesscom', 'bot', 'friend', 'mistakes'];

	async function loadList() {
		if (filter === 'all' || filter === 'mistakes') {
			const rows = await db.games
				.orderBy('date')
				.reverse()
				.limit(filter === 'mistakes' ? 1000 : listLimit)
				.toArray();
			games =
				filter === 'mistakes'
					? rows
							.filter((g) => {
								const q = quality(g);
								return q && q.blunders + q.mistakes > 0;
							})
							.slice(0, listLimit)
					: rows;
			gameCount = filter === 'all' ? await db.games.count() : games.length;
		} else {
			const rows = (await db.games.where('source').equals(filter).sortBy('date')).reverse();
			gameCount = rows.length;
			games = rows.slice(0, listLimit);
		}
	}

	async function setFilter(f: Filter) {
		filter = f;
		listLimit = 100;
		await loadList();
	}

	async function showMore() {
		listLimit += 200;
		await loadList();
	}

	const qualities = $derived(new Map(games.map((g) => [g.id, quality(g)])));

	const total = $derived(game ? game.ply + 1 : 0);
	const reviews = $derived<MoveReview[]>(row && evals.length > 1 ? reviewMoves(row, evals) : []);
	const marks = $derived(Object.fromEntries(reviews.map((r) => [r.ply, MARK[r.judgement]])));
	const fen = $derived(game ? game.fenAt(ply) : '');
	const lastMove = $derived.by(() => {
		if (!game || ply === 0) return undefined;
		const m = game.moves[ply - 1];
		return [m.from, m.to] as [string, string];
	});
	const currentReview = $derived(reviews.find((r) => r.ply === ply) ?? null);
	const evalHere = $derived(evals[ply] ?? null);
	let openingsReady = $state(0);
	onMount(() => onOpeningsLoaded(() => openingsReady++));
	const opening = $derived.by(() => {
		void openingsReady;
		if (!game) return null;
		return openingFor(game.moves.slice(0, Math.max(ply, Math.min(game.ply, 12))).map((m) => m.uci));
	});

	const shapes = $derived.by<Shape[]>(() => {
		const s: Shape[] = [];
		if (!game) return s;
		// Bester Zug in der Stellung VOR dem aktuellen Zug, falls der Zug schlecht war
		if (currentReview && currentReview.judgement !== 'good' && currentReview.judgement !== 'best') {
			const best = evals[ply - 1]?.best;
			if (best) s.push({ orig: best.slice(0, 2), dest: best.slice(2, 4), brush: 'good' });
		} else if (showBest && evalHere?.best && ply < total - 1) {
			s.push({ orig: evalHere.best.slice(0, 2), dest: evalHere.best.slice(2, 4), brush: 'info' });
		}
		return s;
	});

	const summary = $derived.by(() => {
		const side = (c: 'white' | 'black') => {
			const rs = reviews.filter((r) => r.mover === c);
			return {
				acc: accuracy(rs.map((r) => r.loss)),
				blunder: rs.filter((r) => r.judgement === 'blunder').length,
				mistake: rs.filter((r) => r.judgement === 'mistake').length,
				inaccuracy: rs.filter((r) => r.judgement === 'inaccuracy').length
			};
		};
		return { white: side('white'), black: side('black') };
	});

	// ── Fehler nachspielen: „Finde den besseren Zug“ ──
	const myMistakes = $derived(
		row
			? reviews.filter(
					(r) =>
						r.mover === row!.myColor && (r.judgement === 'mistake' || r.judgement === 'blunder')
				)
			: []
	);
	let retry = $state<{
		idx: number;
		tries: number;
		found: number;
		status: 'try' | 'checking' | 'solved' | 'shown' | 'done';
		fb: MoveFeedback | null;
		played: string;
	} | null>(null);
	let retryV = $state(0);
	const retryItem = $derived(retry && retry.status !== 'done' ? myMistakes[retry.idx] : null);
	const retryFen = $derived(retryItem && game ? game.fenAt(retryItem.ply - 1) : '');
	const retryBest = $derived(retryItem ? (evals[retryItem.ply - 1]?.best ?? '') : '');
	const retryGame = $derived.by(() => {
		void retryV;
		return retryFen ? new Game(retryFen) : null;
	});

	function startRetry() {
		if (!myMistakes.length) return;
		retry = { idx: 0, tries: 0, found: 0, status: 'try', fb: null, played: '' };
		retryV++;
	}

	async function onRetryMove(uci: string) {
		if (!retry || !retryItem || retry.status !== 'try' || !retryFen) return;
		retry.played = uci;
		const original = game!.moves[retryItem.ply - 1].uci;
		if (uci === original) {
			retry.tries++;
			retry.fb = { kind: 'bad', title: t('retry.sameTitle'), text: t('retry.sameText') };
			retryV++;
			return;
		}
		if (uci === retryBest || uci + 'q' === retryBest) return solved(true);
		retry.status = 'checking';
		const fb = await feedbackFor(retryFen, uci);
		if (!retry) return;
		if (fb?.kind === 'playable') return solved(retry.tries === 0);
		retry.tries++;
		retry.fb = fb;
		retry.status = retry.tries >= 2 ? 'shown' : 'try';
		retryV++;
	}

	function solved(firstTry: boolean) {
		if (!retry) return;
		if (firstTry || retry.tries === 0) retry.found++;
		retry.status = 'solved';
		retry.fb = null;
	}

	async function nextRetry() {
		if (!retry) return;
		if (retry.idx + 1 >= myMistakes.length) {
			retry.status = 'done';
			const list = await getSetting<number[]>('reviewedGames', []);
			if (row?.id && !list.includes(row.id)) await setSetting('reviewedGames', [...list, row.id]);
			notifyProgress();
			return;
		}
		retry = {
			idx: retry.idx + 1,
			tries: 0,
			found: retry.found,
			status: 'try',
			fb: null,
			played: ''
		};
		retryV++;
	}

	const retryShapes = $derived.by<Shape[]>(() => {
		if (!retry || !retryItem) return [];
		if ((retry.status === 'shown' || retry.status === 'solved') && retryBest)
			return [{ orig: retryBest.slice(0, 2), dest: retryBest.slice(2, 4), brush: 'good' }];
		return [];
	});

	// aus dem Tagesplan: ?retry=1 startet sofort, sobald die Analyse fertig ist
	$effect(() => {
		if (
			typeof window !== 'undefined' &&
			page.url.searchParams.get('retry') === '1' &&
			!retry &&
			!analysing &&
			progress >= 1 &&
			myMistakes.length
		)
			startRetry();
	});

	const gameId = $derived(
		typeof window !== 'undefined' ? Number(page.url.searchParams.get('game')) || null : null
	);

	onDestroy(() => abort?.abort());

	$effect(() => {
		void gameId;
		load();
	});

	async function load() {
		abort?.abort();
		mistakesCreated = null;
		loading = true;
		if (!gameId) {
			row = null;
			game = null;
			await loadList();
			loading = false;
			return;
		}
		const r = await db.games.get(gameId);
		loading = false;
		if (!r) {
			row = null;
			return;
		}
		row = r;
		game = Game.fromUciMoves(r.moves, r.startFen);
		orientation = r.myColor;
		ply = 0;
		evals = r.analysis?.evals ?? [];
		progress = evals.length / (game.ply + 1);
		if (!r.analysis?.done) runAnalysis();
		else ply = 0;
	}

	async function runAnalysis() {
		if (!row) return;
		analysing = true;
		abort = new AbortController();
		const res = await analyseGame(
			row,
			(done, tot, ev) => {
				progress = done / tot;
				evals = [...ev];
			},
			abort.signal
		);
		evals = res;
		analysing = false;
		const fresh = await db.games.get(row.id!);
		if (fresh?.analysis?.done) {
			row = fresh;
			// Eigene Fehler automatisch als Puzzles anlegen
			mistakesCreated = await createMistakePuzzles(fresh, res);
		}
	}

	function go(p: number) {
		ply = Math.max(0, Math.min(total - 1, p));
	}

	function onKey(e: KeyboardEvent) {
		if (!game || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
		if (e.key === 'ArrowLeft') go(ply - 1);
		else if (e.key === 'ArrowRight') go(ply + 1);
		else if (e.key === 'Home' || e.key === 'ArrowUp') go(0);
		else if (e.key === 'End' || e.key === 'ArrowDown') go(total - 1);
		else if (e.key === ' ') showBest = !showBest;
		else if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
		else return;
		e.preventDefault();
	}

	async function importPgn() {
		pgnError = '';
		try {
			const g = Game.fromPgn(pgnText);
			if (g.ply < 2) throw new Error(t('analysis.tooFew'));
			const headers = Object.fromEntries(
				[...pgnText.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)].map((m) => [m[1], m[2]])
			);
			const id = (await db.games.add({
				date: Date.now(),
				pgn: pgnText.trim(),
				moves: g.moves.map((m) => m.uci),
				startFen: g.startFen,
				result: (['1-0', '0-1', '1/2-1/2'].includes(headers.Result)
					? headers.Result
					: '*') as GameRow['result'],
				myColor: 'white',
				opponent: headers.Black || headers.White || t('analysis.unknown'),
				source: 'pgn'
			})) as number;
			pgnText = '';
			goto(resolve(`/analysis?game=${id}`));
		} catch (e) {
			pgnError = e instanceof Error ? e.message : t('analysis.pgnError');
		}
	}

	async function pasteFromClipboard() {
		try {
			pgnText = await navigator.clipboard.readText();
		} catch {
			pgnError = t('analysis.clipboard');
		}
	}

	function downloadPgn() {
		if (!row || !game) return;
		const blob = new Blob([row.pgn || game.toPgn()], { type: 'application/x-chess-pgn' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `rookie-partie-${row.id}.pgn`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	async function remove(id: number) {
		if (!confirm(t('analysis.deleteConfirm'))) return;
		const row = await db.games.get(id);
		if (row) await addTombstone('games', row.externalId ?? `${row.source}:${row.date}`);
		await db.games.delete(id);
		games = games.filter((g) => g.id !== id);
	}

	function resultFor(g: GameRow): 'win' | 'loss' | 'draw' | 'open' {
		if (g.result === '*') return 'open';
		if (g.result === '1/2-1/2') return 'draw';
		return (g.result === '1-0') === (g.myColor === 'white') ? 'win' : 'loss';
	}
</script>

<svelte:head><title>{t('analysis.eyebrow')} – Rookie</title></svelte:head>
<svelte:window onkeydown={onKey} />

{#if !gameId}
	<PageHeader
		eyebrow={t('analysis.eyebrow')}
		title={t('analysis.title')}
		subtitle={t('analysis.subtitle')}
	/>

	<div class="hub">
		<LinkedAccounts />
		<div class="hub-actions">
			<a class="btn board-btn" href={resolve('/analysis/board')}
				><LayoutGrid size={18} /> {t('board2.open')}</a
			>
		</div>
		<nav class="filters" aria-label={t('analysis.games')}>
			{#each FILTERS as f (f)}
				<button class="chip" class:on={filter === f} onclick={() => setFilter(f)}
					>{t(`analysis.filter.${f}`)}</button
				>
			{/each}
		</nav>
	</div>

	<div class="list-layout">
		<section class="games">
			{#if loading}
				<div class="sk-list" aria-busy="true" aria-label={t('common.loading')}>
					{#each [0, 1, 2] as i (i)}<div class="skeleton" style:height="64px"></div>{/each}
				</div>
			{:else if games.length === 0}
				<div class="card empty">
					<h2>{t('analysis.empty')}</h2>
					<p>{t('analysis.emptyText')}</p>
					<div class="row-btns">
						<a class="btn" href={resolve('/play')}>{t('analysis.playGame')}</a>
						<a class="btn secondary" href={resolve('/import')}
							><CloudDownload size={18} /> {t('analysis.import')}</a
						>
					</div>
				</div>
			{:else}
				{#each games as g (g.id)}
					{@const res = resultFor(g)}
					<div class="game card">
						<a class="game-main" href={resolve(`/analysis?game=${g.id}`)}>
							<span class="res {res}">{t(`analysis.result.${res}`)}</span>
							<span class="g-text">
								<b>{t('analysis.vs', { name: g.opponent })}</b>
								<span>
									{t(`analysis.source.${g.source}`)} · {new Date(g.date).toLocaleDateString(
										intlLocale(),
										{
											day: 'numeric',
											month: 'short',
											year: 'numeric'
										}
									)}
									· {t('common.moves', { n: Math.ceil(g.moves.length / 2) })}
									{#if g.myRating}· {g.myRating}{/if}
								</span>
							</span>
							{#if qualities.get(g.id)}
								{@const q = qualities.get(g.id)!}
								<span class="q">
									<b class:hi={q.accuracy >= 80} class:lo={q.accuracy < 65}>{q.accuracy}%</b>
									{#if q.blunders}<span class="qb">{q.blunders}??</span>{/if}
									{#if q.mistakes}<span class="qm">{q.mistakes}?</span>{/if}
								</span>
							{:else if !g.analysis?.done}
								<span class="q pending">{t('analysis.notYet')}</span>
							{/if}
							<ChevronRight size={18} />
						</a>
						<button class="del" onclick={() => remove(g.id!)} aria-label={t('analysis.deleteGame')}
							><Trash2 size={16} /></button
						>
					</div>
				{/each}
				{#if gameCount > games.length}
					<button class="btn secondary more" onclick={showMore}
						>{t('analysis.showMore', { n: gameCount - games.length })}</button
					>
				{/if}
			{/if}
		</section>

		<aside class="card pgn">
			<h2>{t('analysis.pastePgn')}</h2>
			<p class="muted">{t('analysis.pasteText')}</p>
			<textarea
				bind:value={pgnText}
				rows="7"
				placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 …"
				spellcheck="false"></textarea>
			{#if pgnError}<p class="err">{pgnError}</p>{/if}
			<div class="row-btns">
				<button class="btn" onclick={importPgn} disabled={!pgnText.trim()}
					>{t('analysis.analyse')}</button
				>
				<button class="btn secondary" onclick={pasteFromClipboard}
					><ClipboardPaste size={18} /> {t('analysis.paste')}</button
				>
			</div>
			<a class="link" href={resolve('/import')}
				><CloudDownload size={16} /> {t('analysis.importLink')}</a
			>
		</aside>
	</div>
{:else if !loading && !row}
	<PageHeader title={t('analysis.notFound')} />
	<a class="btn" href={resolve('/analysis')}>{t('analysis.toGames')}</a>
{:else if game && row}
	<div class="top-line">
		<a class="back" href={resolve('/analysis')}><ArrowLeft size={18} /> {t('analysis.games')}</a>
		{#if opening}<span class="opening" title={opening.eco}>{opening.name}</span>{/if}
		<a
			class="btn secondary small to-board"
			href={resolve(`/analysis/board?game=${row.id}&ply=${ply}`)}
			><LayoutGrid size={16} /> {t('board2.fromHere')}</a
		>
	</div>

	<div class="arena">
		<div class="board-col">
			<div class="board-row">
				<EvalBar score={evalHere} {orientation} />
				<div class="board-wrap">
					{#if retryGame && retry && (retry.status === 'try' || retry.status === 'checking')}
						<Board
							fen={retryFen}
							{orientation}
							turnColor={retryGame.turn}
							dests={retry.status === 'try' ? retryGame.dests() : new Map()}
							movableColor={row.myColor}
							shapes={retryShapes}
							isPromotion={(f, to) => retryGame.isPromotion(f as never, to as never)}
							onMove={(u) => void onRetryMove(u)}
							label={t('analysis.board')}
						/>
					{:else if retryItem}
						<Board
							fen={retryFen}
							{orientation}
							viewOnly
							shapes={retryShapes}
							label={t('analysis.board')}
						/>
					{:else}
						<Board {fen} {orientation} {lastMove} viewOnly {shapes} label={t('analysis.board')} />
					{/if}
				</div>
			</div>
			<Dock order={2}>
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
					<button onclick={() => go(total - 1)} aria-label={t('analysis.nav.last')}
						><ChevronsRight size={22} /></button
					>
					<button
						onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')}
						aria-label={t('analysis.nav.flip')}><RefreshCw size={19} /></button
					>
				</div>
			</Dock>
		</div>

		<aside class="side">
			{#if retry}
				<Dock>
					<div class="card retry" role="status">
						{#if retry.status === 'done'}
							<p class="m-title"><Target size={18} /> {t('retry.doneTitle')}</p>
							<p class="m-text">{t('retry.doneText', { n: retry.found, m: myMistakes.length })}</p>
							<div class="row-btns">
								<button class="btn" onclick={() => (retry = null)}>{t('retry.close')}</button>
								<a class="btn secondary" href={resolve('/puzzles?mode=mistakes')}
									><Sparkles size={17} /> {t('analysis.practiceText')}</a
								>
							</div>
						{:else if retryItem}
							{@const mv = game.moves[retryItem.ply - 1]}
							<span class="r-step"
								>{t('retry.step', { i: retry.idx + 1, n: myMistakes.length })}</span
							>
							<p class="m-title">
								{t('retry.prompt', {
									move: `${Math.ceil(retryItem.ply / 2)}${retryItem.ply % 2 === 1 ? '.' : '…'} ${figurine(mv.san)}`
								})}
							</p>
							{#if retry.status === 'checking'}
								<p class="muted">{t('course.checking')}</p>
							{:else if retry.status === 'solved'}
								<p class="ok">{t('retry.solved')}</p>
								{#if retryItem.explanation}<p class="m-text">
										<b>{retryItem.explanation.title}:</b>
										{retryItem.explanation.text}
									</p>{/if}
								<button class="btn" onclick={() => void nextRetry()}>{t('common.next')}</button>
							{:else if retry.status === 'shown'}
								{#if retry.fb}<p class="bad"><b>{retry.fb.title}</b> {retry.fb.text}</p>{/if}
								<p class="m-text">
									<Lightbulb size={15} />
									{t('retry.best', { san: figurine(sanForUci(retryFen, retryBest)) })}
								</p>
								{#if retryItem.explanation}<p class="m-text muted">
										{retryItem.explanation.text}
									</p>{/if}
								<button class="btn" onclick={() => void nextRetry()}>{t('common.next')}</button>
							{:else}
								<p class="muted">{t('retry.hint')}</p>
								{#if retry.fb}<p class="bad"><b>{retry.fb.title}</b> {retry.fb.text}</p>{/if}
							{/if}
							<button class="link-btn" onclick={() => (retry = null)}>{t('retry.close')}</button>
						{/if}
					</div>
				</Dock>
			{:else if myMistakes.length && progress >= 1 && !analysing}
				<button class="card retry-cta" onclick={startRetry}>
					<span class="rc-ico"><Target size={20} /></span>
					<span
						><b>{t('retry.cta', { n: myMistakes.length })}</b>
						{t('retry.ctaText')}</span
					>
					<ChevronRight size={18} />
				</button>
			{/if}

			{#if analysing || progress < 1}
				<div class="card progress">
					<div class="p-head">
						<span>{t('analysis.running')}</span>
						<b>{Math.round(progress * 100)} %</b>
					</div>
					<div class="p-track"><div class="p-fill" style:width="{progress * 100}%"></div></div>
					{#if !analysing}
						<button class="btn small" onclick={runAnalysis}>{t('analysis.resume')}</button>
					{/if}
				</div>
			{/if}

			{#if evals.length > 1}
				<div class="card graph-card">
					<EvalGraph {evals} {total} current={ply} {reviews} myColor={row.myColor} onSelect={go} />
				</div>
			{/if}

			{#if !retry && ply > 0 && currentReview}
				{@const mvc = game.moves[ply - 1]}
				<Dock order={1} mobileOnly>
					<div class="mini-move">
						<div class="mm-head">
							<b>{Math.ceil(ply / 2)}{ply % 2 === 1 ? '.' : '…'} {figurine(mvc.san)}</b>
							<span class="badge {currentReview.judgement}"
								>{judgementLabel(currentReview.judgement)}</span
							>
							{#if evalHere}<span class="m-eval">{formatScore(evalHere)}</span>{/if}
						</div>
						<p class="mm-text">
							{#if currentReview.explanation}<b>{currentReview.explanation.title}:</b>
								{currentReview.explanation.text}
							{:else if currentReview.judgement === 'best'}{t('analysis.best')}
							{:else}{t('analysis.solid')}{/if}
							{#if evalHere?.best && ply < total - 1}
								<span class="mm-best"
									>{t('analysis.bestHere')} <b>{figurine(sanForUci(fen, evalHere.best))}</b></span
								>
							{/if}
						</p>
					</div>
				</Dock>
			{/if}
			<div class="card move-card" class:has={!!currentReview}>
				{#if ply === 0}
					<p class="m-title">{t('analysis.start')}</p>
					<p class="muted">{t('analysis.startText')}</p>
				{:else if currentReview}
					{@const mv = game.moves[ply - 1]}
					<div class="m-head">
						<span class="m-move"
							>{Math.ceil(ply / 2)}{ply % 2 === 1 ? '.' : '…'} {figurine(mv.san)}</span
						>
						<span class="badge {currentReview.judgement}"
							>{judgementLabel(currentReview.judgement)}</span
						>
						{#if evalHere}<span class="m-eval">{formatScore(evalHere)}</span>{/if}
					</div>
					{#if currentReview.mover !== row.myColor && currentReview.explanation}
						<p class="who">{t('analysis.opponentMove', { name: row.opponent })}</p>
					{/if}
					{#if currentReview.explanation}
						<p class="m-title">{currentReview.explanation.title}</p>
						<p class="m-text">{currentReview.explanation.text}</p>
					{:else if currentReview.judgement === 'best'}
						<p class="m-text">{t('analysis.best')}</p>
					{:else}
						<p class="m-text">{t('analysis.solid')}</p>
					{/if}
				{:else}
					<p class="muted">{t('analysis.running')}</p>
				{/if}
				{#if evalHere?.best && ply < total - 1}
					<p class="m-next">
						{t('analysis.bestHere')} <b>{figurine(sanForUci(fen, evalHere.best))}</b>
					</p>
				{/if}
			</div>

			{#if reviews.length && !analysing}
				<div class="card summary">
					{#each [['white', 'common.white'], ['black', 'common.black']] as [c, label] (c)}
						{@const s = summary[c as 'white' | 'black']}
						<div class="sum-row" class:me={row.myColor === c}>
							<span class="sum-name">{row.myColor === c ? t('common.you') : t(label)}</span>
							<span class="acc">{s.acc}<small>%</small></span>
							<span class="cnt b" title={t('analysis.legend.blunder')}>{s.blunder}</span>
							<span class="cnt m" title={t('analysis.legend.mistake')}>{s.mistake}</span>
							<span class="cnt i" title={t('analysis.legend.inaccuracy')}>{s.inaccuracy}</span>
						</div>
					{/each}
					<div class="legend">
						<span class="b">??</span>
						{t('analysis.legend.blunder')} <span class="m">?</span>
						{t('analysis.legend.mistake')}
						<span class="i">?!</span>
						{t('analysis.legend.inaccuracy')}
					</div>
				</div>
			{/if}

			{#if mistakesCreated}
				<a class="card practice" href={resolve('/puzzles?mode=mistakes')}>
					<Sparkles size={20} />
					<span
						><b>{t('analysis.practice', { n: mistakesCreated })}</b>
						{t('analysis.practiceText')}</span
					>
					<ChevronRight size={18} />
				</a>
			{/if}

			<div class="card moves-card">
				<MoveList moves={game.moves} current={ply} {marks} onSelect={go} />
			</div>

			<button class="link" onclick={downloadPgn}
				><Download size={16} /> {t('analysis.downloadPgn')}</button
			>
		</aside>
	</div>
{/if}

<style>
	.muted {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	/* reserviert Platz, solange die Partien aus IndexedDB laden (kein Layout-Sprung) */
	.games {
		min-height: 13rem;
	}

	.hub {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 1100px;
		margin-bottom: 1rem;
	}

	.hub-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.filters {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding-bottom: 2px;
	}

	.filters::-webkit-scrollbar {
		display: none;
	}

	.chip {
		flex: none;
		height: 34px;
		padding: 0 0.85rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--text-2);
		font: inherit;
		font-size: 0.86rem;
		font-weight: 650;
		cursor: pointer;
	}

	.chip.on {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
	}

	.q {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
	}

	.q b {
		font-size: 0.98rem;
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
	}

	.q b.hi {
		color: var(--good);
	}

	.q b.lo {
		color: var(--bad);
	}

	.qb {
		color: var(--bad);
		font-weight: 700;
	}

	.qm {
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
		font-weight: 700;
	}

	.q.pending {
		color: var(--text-3);
	}

	.more {
		align-self: center;
		margin-top: 0.5rem;
	}

	.sk-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* reserviert Platz, solange die Partien aus IndexedDB laden (kein Layout-Sprung) */
	.games {
		min-height: 13rem;
	}

	.list-layout {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	@media (min-width: 1000px) {
		.list-layout {
			grid-template-columns: 1fr 340px;
			align-items: start;
		}
	}

	.games {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.game {
		display: flex;
		align-items: center;
		padding-right: 0.4rem;
	}

	.game-main {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.8rem 0.4rem 0.8rem 1rem;
		min-width: 0;
	}

	.g-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.g-text span {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.res {
		flex: none;
		width: 92px;
		text-align: center;
		font-size: 0.78rem;
		font-weight: 700;
		padding: 0.3rem 0;
		border-radius: 999px;
	}

	.res.win {
		background: color-mix(in srgb, var(--good) 15%, transparent);
		color: var(--good);
	}
	.res.loss {
		background: color-mix(in srgb, var(--bad) 13%, transparent);
		color: var(--bad);
	}
	.res.draw,
	.res.open {
		background: var(--surface-2);
		color: var(--text-2);
	}

	.del {
		border: none;
		background: none;
		color: var(--text-3);
		padding: 0.5rem;
		border-radius: 10px;
		cursor: pointer;
	}

	.del:hover {
		color: var(--bad);
		background: color-mix(in srgb, var(--bad) 10%, transparent);
	}

	.empty,
	.pgn {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.25rem;
	}

	.empty h2,
	.pgn h2 {
		font-size: 1.2rem;
	}

	textarea {
		font: inherit;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: 0.75rem;
		border-radius: 12px;
		border: 1px solid var(--line-strong);
		background: var(--surface-2);
		color: var(--text);
		resize: vertical;
	}

	.err {
		color: var(--bad);
		font-size: 0.88rem;
	}

	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.88rem;
		font-weight: 560;
		color: var(--text-2);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.link:hover {
		color: var(--accent);
	}

	/* Einzelansicht */
	.retry {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem;
		border: 1.5px solid color-mix(in srgb, var(--c-puzzle) 40%, transparent);
	}

	.retry .m-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.r-step {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-puzzle);
	}

	.retry .ok {
		font-weight: 700;
		color: var(--good);
	}

	.retry .bad {
		font-size: 0.92rem;
		line-height: 1.45;
		color: var(--text);
		padding: 0.6rem 0.75rem;
		border-radius: 12px;
		background: color-mix(in srgb, var(--bad) 9%, transparent);
	}

	.link-btn {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--text-2);
		cursor: pointer;
	}

	.retry-cta {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
		border: 1.5px solid color-mix(in srgb, var(--c-puzzle) 40%, transparent);
		text-align: left;
		font: inherit;
		color: var(--text-2);
		cursor: pointer;
	}

	.retry-cta b {
		display: block;
		color: var(--text);
	}

	.rc-ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 12px;
		background: var(--c-puzzle);
		color: #fff;
	}

	.top-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.75rem;
		max-width: 1100px;
	}

	.back {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
		color: var(--text-2);
	}

	.opening {
		flex: 0 1 auto;
		min-width: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--c-learn);
		background: var(--c-learn-soft);
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.to-board {
		flex: none;
		margin-left: auto;
		white-space: nowrap;
	}

	.arena {
		display: grid;
		gap: 1rem;
		max-width: 1100px;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}

	.board-col {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		max-width: min(660px, calc(100dvh - 200px));
		margin: 0 auto;
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
	}

	.nav button {
		display: grid;
		place-items: center;
		height: 44px;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		box-shadow: var(--shadow-1);
		color: var(--text);
		cursor: pointer;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.nav button:active {
		transform: scale(0.94);
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.progress {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.9rem 1rem;
	}

	.p-head {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.p-track {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.p-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--c-analysis), var(--accent));
		border-radius: inherit;
		transition: width 300ms var(--ease-out);
	}

	.btn.small {
		min-height: 34px;
		font-size: 0.85rem;
		align-self: flex-start;
	}

	.graph-card {
		padding: 0.5rem;
	}

	.move-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem;
		min-height: 120px;
	}

	.m-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.m-move {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
	}

	.m-eval {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.18rem 0.55rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
	}

	.badge.blunder {
		background: var(--bad);
		color: #fff;
	}
	.badge.mistake {
		background: #e07a1f;
		color: #fff;
	}
	.badge.inaccuracy {
		background: color-mix(in srgb, var(--warn) 25%, transparent);
		color: color-mix(in srgb, var(--warn) 45%, var(--text));
	}
	.badge.best {
		background: color-mix(in srgb, var(--good) 15%, transparent);
		color: var(--good);
	}

	.who {
		font-size: 0.78rem;
		font-weight: 650;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.m-title {
		font-weight: 700;
		font-size: 1.02rem;
	}

	.m-text {
		color: var(--text-2);
		line-height: 1.5;
	}

	.m-next {
		margin-top: auto;
		padding-top: 0.4rem;
		font-size: 0.88rem;
		color: var(--text-3);
	}

	.summary {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.sum-row {
		display: grid;
		grid-template-columns: 1fr auto 28px 28px 28px;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.92rem;
	}

	.sum-row.me .sum-name {
		font-weight: 700;
	}

	.acc {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
		margin-right: 0.4rem;
	}

	.acc small {
		font-size: 0.7em;
		color: var(--text-3);
	}

	.cnt {
		text-align: center;
		font-weight: 700;
		border-radius: 8px;
		padding: 0.1rem 0;
	}

	.cnt.b,
	.legend .b {
		color: var(--bad);
	}
	.cnt.m,
	.legend .m {
		color: #e07a1f;
	}
	.cnt.i,
	.legend .i {
		color: var(--warn);
	}

	.legend {
		font-size: 0.75rem;
		color: var(--text-3);
		text-align: right;
	}

	.legend span {
		font-weight: 800;
		margin-left: 0.4rem;
	}

	.practice {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.85rem 1rem;
		background: var(--c-puzzle-soft);
		color: var(--c-puzzle);
		border-color: transparent;
		font-size: 0.92rem;
	}

	.practice span {
		flex: 1;
	}

	.mini-move {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.1rem 0.25rem;
	}

	.mm-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mm-head b {
		font-family: var(--font-display);
		font-size: 1.05rem;
	}

	.mm-text {
		font-size: 0.86rem;
		line-height: 1.4;
		color: var(--text-2);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.mm-text b {
		color: var(--text);
	}

	.mm-best {
		display: block;
		margin-top: 0.15rem;
	}

	:global(.docked) .nav {
		margin: 0;
	}

	:global(.docked) .retry {
		box-shadow: none;
		border: none;
		background: none;
		padding: 0.2rem 0.3rem;
	}

	.moves-card {
		padding: 0.5rem;
		max-height: 260px;
		display: flex;
		flex-direction: column;
	}
	/* Handy: Brett so groß, dass es neben der Aktionsleiste ganz sichtbar bleibt */
	@media (max-width: 767px) {
		.board-col {
			max-width: min(
				100%,
				calc(100dvh - var(--dock-h) - var(--tabbar-h) - var(--safe-bottom) - var(--safe-top) - 80px)
			);
		}
	}
</style>
