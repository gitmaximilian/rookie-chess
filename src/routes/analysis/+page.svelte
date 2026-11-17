<script lang="ts">
	import Dock from '#lib/ui/Dock.svelte';
	import { onDestroy, onMount, tick } from 'svelte';
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
	import Plus from '@lucide/svelte/icons/plus';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import CommentBar from '#lib/ui/CommentBar.svelte';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Board, { type Shape } from '#lib/ui/board/Board.svelte';
	import EvalBar from '#lib/ui/EvalBar.svelte';
	import EvalGraph from '#lib/ui/EvalGraph.svelte';
	import MoveList from '#lib/ui/MoveList.svelte';
	import { db, addTombstone, type GameRow } from '#lib/db/db.js';
	import { review } from '#lib/training/srs.js';
	import { Game, sanForUci } from '#lib/chess/game.js';
	import { sound } from '#lib/ui/sound.js';
	import { figurine } from '#lib/chess/notation.js';
	import {
		analyseGame,
		reviewMoves,
		createMistakePuzzles,
		type MoveReview
	} from '#lib/analysis/run.js';
	import { accuracy, whiteWin, type PlyEval } from '#lib/analysis/classify.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';
	import { outcomeOf } from '#lib/training/gamestats.js';
	import { toWhite, type Score } from '#lib/engine/uci.js';
	import { engine } from '#lib/engine/engine.js';
	import { positionFromFen, turnFromFen } from '#lib/chess/game.js';
	import ReviewPanel, { type LiveLine } from '#lib/ui/ReviewPanel.svelte';
	import GameReport from '#lib/ui/GameReport.svelte';
	import { gameReport } from '#lib/analysis/report.js';
	import DailyTaskProgress from '#lib/ui/DailyTaskProgress.svelte';
	import SelfReview from '#lib/ui/SelfReview.svelte';
	import type { SelfReviewResult, SelfReviewScore } from '#lib/analysis/selfreview.js';
	import { resetDockReserve } from '#lib/ui/dock.js';
	import { currentStrength } from '#lib/training/planData.js';
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
	import X from '@lucide/svelte/icons/x';
	import Eye from '@lucide/svelte/icons/eye';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	// ── Liste ──
	let games = $state<GameRow[]>([]);
	let pgnText = $state('');
	let pgnError = $state('');

	// ── Einzelne Partie ──
	let row = $state.raw<GameRow | null>(null);
	let game = $state.raw<Game | null>(null);
	let ply = $state(0);
	// Die Stellung der Originalpartie bleibt der Rücksprungpunkt dieser Variante.
	let variation = $state.raw<Game | null>(null);
	let variationPly = $state(0);
	let boardVersion = $state(0);
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

	// ── Partien nach Zeitraum: Heute, Gestern, Diese Woche, dann je Monat ──
	/** „Partie hinzufügen“ offen – ohne Partien immer */
	let addOpen = $state(false);
	const addShown = $derived(addOpen || (!loading && gameCount === 0));

	function periodOf(ms: number): { key: string; label: string } {
		const d = new Date(ms);
		const now = new Date();
		const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
		if (diff <= 0) return { key: 'today', label: t('analysis.today') };
		if (diff === 1) return { key: 'yesterday', label: t('analysis.yesterday') };
		if (diff < 7) return { key: 'week', label: t('analysis.thisWeek') };
		const label = d.toLocaleDateString(intlLocale(), {
			month: 'long',
			...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
		});
		return { key: `${d.getFullYear()}-${d.getMonth()}`, label };
	}

	const groups = $derived.by(() => {
		const out: { key: string; label: string; games: GameRow[]; w: number; d: number; l: number }[] =
			[];
		for (const g of games) {
			const p = periodOf(g.date);
			let grp = out.at(-1);
			if (!grp || grp.key !== p.key) {
				grp = { ...p, games: [], w: 0, d: 0, l: 0 };
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
	const shownPly = $derived(variation ? variationPly : ply);
	const shownLine = $derived(variation ?? game);
	const position = $derived.by(() => {
		if (!shownLine) return null;
		if (shownPly === shownLine.ply) return shownLine;
		return Game.fromUciMoves(
			shownLine.moves.slice(0, shownPly).map((m) => m.uci),
			shownLine.startFen
		);
	});
	const fen = $derived(position?.fen ?? '');
	const dests = $derived.by(() => {
		void boardVersion;
		return position?.dests();
	});
	const currentReview = $derived(variation ? null : (reviews.find((r) => r.ply === ply) ?? null));
	const opening = $derived.by(() => {
		void openingsReady;
		if (variation) return openingFor(position?.moves.map((m) => m.uci) ?? []);
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

	/** ab dieser Tiefe ersetzt die Live-Engine die gespeicherte Bewertung */
	const LIVE_MIN_DEPTH = 12;

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
		const stored = variation ? undefined : evals[ply];
		live = {
			fen: f,
			lines: stored?.pv?.length ? toLines(f, [{ ...stored, pv: stored.pv }]) : [],
			depth: 0,
			done: false
		};
		if (position?.end()) {
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
					// flache Zwischenstände (Tiefe 1–11) nicht zeigen: sie wechseln ständig und sind oft falsch –
					// bis dahin bleibt die gespeicherte Bewertung der Partie-Analyse stehen
					if (ls[0].depth < LIVE_MIN_DEPTH && live?.fen === f && live.lines.length) return;
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
	const evalHere = $derived<Score | null>(
		variation ? (liveLines[0]?.score ?? null) : (evals[ply] ?? null)
	);

	/** Gewinnchance-Abstand (0..1), bis zu dem ein Zug als „genauso gut“ gilt */
	const EQUAL_WIN = 0.03;

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
		// schlechter Zug: gespielter Zug (rot) und was stattdessen besser gewesen wäre (grün) – beide
		// beziehen sich auf die Stellung davor; nur der rote Pfeil dazu macht das auf dem Brett eindeutig
		if (currentReview && isBad(currentReview.kind)) {
			const best = evals[ply - 1]?.best;
			const played = game.moves[ply - 1]?.uci;
			if (played && best && best !== played)
				s.push({ orig: played.slice(0, 2), dest: played.slice(2, 4), brush: 'bad' });
			if (best) s.push({ orig: best.slice(0, 2), dest: best.slice(2, 4), brush: 'good' });
			return s;
		}
		if (!showBest || (!variation && ply >= total - 1)) return s;
		// sonst: der beste Zug von hier – und weitere nur, wenn sie praktisch gleich gut sind
		// (es gibt oft mehrere gute Züge; ein Pfeil heißt nicht „nur dieser“)
		const top = liveLines[0];
		if (!top) return s;
		const turn = turnFromFen(fen);
		const w = (l: LiveLine) => {
			const x = whiteWin(l.score);
			return turn === 'white' ? x : 1 - x;
		};
		liveLines.slice(0, 3).forEach((l, i) => {
			const u = l.uci[0];
			if (!u || s.some((x) => x.orig === u.slice(0, 2) && x.dest === u.slice(2, 4))) return;
			if (i > 0 && w(top) - w(l) > EQUAL_WIN) return;
			s.push({ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: i === 0 ? 'info' : 'paleBlue' });
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
		if (variation) return { headline: t('analysis.variation'), text: t('analysis.variationText') };
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

	// Partie-Bewertung: gespielte Elo, Phasen, Wendepunkt, Chancen, Lernpunkt (lib/analysis/report.ts)
	const report = $derived(row && reviews.length && !analysing ? gameReport(row, reviews) : null);
	/** eigene Stärke für Bot-Partien (Rookies Schätzung) – zum Einordnen der Partie */
	let myStrength = $state<number | null>(null);
	onMount(() => void currentStrength().then((s) => (myStrength = s?.value ?? null)));
	/** Wertung des Gegners: online aus dem Import, bei Bots aus dem PGN (Bot-Stärke) */
	const oppElo = $derived.by(() => {
		if (!row) return null;
		if (row.oppRating) return row.oppRating;
		const tag = row.myColor === 'white' ? 'BlackElo' : 'WhiteElo';
		const m = row.pgn.match(new RegExp(`\\[${tag}\\s+"(\\d+)"\\]`));
		return m ? Number(m[1]) : null;
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
	/** Ergebnis je geübtem Fehler (Index in myMistakes) */
	type RetryResult = 'solved' | 'hinted' | 'shown';
	let retry = $state<{
		/** Reihenfolge der zu übenden Fehler (Indizes in myMistakes) */
		list: number[];
		pos: number;
		quick: boolean;
		res: Record<number, RetryResult>;
		status: 'try' | 'checking' | 'solved' | 'shown' | 'done';
		tries: number;
		hint: boolean;
		fb: MoveFeedback | null;
	} | null>(null);
	let retryV = $state(0);
	let savingRetry = $state(false);
	let finishedQuick = $state(false);
	const retryIdx = $derived(retry && retry.status !== 'done' ? retry.list[retry.pos] : -1);
	const retryItem = $derived(retryIdx >= 0 ? myMistakes[retryIdx] : null);
	const retryFen = $derived(retryItem && game ? game.fenAt(retryItem.ply - 1) : '');
	const retryBest = $derived(retryItem ? (evals[retryItem.ply - 1]?.best ?? '') : '');
	const retryOriginal = $derived(retryItem && game ? game.moves[retryItem.ply - 1].uci : '');
	/** Gegnerzug, der zur Übungsstellung geführt hat – als Bezug hervorgehoben */
	const retryLast = $derived.by<[string, string] | undefined>(() => {
		if (!retryItem || !game || retryItem.ply < 2) return undefined;
		const u = game.moves[retryItem.ply - 2].uci;
		return [u.slice(0, 2), u.slice(2, 4)];
	});
	const retryGame = $derived.by(() => {
		void retryV;
		return retryFen ? new Game(retryFen) : null;
	});
	const retryFound = $derived(
		retry ? Object.values(retry.res).filter((r) => r === 'solved').length : 0
	);
	const retryMissed = $derived(retry ? retry.list.filter((i) => retry!.res[i] !== 'solved') : []);

	const importantMistake = $derived.by(() => {
		return myMistakes.reduce((best, mistake, index) => {
			const solution = evals[mistake.ply - 1]?.best;
			if (!solution || solution === game?.moves[mistake.ply - 1]?.uci) return best;
			return best < 0 || mistake.loss > myMistakes[best].loss ? index : best;
		}, -1);
	});

	function practiseImportantMistake() {
		if (importantMistake >= 0) startRetry([importantMistake], true);
	}

	function startRetry(only?: number[], quick = false) {
		if (!myMistakes.length) return;
		variation = null;
		retry = {
			list: only?.length ? only : myMistakes.map((_, i) => i),
			pos: 0,
			quick,
			res: {},
			status: 'try',
			tries: 0,
			hint: false,
			fb: null
		};
		retryV++;
		void toBoard();
	}

	/** Brett und Aufgabe in den Blick holen (der Start-Knopf liegt am Handy unter dem Brett) */
	async function toBoard() {
		if (typeof window === 'undefined') return;
		// erst nach dem Umbau der Seite scrollen (Kommentar, Brett, Leiste wechseln) –
		// sonst bricht Safari das Scrollen ab oder die Scroll-Verankerung holt es zurück
		await tick();
		requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	}

	/** zu einem Fehler springen – schon gelöste zeigen ihr Ergebnis */
	function goRetry(pos: number) {
		if (!retry || pos < 0 || pos >= retry.list.length) return;
		const done = retry.res[retry.list[pos]];
		retry.pos = pos;
		retry.status = done === 'shown' ? 'shown' : done ? 'solved' : 'try';
		retry.tries = 0;
		retry.hint = false;
		retry.fb = null;
		retryV++;
	}

	async function onRetryMove(uci: string) {
		if (!retry || !retryItem || retry.status !== 'try' || !retryFen || savingRetry) return;
		if (uci === retryOriginal) {
			retry.tries++;
			retry.fb = { kind: 'bad', title: t('retry.sameTitle'), text: t('retry.sameText') };
			retryV++;
			return;
		}
		if (uci === retryBest || uci + 'q' === retryBest) return solved();
		const active = retry;
		retry.status = 'checking';
		const fb = await feedbackFor(retryFen, uci);
		if (retry !== active || retry.status !== 'checking') return;
		if (fb?.kind === 'playable') return solved();
		retry.tries++;
		retry.fb = fb;
		retry.status = 'try';
		retryV++;
	}

	async function solved() {
		if (!retry || savingRetry) return;
		// beim ersten Versuch ohne Tipp zählt es als gefunden
		const clean = retry.tries === 0 && !retry.hint;
		if (retry.quick) {
			const active = retry;
			if (!(await saveQuickResult(clean ? 'good' : 'hard')) || retry !== active) return;
		}
		retry.res[retry.list[retry.pos]] = clean ? 'solved' : 'hinted';
		retry.status = 'solved';
		retry.fb = null;
		if (!retry.quick) void scheduleMistake(clean ? 'good' : 'hard');
	}

	/**
	 * Der nachgespielte Fehler ist auch eine Wiederholungskarte („Deine eigenen Fehler“):
	 * Ergebnis dort eintragen, damit er im richtigen Abstand wiederkommt (nicht morgen erneut, wenn gelöst).
	 */
	async function scheduleMistake(recall: 'good' | 'hard' | 'again') {
		if (!row?.id || !retryItem) return;
		const id = `mistake:${row.source}-${row.id}-${retryItem.ply}`;
		if (await db.reviewCards.get(id)) await review(id, 'mistake', recall);
	}

	async function saveQuickResult(recall: 'good' | 'hard' | 'again') {
		if (!row?.id || !retryItem || !retry) return false;
		const active = retry;
		const gameRow = row;
		const id = `mistake:${row.source}-${row.id}-${retryItem.ply}`;
		const targetPly = retryItem.ply;
		savingRetry = true;
		try {
			await db.transaction(
				'rw',
				[db.reviewCards, db.mistakes, db.puzzleAttempts, db.settings],
				async () => {
					// Auch ältere Analyse-Daten oder reine Stellungsfehler erhalten bei Bedarf eine Karte.
					if (!(await db.reviewCards.get(id)))
						await createMistakePuzzles(gameRow, evals, targetPly);
					if (!(await db.reviewCards.get(id))) throw new Error('Missing mistake review card');
					await review(id, 'mistake', recall);
					await db.puzzleAttempts.add({
						puzzleId: id.slice('mistake:'.length),
						date: Date.now(),
						solved: recall !== 'again',
						hinted: recall === 'hard',
						ratingAfter: 0,
						themes: [],
						source: 'mistake'
					});
					const reviewed = await getSetting<number[]>('reviewedGames', []);
					if (gameRow.id && !reviewed.includes(gameRow.id))
						await setSetting('reviewedGames', [...reviewed, gameRow.id]);
				}
			);
			if (retry === active) finishedQuick = true;
			return true;
		} catch (error) {
			console.error(error);
			if (retry === active) {
				retry.status = 'try';
				retry.fb = { kind: 'bad', title: t('retry.saveFailed'), text: '' };
				retryV++;
			}
			return false;
		} finally {
			savingRetry = false;
		}
	}

	function retryHint() {
		if (!retry || retry.status !== 'try' || savingRetry) return;
		retry.hint = true;
	}

	async function retrySolution() {
		if (!retry || savingRetry || (retry.status !== 'try' && retry.status !== 'checking')) return;
		if (retry.quick) {
			const active = retry;
			if (!(await saveQuickResult('again')) || retry !== active) return;
		}
		retry.res[retry.list[retry.pos]] = 'shown';
		retry.status = 'shown';
		retry.fb = null;
		if (!retry.quick) void scheduleMistake('again');
	}

	async function nextRetry() {
		if (!retry) return;
		// nächster noch offener Fehler, sonst fertig
		const open = retry.list.findIndex((i, p) => p > retry!.pos && !retry!.res[i]);
		if (open >= 0) return goRetry(open);
		const anyOpen = retry.list.findIndex((i) => !retry!.res[i]);
		if (anyOpen >= 0) return goRetry(anyOpen);
		retry.status = 'done';
		if (retry.quick) return;
		// Tagesplan: „Aus deiner letzten Partie lernen“ gilt damit als erledigt
		const list = await getSetting<number[]>('reviewedGames', []);
		if (row?.id && !list.includes(row.id)) await setSetting('reviewedGames', [...list, row.id]);
	}

	/** Training beenden und in der Analyse genau diesen Zug zeigen */
	function closeRetry() {
		const target = retryItem?.ply;
		retry = null;
		if (target) go(target);
		void toBoard();
	}

	const retryShapes = $derived.by<Shape[]>(() => {
		if (!retry || !retryItem) return [];
		if (retry.status === 'try' && retry.hint && retryBest)
			return [{ orig: retryBest.slice(0, 2), brush: 'good' }];
		if ((retry.status === 'shown' || retry.status === 'solved') && retryBest)
			return [
				// rot: was in der Partie gespielt wurde, grün: der bessere Zug
				{ orig: retryOriginal.slice(0, 2), dest: retryOriginal.slice(2, 4), brush: 'bad' },
				{ orig: retryBest.slice(0, 2), dest: retryBest.slice(2, 4), brush: 'good' }
			];
		return [];
	});

	// ── „Erst du“: eigene Fehler vor der Auflösung selbst suchen (lib/analysis/selfreview.ts) ──
	let selfReview = $state<'off' | 'active' | 'done'>('off');
	const selfMistakes = $derived(!analysing && progress >= 1 ? myMistakes.map((r) => r.ply) : null);

	async function finishSelfReview(marked: number[], score: SelfReviewScore) {
		if (!row?.id) return;
		const list = await getSetting<SelfReviewResult[]>('selfReviews', []);
		await setSetting('selfReviews', [
			...list.filter((x) => x.gameId !== row!.id),
			{
				gameId: row.id,
				date: Date.now(),
				found: score.found.length,
				total: score.total,
				extra: score.extra.length
			}
		]);
		void marked;
	}

	function leaveSelfReview(target: number) {
		selfReview = 'done';
		go(target);
		resetDockReserve();
		void toBoard();
	}

	function practiceSelfReview() {
		leaveSelfReview(0);
		startRetry();
	}

	// aus dem Tagesplan: ?retry=1 startet sofort, sobald die Analyse fertig ist
	$effect(() => {
		if (
			typeof window !== 'undefined' &&
			page.url.searchParams.get('retry') === '1' &&
			selfReview === 'off' &&
			!retry &&
			!analysing &&
			progress >= 1 &&
			myMistakes.length
		) {
			selfReview = 'done';
			startRetry();
		}
	});

	let pendingPractice = $state(false);
	let noPractice = $state(false);

	$effect(() => {
		if (!pendingPractice || loading || analysing || progress < 1) return;
		pendingPractice = false;
		if (importantMistake >= 0) practiseImportantMistake();
		else {
			noPractice = true;
			const id = row?.id;
			if (id)
				void db.transaction('rw', db.settings, async () => {
					const reviewed = await getSetting<number[]>('reviewedGames', []);
					if (!reviewed.includes(id)) await setSetting('reviewedGames', [...reviewed, id]);
				});
		}
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
		analysing = false;
		pendingPractice = false;
		noPractice = false;
		finishedQuick = false;
		retry = null;
		variation = null;
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
		// aus dem Tagesplan und noch nicht selbst besprochen → erst „Erst du“
		const reviewed = await getSetting<SelfReviewResult[]>('selfReviews', []);
		const quickLink = page.url.searchParams.get('practice') === '1';
		const played = quickLink && (await getSetting<number[]>('reviewedGames', [])).includes(r.id!);
		selfReview =
			page.url.searchParams.get('retry') === '1' && !reviewed.some((x) => x.gameId === r.id)
				? 'active'
				: 'off';
		game = Game.fromUciMoves(r.moves, r.startFen);
		orientation = r.myColor;
		ply = 0;
		evals = r.analysis?.evals ?? [];
		progress = evals.length / (game.ply + 1);
		if (!r.analysis?.done) runAnalysis();
		else ply = 0;
		pendingPractice = quickLink && !played;
		finishedQuick = played;
	}

	async function runAnalysis() {
		if (!row) return;
		const target = row;
		const controller = new AbortController();
		analysing = true;
		abort = controller;
		try {
			const res = await analyseGame(
				target,
				(done, tot, ev) => {
					if (controller.signal.aborted) return;
					progress = done / tot;
					evals = [...ev];
				},
				controller.signal
			);
			if (controller.signal.aborted) return;
			evals = res;
			const fresh = await db.games.get(target.id!);
			if (controller.signal.aborted || !fresh?.analysis?.done) return;
			row = fresh;
			const created = await createMistakePuzzles(fresh, res);
			if (!controller.signal.aborted) mistakesCreated = created;
		} finally {
			if (!controller.signal.aborted) analysing = false;
		}
	}

	function go(p: number) {
		variation = null;
		ply = Math.max(0, Math.min(total - 1, p));
	}

	function browse(p: number) {
		if (variation) variationPly = Math.max(0, Math.min(variation.ply, p));
		else go(p);
	}

	function playVariation(uci: string) {
		if (!shownLine || retry) return;
		const next = Game.fromUciMoves(
			shownLine.moves.slice(0, shownPly).map((m) => m.uci),
			shownLine.startFen
		);
		const move = next.play(uci);
		if (!move) {
			boardVersion++;
			return;
		}
		if (shownLine.moves[shownPly]?.uci === move.uci) browse(shownPly + 1);
		else {
			variation = next;
			variationPly = next.ply;
		}
		sound.move(!!move.captured, next.isCheck);
	}

	function onKey(e: KeyboardEvent) {
		if (
			!game ||
			(e.target instanceof HTMLElement &&
				e.target.closest('textarea, input, [contenteditable], dialog')) ||
			(e.key === ' ' && e.target instanceof HTMLButtonElement)
		)
			return;
		// im Fehler-Trainer: ← → zwischen den Fehlern, h = Tipp, s = Lösung, Enter = weiter, Esc = beenden
		if (retry) {
			if (retry.status === 'done') {
				if (e.key === 'Escape' || e.key === 'Enter') retry = null;
				else return;
			} else if (e.key === 'ArrowLeft') goRetry(retry.pos - 1);
			else if (e.key === 'ArrowRight') goRetry(retry.pos + 1);
			else if (e.key === 'h') retryHint();
			else if (e.key === 's') retrySolution();
			else if (e.key === 'Escape') closeRetry();
			else if (e.key === 'Enter' && (retry.status === 'solved' || retry.status === 'shown'))
				void nextRetry();
			else return;
			e.preventDefault();
			return;
		}
		if (e.key === 'ArrowLeft') browse(shownPly - 1);
		else if (e.key === 'ArrowRight') browse(shownPly + 1);
		else if (e.key === 'Home' || e.key === 'ArrowUp') browse(0);
		else if (e.key === 'End' || e.key === 'ArrowDown') browse(shownLine?.ply ?? 0);
		else if (e.key === 'Escape' && variation) variation = null;
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

	// ── Kommentar über dem Brett (Handy) ──
	const reviewBar = $derived.by(() => {
		if (!row || retry || !comment) return null;
		const kind = ply > 0 ? (currentReview?.kind ?? null) : null;
		const who =
			ply > 0 && currentReview
				? currentReview.mover === row.myColor
					? t('review.yourMove')
					: t('review.opponentMove', { name: row.opponent })
				: '';
		return {
			kind,
			kicker: [who, kind ? t(`review.kind.${kind}`) : ''].filter(Boolean).join(' · '),
			title: comment.headline,
			text: comment.text,
			color: kind ? kindColor(kind) : 'var(--c-learn)'
		};
	});
	// Nachspielen der eigenen Fehler: Aufgabe und Rückmeldung stehen ebenfalls oben
	const moveLabel = (ply: number) =>
		game
			? `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '…'} ${figurine(game.moves[ply - 1].san)}`
			: '';
	const retryBar = $derived.by(() => {
		if (!retry || !row || !game) return null;
		if (retry.status === 'done')
			return {
				kicker: t(retry.quick ? 'retry.oneDone' : 'retry.doneTitle'),
				title: t('retry.doneText', { n: retryFound, m: retry.list.length }),
				text: retryMissed.length
					? t('retry.doneMissed', { n: retryMissed.length })
					: t('retry.donePerfect'),
				color: 'var(--k-best)'
			};
		if (!retryItem) return null;
		const kicker = t('retry.step', { i: retry.pos + 1, n: retry.list.length });
		const played = moveLabel(retryItem.ply);
		const why = retryItem.explanation
			? `${retryItem.explanation.title}: ${retryItem.explanation.text}`
			: '';
		const best = figurine(sanForUci(retryFen, retryBest));
		if (retry.status === 'solved')
			return {
				kicker,
				title: retry.res[retryIdx] === 'hinted' ? t('retry.solvedHint') : t('retry.solved'),
				text: [t('retry.youPlayed', { move: played }), why].filter(Boolean).join(' '),
				color: 'var(--k-best)'
			};
		if (retry.status === 'shown')
			return {
				kicker,
				title: t('retry.best', { san: best }),
				text: [t('retry.youPlayed', { move: played }), why].filter(Boolean).join(' '),
				color: 'var(--k-mistake)'
			};
		return {
			kicker,
			title: t('retry.prompt', { move: played }),
			text: retry.fb
				? `${retry.fb.title} ${retry.fb.text}`
				: retry.status === 'checking'
					? t('course.checking')
					: retry.hint
						? t('retry.hintShown')
						: retryLast
							? t('retry.after', { move: moveLabel(retryItem.ply - 1) })
							: t('retry.hint'),
			color: retry.fb ? 'var(--k-mistake)' : 'var(--c-learn)'
		};
	});
	// Leiste bleibt stehen, auch wenn ein Zug noch nicht analysiert ist – sonst wächst und schrumpft das Brett
	const bar = $derived(
		retryBar ??
			reviewBar ??
			(row && game && !retry
				? {
						kind: null,
						kicker: '',
						title: t('analysis.running'),
						text: '',
						color: 'var(--c-learn)'
					}
				: null)
	);

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
		<!-- oben nur zwei Werkzeuge; alles zum Hinzufügen liegt an einem Ort -->
		<div class="toolbar">
			<button
				class="btn"
				class:secondary={gameCount > 0}
				aria-expanded={addShown}
				aria-controls="games-add-panel"
				data-testid="games-add"
				onclick={() => (addOpen = !addOpen)}><Plus size={18} /> {t('analysis.add')}</button
			>
			<a class="btn secondary" href={resolve('/analysis/board')}
				><LayoutGrid size={18} /> {t('board2.open')}</a
			>
		</div>

		{#if addShown}
			<section class="add" id="games-add-panel" data-testid="games-add-panel">
				<LinkedAccounts />
				<div class="card pgn">
					<h2>{t('analysis.pastePgn')}</h2>
					<textarea
						bind:value={pgnText}
						rows="5"
						placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 …"
						aria-label={t('analysis.pastePgn')}
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
					<a class="link hit44" href={resolve('/import')}
						><CloudDownload size={16} /> {t('analysis.importLink')}</a
					>
				</div>
			</section>
		{/if}

		{#if mistakeCount > 0}
			<a class="practice" href={resolve('/puzzles?mode=mistakes')} data-testid="games-practice">
				<Target size={18} />
				<span>{t('analysis.hubPractice', { n: mistakeCount })}</span>
				<ChevronRight size={18} />
			</a>
		{/if}

		{#if loading || gameCount > 0 || filter !== 'all'}
			<nav class="filters" aria-label={t('analysis.games')}>
				{#each FILTERS as f (f)}
					<button class="chip" class:on={filter === f} onclick={() => setFilter(f)}
						>{t(`analysis.filter.${f}`)}</button
					>
				{/each}
			</nav>
		{/if}
	</div>

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
				</div>
			</div>
		{:else}
			{#each groups as grp (grp.key)}
				<div class="day">
					<h3>{grp.label}</h3>
					<span class="day-score"
						>{[
							grp.w ? t('analysis.dayWins', { n: grp.w }) : '',
							grp.d ? t('analysis.dayDraws', { n: grp.d }) : '',
							grp.l ? t('analysis.dayLosses', { n: grp.l }) : ''
						]
							.filter(Boolean)
							.join(' · ')}</span
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
{:else if !loading && !row}
	<PageHeader title={t('analysis.notFound')} />
	<a class="btn" href={resolve('/analysis')}>{t('analysis.toGames')}</a>
{:else if game && row && selfReview === 'active'}
	<div class="top-line">
		<a class="back hit44" href={resolve('/analysis')}
			><ArrowLeft size={18} /> {t('analysis.games')}</a
		>
	</div>
	<DailyTaskProgress kind="game" gameId={row.id} />
	<SelfReview
		{game}
		myColor={row.myColor}
		mistakes={selfMistakes}
		{progress}
		onFinish={(m, sc) => void finishSelfReview(m, sc)}
		onSkip={leaveSelfReview}
		onPractice={practiceSelfReview}
	/>
{:else if game && row}
	<div class="top-line">
		<a class="back hit44" href={resolve('/analysis')}
			><ArrowLeft size={18} /> {t('analysis.games')}</a
		>
		{#if opening}<span class="opening" title={opening.eco}>{opening.name}</span>{/if}
		{#if variation}
			<button class="btn secondary small to-board" onclick={() => (variation = null)}>
				<RotateCcw size={16} />
				{t('analysis.returnToGame')}
			</button>
		{:else}
			<a
				class="btn secondary small to-board"
				href={resolve(`/analysis/board?game=${row.id}&ply=${ply}`)}
				><LayoutGrid size={16} /> {t('board2.fromHere')}</a
			>
		{/if}
	</div>

	{#if retry}<DailyTaskProgress kind="game" gameId={row.id} />{/if}

	{#if bar}
		<CommentBar
			kicker={bar.kicker}
			title={bar.title}
			text={bar.text}
			color={bar.color}
			testid="review-bar"
		>
			{#snippet icon()}
				{@const k = reviewBar && !retryBar ? reviewBar.kind : null}
				{@const KI = k ? KIND_ICON[k] : null}
				{#if k && KI}<KI size={16} strokeWidth={3} />{:else if k}{KIND_GLYPH[
						k
					]}{:else}<GraduationCap size={16} />{/if}
			{/snippet}
		</CommentBar>
	{/if}
	<div class="arena">
		<div class="board-col" class:with-bar={!!bar}>
			<div class="board-row">
				<EvalBar score={evalHere} {orientation} />
				<div class="board-wrap">
					{#if retryGame && retry && retryItem}
						<!-- ein Brett für den ganzen Übungsablauf (kein Neuaufbau zwischen Versuch und Lösung) -->
						<Board
							fen={retryFen}
							{orientation}
							turnColor={retryGame.turn}
							lastMove={retryLast}
							dests={retry.status === 'try' ? retryGame.dests() : new Map()}
							movableColor={row.myColor}
							shapes={retryShapes}
							isPromotion={(f, to) => retryGame.isPromotion(f as never, to as never)}
							onMove={(u) => void onRetryMove(u)}
							label={t('analysis.board')}
						/>
					{:else}
						<Board
							{fen}
							{orientation}
							lastMove={position?.lastMove}
							turnColor={position?.turn}
							check={position?.isCheck}
							{dests}
							movableColor="both"
							isPromotion={(from, to) => position?.isPromotion(from as never, to as never) ?? false}
							onMove={playVariation}
							{shapes}
							{badge}
							tint={badge?.color ?? null}
							label={t('analysis.board')}
						/>
					{/if}
				</div>
			</div>
			{#if !retry}
				<Dock order={2}>
					<div class="nav">
						<button onclick={() => browse(0)} aria-label={t('analysis.nav.first')}
							><ChevronsLeft size={22} /></button
						>
						<button onclick={() => browse(shownPly - 1)} aria-label={t('analysis.nav.prev')}
							><ChevronLeft size={22} /></button
						>
						<button onclick={() => browse(shownPly + 1)} aria-label={t('analysis.nav.next')}
							><ChevronRight size={22} /></button
						>
						<button onclick={() => browse(shownLine?.ply ?? 0)} aria-label={t('analysis.nav.last')}
							><ChevronsRight size={22} /></button
						>
						<button
							onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')}
							aria-label={t('analysis.nav.flip')}><RefreshCw size={19} /></button
						>
						{#if myMistakes.length && !variation}
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
			{/if}
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
				<!-- Fehler-Trainer: eigene Steuerung (am Handy in der Leiste, Text steht oben im Kommentar) -->
				<Dock reserve={112}>
					<div
						class="card retry"
						role="group"
						aria-label={t('retry.cta', { n: retry.list.length })}
					>
						{#if retryBar}
							<div class="rt-text" aria-live="polite">
								<span class="rt-kick">{retryBar.kicker}</span>
								<p class="rt-title">{retryBar.title}</p>
								{#if retryBar.text}<p class="rt-body">{retryBar.text}</p>{/if}
							</div>
						{/if}
						{#if retry.status === 'done'}
							<div class="rt-actions">
								{#if retryMissed.length}
									<button class="btn" onclick={() => startRetry(retryMissed)}
										><RotateCcw size={17} /> {t('retry.again', { n: retryMissed.length })}</button
									>
								{/if}
								<button
									class="btn"
									class:secondary={retryMissed.length > 0}
									onclick={() => (retry = null)}>{t('retry.close')}</button
								>
							</div>
						{:else}
							<div class="rt-nav">
								<button
									class="rt-icon"
									onclick={closeRetry}
									aria-label={t('retry.exit')}
									title={t('retry.exit')}><X size={19} /></button
								>
								<button
									class="rt-icon"
									onclick={() => goRetry(retry!.pos - 1)}
									disabled={retry.pos === 0}
									aria-label={t('retry.prev')}
									title="{t('retry.prev')} (←)"><ChevronLeft size={21} /></button
								>
								<div class="rt-dots">
									{#each retry.list as mi, p (mi)}
										<button
											class="rt-dot {retry.res[mi] ?? ''}"
											class:on={p === retry.pos}
											onclick={() => goRetry(p)}
											aria-label={t('retry.goTo', { n: p + 1 })}
											aria-current={p === retry.pos ? 'step' : undefined}
										></button>
									{/each}
								</div>
								<button
									class="rt-icon"
									onclick={() => goRetry(retry!.pos + 1)}
									disabled={retry.pos >= retry.list.length - 1}
									aria-label={t('retry.next')}
									title="{t('retry.next')} (→)"><ChevronRight size={21} /></button
								>
							</div>
							<div class="rt-actions">
								{#if retry.status === 'solved' || retry.status === 'shown'}
									<button class="btn grow" onclick={() => void nextRetry()}
										>{retry.list.every((i, p) => p === retry!.pos || retry!.res[i])
											? t('retry.finish')
											: t('retry.continue')}
										<ArrowRight size={17} /></button
									>
								{:else}
									<button
										class="btn secondary grow"
										onclick={retryHint}
										disabled={retry.hint || retry.status !== 'try'}
										><Lightbulb size={17} /> {t('retry.hintBtn')}</button
									>
									<button
										class="btn secondary grow"
										onclick={retrySolution}
										disabled={retry.status === 'checking'}
										><Eye size={17} /> {t('retry.solution')}</button
									>
								{/if}
							</div>
						{/if}
					</div>
				</Dock>
			{:else if progress >= 1 && !analysing}
				{#if noPractice || finishedQuick}
					<p class="card retry-cta" data-testid="quick-result">
						{t(importantMistake < 0 ? 'retry.noneToPractise' : 'retry.oneDone')}
					</p>
				{/if}
				{#if importantMistake >= 0}
					<button
						class="card retry-cta"
						data-testid="quick-practice"
						onclick={practiseImportantMistake}
					>
						<span class="rc-ico"><Target size={20} /></span>
						<span><b>{t('retry.one')}</b>{t('retry.oneText')}</span>
						<ChevronRight size={18} />
					</button>
				{/if}
				{#if myMistakes.length}
					<button class="card retry-cta" onclick={() => startRetry()}>
						<span class="rc-ico"><Target size={20} /></span>
						<span
							><b>{t('retry.cta', { n: myMistakes.length })}</b>
							{t('retry.ctaText')}</span
						>
						<ChevronRight size={18} />
					</button>
				{/if}
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

			{#if !variation && evals.length > 1}
				<div class="card graph-card">
					<EvalGraph {evals} {total} current={ply} {reviews} myColor={row.myColor} onSelect={go} />
				</div>
			{/if}

			{#if !variation && report && row}
				<GameReport
					{report}
					myColor={row.myColor}
					opponent={row.opponent}
					myRating={row.myRating ?? myStrength}
					oppRating={oppElo}
					{moveLabel}
					onGo={(p) => {
						go(p);
						void toBoard();
					}}
				/>
			{/if}

			{#if !variation && reviews.length && !analysing}
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
				<MoveList
					moves={shownLine?.moves ?? []}
					current={shownPly}
					blackStarts={turnFromFen(game.startFen) === 'black'}
					tags={variation ? {} : tags}
					onSelect={browse}
				/>
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

	.hub,
	.games {
		max-width: 760px;
	}

	.hub {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.toolbar {
		display: flex;
		gap: 0.5rem;
	}

	.toolbar .btn {
		flex: 1 1 0;
		min-width: 0;
		padding-inline: 0.8rem;
		white-space: nowrap;
	}

	.toolbar .btn :global(svg) {
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.toolbar .btn {
			flex: none;
		}
	}

	.add {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.add .pgn h2 {
		font-size: 1.05rem;
	}

	/* eine schmale Zeile statt einer Kachel: eigene Fehler üben */
	.practice {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 48px;
		padding: 0.6rem 0.9rem;
		border-radius: 16px;
		background: color-mix(in srgb, var(--c-play) 14%, var(--surface));
		color: var(--text);
		font-weight: 600;
	}

	.practice span {
		flex: 1;
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
		font-size: 0.8rem;
		color: var(--text-3);
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
	/* ── Fehler-Trainer ── */
	.retry {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem;
		border: 1.5px solid color-mix(in srgb, var(--c-puzzle) 40%, transparent);
	}

	.rt-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.rt-kick {
		font-family: var(--font-num);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--c-puzzle);
	}

	.rt-title {
		font-weight: 700;
		font-size: 1.02rem;
	}

	.rt-body {
		color: var(--text-2);
		line-height: 1.5;
	}

	.rt-nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.rt-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
	}

	.rt-icon:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.rt-icon:not(:disabled):active {
		background: var(--surface-2);
	}

	/* Fortschritt: ein Punkt je Fehler – gelöst, mit Tipp, Lösung angesehen, offen */
	.rt-dots {
		flex: 1;
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.2rem;
		min-width: 0;
	}

	.rt-dot {
		position: relative;
		width: 12px;
		height: 12px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1.5px var(--line-strong);
		cursor: pointer;
	}

	/* Tippfläche größer als der Punkt */
	.rt-dot::after {
		content: '';
		position: absolute;
		inset: -10px -3px;
	}

	.rt-dot.solved {
		background: var(--good);
		box-shadow: none;
	}

	.rt-dot.hinted {
		background: var(--warn);
		box-shadow: none;
	}

	.rt-dot.shown {
		background: var(--bad);
		box-shadow: none;
	}

	.rt-dot.on {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.rt-actions {
		display: flex;
		gap: 0.5rem;
	}

	.rt-actions .grow {
		flex: 1;
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
		max-width: min(660px, calc(100svh - 200px));
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
		gap: 0.15rem;
	}

	/* in der Kapsel: Symbole ohne eigene Kästchen, nur „Fehler nachspielen“ ist hervorgehoben */
	:global(.docked) .nav button {
		height: 46px;
		border-radius: 999px;
		background: transparent;
		box-shadow: none;
		color: var(--text-2);
	}

	:global(.docked) .nav button:active {
		background: var(--surface-2);
	}

	:global(.docked) .nav .to-mistake {
		background: color-mix(in srgb, var(--bad) 14%, var(--surface));
		color: var(--bad-text);
	}

	:global(.docked) .retry {
		box-shadow: none;
		border: none;
		background: none;
		padding: 0.1rem;
		gap: 0.4rem;
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
				calc(100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 80px)
			);
		}
		/* Kommentar steht über dem Brett (feste Höhe) */
		.board-col.with-bar {
			max-width: min(
				100%,
				calc(
					100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 80px - var(--comment-h) -
						0.5rem
				)
			);
		}
		/* beim Nachspielen: Aufgabe und Rückmeldung stehen oben im Kommentar, unten nur die Steuerung */
		.rt-text {
			display: none;
		}
	}
</style>
