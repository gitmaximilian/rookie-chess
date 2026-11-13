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
	import GameListItem from '#lib/ui/GameListItem.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import BentoGrid from '#lib/ui/bento/BentoGrid.svelte';
	import StatTile from '#lib/ui/bento/StatTile.svelte';
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
	import { accuracy, type PlyEval } from '#lib/analysis/classify.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';
	import { outcomeOf } from '#lib/training/gamestats.js';
	import { toWhite } from '#lib/engine/uci.js';
	import { engine } from '#lib/engine/engine.js';
	import { positionFromFen, turnFromFen } from '#lib/chess/game.js';
	import ReviewPanel, { type LiveLine } from '#lib/ui/ReviewPanel.svelte';
	import {
		KINDS,
		KIND_GLYPH,
		KIND_ICON,
		kindColor,
		isBad,
		commentFor,
		verdict,
		sanMoves,
		type Kind
	} from '#lib/analysis/kinds.js';
	import { openingFor, onOpeningsLoaded } from '#lib/data/openings.js';
	import { feedbackFor, type MoveFeedback } from '#lib/openings/feedback.js';
	import { getSetting, setSetting } from '#lib/db/db.js';
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
	let mistakeCount = $state(0);
	onMount(async () => (mistakeCount = await db.mistakes.count()));

	type Filter = 'all' | 'lichess' | 'chesscom' | 'bot' | 'friend' | 'mistakes';
	let filter = $state<Filter>('all');
	const FILTERS: Filter[] = ['all', 'lichess', 'chesscom', 'bot', 'friend', 'mistakes'];

	// ── Übersicht im Stil einer Trainings-App: Form, Höhepunkte, Partien nach Tagen ──
	const form = $derived(
		filter === 'all'
			? games
					.slice(0, 10)
					.map((g) => ({ id: g.id!, o: outcomeOf(g) }))
					.filter((x) => x.o !== null)
					.reverse()
			: []
	);

	const formScore = $derived(
		form.length
			? Math.round(
					((form.filter((x) => x.o === 'w').length + form.filter((x) => x.o === 'd').length / 2) /
						form.length) *
						100
				)
			: 0
	);

	function dayLabel(ms: number): string {
		const d = new Date(ms);
		const now = new Date();
		const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
		if (diff === 0) return t('analysis.today');
		if (diff === 1) return t('analysis.yesterday');
		return d.toLocaleDateString(intlLocale(), {
			day: 'numeric',
			month: 'short',
			...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
		});
	}

	const groups = $derived.by(() => {
		const out: { key: string; label: string; games: GameRow[]; w: number; d: number; l: number }[] =
			[];
		for (const g of games) {
			const d = new Date(g.date);
			const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
			let grp = out.at(-1);
			if (!grp || grp.key !== key) {
				grp = { key, label: dayLabel(g.date), games: [], w: 0, d: 0, l: 0 };
				out.push(grp);
			}
			grp.games.push(g);
			const o = outcomeOf(g);
			if (o) grp[o]++;
		}
		return out;
	});

	function openingName(g: GameRow): string | null {
		void openingsReady;
		return openingFor(g.moves)?.name ?? null;
	}

	/** Brillante Züge in den letzten analysierten Partien – als Höhepunkt oben */
	let brilliant = $state<{ n: number; gameId: number } | null>(null);
	async function findBrilliant() {
		const recent = (await db.games.orderBy('date').reverse().limit(60).toArray()).filter(
			(g) => g.analysis?.done
		);
		let n = 0;
		let first: number | null = null;
		for (const g of recent.slice(0, 30)) {
			const r = reviewMoves(g, g.analysis!.evals as PlyEval[]).filter(
				(x) => x.mover === g.myColor && x.kind === 'brilliant'
			).length;
			if (r && first === null) first = g.id!;
			n += r;
		}
		brilliant = n && first !== null ? { n, gameId: first } : null;
	}
	onMount(() => void findBrilliant());

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

	let openingsReady = $state(0);
	onMount(() => onOpeningsLoaded(() => openingsReady++));
	const total = $derived(game ? game.ply + 1 : 0);
	const reviews = $derived.by<MoveReview[]>(() => {
		void openingsReady;
		return row && evals.length > 1 ? reviewMoves(row, evals) : [];
	});
	const tags = $derived(
		Object.fromEntries(
			reviews
				.filter((r) => r.kind !== 'good' && r.kind !== 'excellent' && r.kind !== 'book')
				.map((r) => [r.ply, { glyph: KIND_GLYPH[r.kind] || '★', color: kindColor(r.kind) }])
		)
	);
	const fen = $derived(game ? game.fenAt(ply) : '');
	const lastMove = $derived.by(() => {
		if (!game || ply === 0) return undefined;
		const m = game.moves[ply - 1];
		return [m.from, m.to] as [string, string];
	});
	const currentReview = $derived(reviews.find((r) => r.ply === ply) ?? null);
	const evalHere = $derived(evals[ply] ?? null);
	const opening = $derived.by(() => {
		void openingsReady;
		if (!game) return null;
		return openingFor(game.moves.slice(0, Math.max(ply, Math.min(game.ply, 12))).map((m) => m.uci));
	});

	// ── Live-Engine: die drei besten Fortsetzungen der gezeigten Stellung ──
	let live = $state<{ fen: string; lines: LiveLine[]; depth: number; done: boolean } | null>(null);
	let selectedLine = $state<number | null>(null);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- reiner Cache, soll nichts neu zeichnen
	const liveCache = new Map<string, { lines: LiveLine[]; depth: number }>();
	let liveAbort: AbortController | null = null;
	const liveDepth = /iPhone|iPad|Android/.test(globalThis.navigator?.userAgent ?? '') ? 13 : 16;

	function toLines(f: string, raw: { cp?: number; mate?: number; pv: string[] }[]): LiveLine[] {
		const turn = turnFromFen(f);
		return raw
			.filter((l) => l.pv.length)
			.slice(0, 3)
			.map((l) => ({
				score: toWhite({ cp: l.cp, mate: l.mate }, turn),
				uci: l.pv.slice(0, 8),
				san: sanMoves(f, l.pv, 6)
			}));
	}

	$effect(() => {
		const f = fen;
		selectedLine = null;
		liveAbort?.abort();
		if (!f || !game || retry) return;
		const cached = liveCache.get(f);
		if (cached) {
			live = { fen: f, ...cached, done: true };
			return;
		}
		// sofort zeigen, was die Partie-Analyse schon weiß; die Engine verfeinert gleich
		const stored = evals[ply];
		live = {
			fen: f,
			lines: stored?.pv?.length ? toLines(f, [{ ...stored, pv: stored.pv }]) : [],
			depth: 0,
			done: false
		};
		if (positionFromFen(f).isEnd()) {
			live = { fen: f, lines: [], depth: 0, done: true };
			return;
		}
		const ac = new AbortController();
		liveAbort = ac;
		// kurz warten: beim schnellen Durchklicken nicht jede Stellung rechnen
		const timer = setTimeout(async () => {
			const res = await engine.analyse({
				fen: f,
				depth: liveDepth,
				multipv: 3,
				signal: ac.signal,
				onInfo: (ls) => {
					if (ac.signal.aborted || ls.length < 1) return;
					live = { fen: f, lines: toLines(f, ls), depth: ls[0].depth, done: false };
				}
			});
			if (ac.signal.aborted || !res.lines.length) return;
			const done = { lines: toLines(f, res.lines), depth: res.lines[0].depth };
			liveCache.set(f, done);
			live = { fen: f, ...done, done: true };
		}, 180);
		return () => {
			clearTimeout(timer);
			ac.abort();
		};
	});

	const liveLines = $derived(live && live.fen === fen ? live.lines : []);

	const shapes = $derived.by<Shape[]>(() => {
		const s: Shape[] = [];
		if (!game) return s;
		// gewählte Variante: die ersten drei Züge als Pfeile
		if (selectedLine !== null && liveLines[selectedLine]) {
			const l = liveLines[selectedLine];
			l.uci.slice(0, 3).forEach((u, i) =>
				s.push({
					orig: u.slice(0, 2),
					dest: u.slice(2, 4),
					brush: i === 0 ? 'good' : i === 1 ? 'paleBlue' : 'paleGrey',
					label: String(i + 1)
				})
			);
			return s;
		}
		// schlechter Zug: was stattdessen richtig gewesen wäre
		if (currentReview && isBad(currentReview.kind)) {
			const best = evals[ply - 1]?.best;
			if (best) s.push({ orig: best.slice(0, 2), dest: best.slice(2, 4), brush: 'good' });
			return s;
		}
		if (!showBest || ply >= total - 1) return s;
		// sonst: die besten Züge von hier – stärkster kräftig, die anderen blass
		liveLines.slice(0, 3).forEach((l, i) => {
			const u = l.uci[0];
			if (!u || s.some((x) => x.orig === u.slice(0, 2) && x.dest === u.slice(2, 4))) return;
			s.push({
				orig: u.slice(0, 2),
				dest: u.slice(2, 4),
				brush: i === 0 ? 'info' : 'paleBlue'
			});
		});
		return s;
	});

	/** Zugart-Abzeichen auf dem Zielfeld des gerade gezeigten Zugs */
	const badge = $derived.by(() => {
		if (!game || !currentReview || ply === 0) return null;
		const k = currentReview.kind;
		return {
			square: game.moves[ply - 1].to,
			text: KIND_GLYPH[k],
			icon: KIND_ICON[k],
			color: kindColor(k),
			label: t(`review.kind.${k}`)
		};
	});

	const comment = $derived.by(() => {
		if (!game || !row) return null;
		if (ply === 0) return { headline: t('review.start'), text: t('review.startText') };
		if (!currentReview) return null;
		return commentFor({
			fenBefore: game.fenAt(ply - 1),
			played: game.moves[ply - 1].uci,
			kind: currentReview.kind,
			ply,
			before: evals[ply - 1] ?? {},
			explanation: currentReview.explanation,
			opening: currentReview.kind === 'book' ? openingAt(ply) : null,
			mine: currentReview.mover === row.myColor,
			after: evals[ply] ?? undefined
		});
	});

	/** Name der Eröffnung genau bis zu diesem Zug */
	function openingAt(p: number): string | null {
		void openingsReady;
		if (!game) return null;
		return openingFor(game.moves.slice(0, p).map((m) => m.uci))?.name ?? null;
	}

	const mated = $derived(!!fen && positionFromFen(fen).isCheckmate());

	/** „12.“ bzw. „12…“ für den ersten Zug der Varianten */
	const linesMoveNo = $derived.by(() => {
		if (!fen) return '';
		const parts = fen.split(' ');
		const no = Number(parts[5] ?? 1);
		return parts[1] === 'w' ? `${no}.` : `${no}…`;
	});

	/** Zugarten je Seite – für die Besprechung oben */
	const kindCounts = $derived.by(() => {
		const c = {
			white: Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>,
			black: Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>
		};
		for (const r of reviews) c[r.mover][r.kind]++;
		return c;
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
			// Tagesplan: „Aus deiner letzten Partie lernen“ gilt damit als erledigt
			const list = await getSetting<number[]>('reviewedGames', []);
			if (row?.id && !list.includes(row.id)) await setSetting('reviewedGames', [...list, row.id]);
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
		else if (e.key === 'n') goNextMistake();
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
		if (gameId) await goto(resolve('/analysis'));
	}

	/** nächster eigener Fehler nach dem aktuellen Zug (danach wieder von vorn) */
	const nextMistake = $derived(myMistakes.find((r) => r.ply > ply) ?? myMistakes[0] ?? null);
	function goNextMistake() {
		if (nextMistake) go(nextMistake.ply);
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
		<!-- ohne Partien ist das Verknüpfen der erste Schritt, sonst erst nach den Kennzahlen -->
		{#if !loading && gameCount === 0}<LinkedAccounts />{/if}
		{#if form.length >= 3 || brilliant || mistakeCount > 0}
			<BentoGrid label={t('analysis.title')} testid="games-bento">
				{#if form.length >= 3}
					<StatTile
						tone="games"
						size="m"
						label={t('summary.form')}
						value={formScore}
						unit="%"
						sub={t('summary.formLast', { n: form.length })}
					>
						<div
							class="form-strip"
							role="img"
							aria-label={t('analysis.formAria', { n: form.length })}
						>
							{#each form as x, i (x.id)}
								<a
									class="fs {x.o}"
									class:newest={i === form.length - 1}
									href={resolve(`/analysis?game=${x.id}`)}
									aria-label={t(
										`analysis.result.${x.o === 'w' ? 'win' : x.o === 'l' ? 'loss' : 'draw'}`
									)}
								></a>
							{/each}
						</div>
					</StatTile>
				{/if}
				{#if brilliant}
					<StatTile
						tone="coach"
						size={mistakeCount > 0 ? 's' : 'm'}
						label={t('analysis.brilliantLabel')}
						value={brilliant.n}
						sub={t('analysis.brilliantMoves', { n: brilliant.n })}
						href={resolve(`/analysis?game=${brilliant.gameId}`)}
					/>
				{/if}
				{#if mistakeCount > 0}
					<StatTile
						tone="play"
						size={brilliant ? 's' : 'm'}
						label={t('analysis.practiceLabel')}
						value={mistakeCount}
						sub={t('analysis.hubPracticeText')}
						href={resolve('/puzzles?mode=mistakes')}
						aria={t('analysis.hubPractice', { n: mistakeCount })}
					/>
				{/if}
			</BentoGrid>
		{/if}
		{#if !loading && gameCount > 0}<LinkedAccounts collapsed />{/if}
		{#if loading || gameCount > 0 || filter !== 'all'}
			<div class="hub-actions">
				<a class="btn secondary board-btn" href={resolve('/analysis/board')}
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
		{/if}
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
						<a class="btn secondary" href={resolve('/analysis/board')}
							><LayoutGrid size={18} /> {t('board2.open')}</a
						>
					</div>
				</div>
			{:else}
				{#each groups as grp (grp.key)}
					<div class="day">
						<h3>{grp.label}</h3>
						<span class="day-score"
							>{#if grp.w}{grp.w}{t('stats.hist.wShort')}{/if}
							{#if grp.l}{grp.l}{t('stats.hist.lShort')}{/if}
							{#if grp.d}{grp.d}{t('stats.hist.dShort')}{/if}</span
						>
					</div>
					<ul class="game-list">
						{#each grp.games as g (g.id)}
							<li><GameListItem game={g} detailed opening={openingName(g)} /></li>
						{/each}
					</ul>
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
						<Board
							{fen}
							{orientation}
							{lastMove}
							viewOnly
							{shapes}
							{badge}
							tint={badge?.color ?? null}
							label={t('analysis.board')}
						/>
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
					{#if myMistakes.length && !retry}
						<button
							class="to-mistake"
							onclick={goNextMistake}
							aria-label={t('analysis.nav.nextMistake', { n: myMistakes.length })}
							title={t('analysis.nav.nextMistake', { n: myMistakes.length })}
							><Target size={19} /><span class="tm-n">{myMistakes.length}</span></button
						>
					{/if}
				</div>
			</Dock>
		</div>

		<aside class="side">
			{#if !retry && comment}
				<ReviewPanel
					kind={ply > 0 ? (currentReview?.kind ?? null) : null}
					headline={comment.headline}
					text={comment.text}
					who={ply > 0 && currentReview
						? currentReview.mover === row.myColor
							? t('review.yourMove')
							: t('review.opponentMove', { name: row.opponent })
						: undefined}
					verdict={mated ? t('review.verdict.mated') : verdict(evalHere)}
					score={mated ? null : evalHere}
					lines={liveLines}
					thinking={!!live && !live.done}
					depth={live?.depth}
					selected={selectedLine}
					onselect={(i) => (selectedLine = i)}
					moveNo={linesMoveNo}
				/>
			{:else if !retry && analysing}
				<div class="card rp-wait">
					<p class="muted">{t('analysis.running')}</p>
				</div>
			{/if}
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

			{#if reviews.length && !analysing}
				<div class="card summary">
					<div class="sum-head">
						<span></span>
						{#each [['white', 'common.white'], ['black', 'common.black']] as [c, label] (c)}
							<span class="sum-col" class:me={row.myColor === c}
								>{row.myColor === c ? t('common.you') : t(label)}</span
							>
						{/each}
					</div>
					<div class="sum-acc">
						<span>{t('review.accuracy')}</span>
						{#each ['white', 'black'] as const as c (c)}
							<b class:me={row.myColor === c}>{summary[c].acc}<small>%</small></b>
						{/each}
					</div>
					{#each KINDS as k (k)}
						{#if kindCounts.white[k] + kindCounts.black[k] > 0}
							{@const KI = KIND_ICON[k]}
							<div class="sum-kind" style:--k={kindColor(k)}>
								<span class="sk-name"
									><span class="sk-ico"
										>{#if KI}<KI size={12} strokeWidth={3} />{:else}{KIND_GLYPH[k]}{/if}</span
									>{t(`review.kind.${k}`)}</span
								>
								<span class="sk-n" class:zero={!kindCounts.white[k]}>{kindCounts.white[k]}</span>
								<span class="sk-n" class:zero={!kindCounts.black[k]}>{kindCounts.black[k]}</span>
							</div>
						{/if}
					{/each}
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
				<MoveList moves={game.moves} current={ply} {tags} onSelect={go} />
			</div>

			<div class="foot-links">
				<button class="link" onclick={downloadPgn}
					><Download size={16} /> {t('analysis.downloadPgn')}</button
				>
				<button class="link danger" onclick={() => remove(row!.id!)}
					><Trash2 size={16} /> {t('analysis.deleteGame')}</button
				>
			</div>
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

	.form-strip {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 4px;
		margin: 0.6rem 0 0.35rem;
	}

	.fs {
		height: 26px;
		border-radius: 7px;
		background: color-mix(in srgb, var(--tile-text) 22%, transparent);
	}

	.fs.w {
		background: var(--good);
	}

	.fs.l {
		background: color-mix(in srgb, var(--bad) 80%, var(--surface));
	}

	.fs.newest {
		box-shadow: inset 0 0 0 2px var(--tile-text);
	}

	.day {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin: 0.7rem 0.2rem 0.1rem;
	}

	.day:first-child {
		margin-top: 0;
	}

	.day h3 {
		font-family: var(--font-num);
		font-size: 0.74rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-2);
	}

	.day-score {
		font-family: var(--font-num);
		font-size: 0.8rem;
		color: var(--text-3);
		word-spacing: 0.2rem;
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
		/* minmax(0, …): lange Eröffnungsnamen dürfen die Spalte nicht aufblähen */
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		max-width: 1100px;
	}

	@media (min-width: 1000px) {
		.list-layout {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}

	.games {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.game-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
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
		color: var(--good-text);
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
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 0.4rem;
	}

	.nav .to-mistake {
		gap: 0.25rem;
		grid-auto-flow: column;
		background: color-mix(in srgb, var(--bad) 14%, var(--surface));
		color: var(--bad-text);
		font-weight: 750;
		font-size: 0.9rem;
	}

	.foot-links {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.foot-links .danger {
		color: var(--text-3);
	}

	@media (hover: hover) {
		.foot-links .danger:hover {
			color: var(--bad-text);
		}
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

	.m-title {
		font-weight: 700;
		font-size: 1.02rem;
	}

	.m-text {
		color: var(--text-2);
		line-height: 1.5;
	}

	.summary {
		padding: 0.8rem 1rem 0.7rem;
		display: grid;
		grid-template-columns: 1fr 4.2rem 4.2rem;
		row-gap: 0.15rem;
		font-size: 0.9rem;
	}

	.sum-head,
	.sum-acc,
	.sum-kind {
		display: contents;
	}

	.sum-col {
		text-align: center;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.sum-col.me {
		color: var(--text);
	}

	.sum-acc > span {
		align-self: center;
		font-weight: 650;
		padding: 0.3rem 0;
	}

	.sum-acc b {
		text-align: center;
		font-family: var(--font-num);
		font-size: 1.35rem;
		font-weight: 500;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.sum-acc b.me {
		color: var(--text);
	}

	.sum-acc small {
		font-size: 0.65em;
		color: var(--text-3);
	}

	.sk-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.22rem 0;
		color: var(--text-2);
	}

	.sk-ico {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--k);
		color: #fff;
		font-family: var(--font-display);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: -0.04em;
	}

	.sk-n {
		align-self: center;
		text-align: center;
		font-family: var(--font-num);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: color-mix(in srgb, var(--k) 75%, var(--text));
	}

	.sk-n.zero {
		color: var(--text-3);
		font-weight: 500;
	}

	.rp-wait {
		padding: 1rem;
		min-height: 9rem;
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
				calc(100dvh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 80px)
			);
		}
	}
</style>
