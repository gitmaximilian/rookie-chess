<script lang="ts">
	import CommentBar from '#lib/ui/CommentBar.svelte';
	import Dock from '#lib/ui/Dock.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import X from '@lucide/svelte/icons/x';
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
	import { Game, INITIAL_FEN, sanForUci, type GameEnd } from '#lib/chess/game.js';
	import {
		endReason,
		verdictFor,
		resultString,
		formatClock,
		colorName
	} from '#lib/chess/labels.js';
	import { engine } from '#lib/engine/engine.js';
	import {
		assessMove,
		isBlunder,
		threats,
		opponentIdea,
		findThreat,
		principleTip,
		coachHint,
		punishment,
		type CoachNote,
		type Threat
	} from '#lib/coach/coach.js';
	import { coachLevel, type CoachPref } from '#lib/coach/fading.js';
	import SegmentedSwitch from '#lib/ui/bento/SegmentedSwitch.svelte';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Users from '@lucide/svelte/icons/users';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { figurine } from '#lib/chess/notation.js';
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
		coach?: boolean;
	}

	// ── Einrichtung ──
	let phase = $state<'loading' | 'setup' | 'playing'>('loading');
	let botId = $state('tina');
	let colorChoice = $state<'white' | 'black' | 'random'>('white');
	let tcChoice = $state<string | null>(null);
	// Anfänger lernen am meisten mit Coach – deshalb an, bis man ihn selbst ausschaltet
	let coachOn = $state(true);

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
	// ── Coach ──
	let coachNote = $state<CoachNote | null>(null);
	let coachOpp = $state<{ san: string; text: string; warn: string } | null>(null);
	/** der Gegner hat gerade gepatzt – nur in der geführten Stufe als Hinweis (siehe detectChance) */
	let coachChance = $state(false);
	let coachBusy = $state(false);
	let coachPending = $state(false);
	let coachAbort: AbortController | null = null;
	let coachTip = $state('');
	let coachThreat = $state<Threat | null>(null);
	let threatShown = $state(false);
	let coachHelp = $state<{ idea: string; piece: string; uci: string; level: number } | null>(null);
	let helpBusy = $state(false);
	let retryNote = $state<{ better: string; shown: boolean } | null>(null);
	// Hilfe ausschleichen (lib/coach/fading.ts): „check“ = Coach fragt nur, zeigt auf Wunsch
	let coachPref = $state<CoachPref>('auto');
	let coachedGames = $state(0);
	const selfCheck = $derived(coachLevel(coachPref, coachedGames) === 'check');
	/** Drohungen nach dem Gegnerzug aufgedeckt (nur bei „selbst prüfen“) */
	let revealed = $state(false);
	/** Erklärung und Pfeile zum eigenen Patzer aufgedeckt (nur bei „selbst prüfen“) */
	let whyShown = $state(false);
	let pendingShapes: typeof hintShapes = [];
	let threatAbort: AbortController | null = null;

	// ── Kommentar über dem Brett (Handy): immer die eine wichtigste Coach-Nachricht ──
	const JUDGE_COLOR: Record<string, string> = {
		best: 'var(--k-best)',
		excellent: 'var(--k-excellent)',
		good: 'var(--k-good)',
		inaccuracy: 'var(--k-inaccuracy)',
		mistake: 'var(--k-mistake)',
		blunder: 'var(--k-blunder)'
	};
	interface CoachBar {
		kicker: string;
		title: string;
		text: string;
		color: string;
		state?: string;
		act: string;
	}
	const coachBar = $derived.by((): CoachBar => {
		const coach = t('coach.title');
		// Fehler mit Angebot zum Zurücknehmen geht vor allem anderen
		// selbst prüfen: bei einem Patzer erst „Halt“, Erklärung erst auf Wunsch
		if (coachNote && coachPending && selfCheck && !whyShown)
			return {
				kicker: `${coach} · ${t('review.yourMove')}`,
				title: t('coach.unsafeTitle'),
				text: t('coach.unsafeText'),
				color: 'var(--k-mistake)',
				state: 'judged',
				act: 'why'
			};
		const hideWarn = selfCheck && !revealed;
		const judged = (opp: boolean): CoachBar => ({
			kicker: `${coach} · ${t('review.yourMove')}`,
			title: coachNote!.title,
			// danach antwortet der Bot: eine Warnung zu seinem Zug kommt zuerst (sonst wird sie abgeschnitten),
			// dann die Erklärung zum eigenen Zug, dann was der Gegner gezogen hat
			text: [
				opp && coachOpp?.warn && !hideWarn ? coachOpp.warn : '',
				coachNote!.text,
				opp && coachOpp ? `${t('coach.opponent')} ${figurine(coachOpp.san)}: ${coachOpp.text}` : '',
				coachPending ? '' : coachTip
			]
				.filter(Boolean)
				.join(' '),
			color: JUDGE_COLOR[coachNote!.judgement] ?? 'var(--c-learn)',
			state: 'judged',
			act: ''
		});
		if (coachNote && coachPending) return judged(false);
		// Chance zuerst: Einsteiger lassen fast die Hälfte der gegnerischen Patzer ungestraft (Lichess-Daten)
		if (coachChance && myTurn && !selfCheck)
			return {
				kicker: `${coach} · ${t('coach.chanceKicker')}`,
				title: t('coach.chanceTitle'),
				text: t('coach.chanceText'),
				color: 'var(--k-best)',
				act: ''
			};
		if (coachThreat && myTurn && !hideWarn)
			return {
				kicker: `${coach} · ${t('coach.warning')}`,
				title:
					coachThreat.kind === 'mate'
						? t('coach.threatMate', { n: coachThreat.mateIn ?? 1 })
						: t('coach.threatMaterial', {
								piece: t(`pieces.Poss.${coachThreat.role ?? 'pawn'}`)
							}),
				text: threatShown ? coachThreat.san : '',
				color: 'var(--k-mistake)',
				act: threatShown ? '' : 'threat'
			};
		if (retryNote && myTurn)
			return {
				kicker: coach,
				title: t('coach.retry'),
				text: retryNote.shown
					? t('coach.betterWas', { san: figurine(sanForUci(fen, retryNote.better)) })
					: '',
				color: 'var(--k-inaccuracy)',
				act: retryNote.shown ? '' : 'better'
			};
		if (coachHelp && myTurn)
			return {
				kicker: `${coach} · ${t('coach.hint.label')}`,
				title: coachHelp.idea,
				text: coachHelp.level >= 2 ? coachHelp.piece : '',
				color: 'var(--c-learn)',
				act: ''
			};
		if (coachNote && !(hideWarn && myTurn && coachOpp)) return judged(true);
		// selbst prüfen: statt der Warnung die Frage – die Antwort gibt es auf Wunsch
		if (coachOpp && hideWarn && myTurn)
			return {
				kicker: `${coach} · ${t('coach.opponent')} ${figurine(coachOpp.san)}`,
				title: t('coach.checkPrompt'),
				text: [coachNote ? `${coachNote.title}.` : '', t('coach.checkPromptText'), coachTip]
					.filter(Boolean)
					.join(' '),
				color: 'var(--c-learn)',
				act: 'reveal'
			};
		if (coachOpp)
			return {
				kicker: `${coach} · ${t('coach.opponent')} ${figurine(coachOpp.san)}`,
				title: coachOpp.text,
				text: [coachOpp.warn, coachTip].filter(Boolean).join(' '),
				color: coachOpp.warn ? 'var(--k-mistake)' : 'var(--c-learn)',
				act: ''
			};
		return {
			kicker: coach,
			title: coachBusy ? t('coach.thinking') : t('coach.welcome'),
			text: '',
			color: 'var(--c-learn)',
			act: ''
		};
	});

	function clearCoach() {
		whyShown = false;
		coachChance = false;
		coachTip = '';
		coachThreat = null;
		threatShown = false;
		coachHelp = null;
	}

	async function askCoach() {
		if (!myTurn || helpBusy) return;
		if (coachHelp) {
			coachHelp = { ...coachHelp, level: Math.min(3, coachHelp.level + 1) };
			if (coachHelp.level >= 3) {
				hintShapes = [
					{ orig: coachHelp.uci.slice(0, 2), dest: coachHelp.uci.slice(2, 4), brush: 'hint' }
				];
				hints++;
				persist();
			} else hintShapes = [{ orig: coachHelp.uci.slice(0, 2), brush: 'hint' }];
			return;
		}
		helpBusy = true;
		const fenNow = game.fen;
		const h = await coachHint(fenNow);
		helpBusy = false;
		if (!h || game.fen !== fenNow) return;
		coachHelp = { ...h, level: 1 };
	}

	/** selbst prüfen: Warnungen nach dem Gegnerzug aufdecken */
	function reveal() {
		revealed = true;
		if (coachThreat) showThreat();
	}

	/** selbst prüfen: Erklärung und Pfeile zum eigenen Patzer zeigen */
	function showWhy() {
		whyShown = true;
		hintShapes = pendingShapes;
	}

	function showThreat() {
		if (!coachThreat) return;
		threatShown = true;
		hintShapes = [
			{ orig: coachThreat.uci.slice(0, 2), dest: coachThreat.uci.slice(2, 4), brush: 'bad' }
		];
	}

	function showBetter() {
		if (!retryNote) return;
		retryNote = { ...retryNote, shown: true };
		hintShapes = [
			{ orig: retryNote.better.slice(0, 2), dest: retryNote.better.slice(2, 4), brush: 'good' }
		];
	}

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
	// ── Zugweise zurück/vor blättern (nur ansehen; „Zurücknehmen“ bleibt eigener Knopf) ──
	/** null = aktuelle Stellung, sonst Halbzug, der gerade angesehen wird */
	let viewPly = $state<number | null>(null);
	let showMoves = $state(false);
	// jeder neue Zug (eigener, Bot, Zurücknehmen) bringt zur aktuellen Stellung zurück
	$effect(() => {
		void v;
		untrack(() => (viewPly = null));
	});
	const browsing = $derived(viewPly !== null);
	const shownPly = $derived(viewPly ?? moves.length);
	const boardFen = $derived(viewPly === null ? fen : game.fenAt(viewPly));
	const boardLast = $derived.by<[string, string] | undefined>(() => {
		if (viewPly === null) return lastMove;
		const m = moves[viewPly - 1];
		return m ? [m.from, m.to] : undefined;
	});
	function stepBack() {
		if (shownPly > 0) viewPly = shownPly - 1;
	}
	function stepForward() {
		if (viewPly === null) return;
		viewPly = viewPly + 1 >= moves.length ? null : viewPly + 1;
	}

	const myTurn = $derived(
		phase === 'playing' && !ended && turn === myColor && !thinking && !coachBusy && !coachPending
	);
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
		coachOn = await getSetting('coachOn', true);
		coachPref = await getSetting<CoachPref>('coachPref', 'auto');
		coachedGames = await getSetting('coachedGames', 0);
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
		coachOn = !!s.coach;
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
		await setSetting('coachOn', coachOn);
		await setSetting('coachPref', coachPref);
		coachNote = null;
		coachOpp = null;
		coachPending = false;
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
			undos,
			coach: coachOn
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
		const fenBefore = game.fen;
		const played = game.play(uci);
		if (!played) {
			v++;
			return;
		}
		sound.move(!!played.captured, game.isCheck);
		addIncrement(myColor);
		hintShapes = [];
		v++;
		if (coachOn && !game.end()) return void coachAfterMyMove(fenBefore, played.uci);
		afterMove();
	}

	/** Coach bewertet den eigenen Zug; bei Fehlern wartet der Bot auf die Entscheidung */
	async function coachAfterMyMove(fenBefore: string, uci: string) {
		coachBusy = true;
		coachOpp = null;
		coachAbort = new AbortController();
		const fenNow = game.fen;
		clearCoach();
		retryNote = null;
		const history = game.moves.slice(0, -1).map((m) => m.uci);
		const note = await assessMove(fenBefore, uci, coachAbort.signal);
		if (coachAbort.signal.aborted || game.fen !== fenNow) {
			coachBusy = false;
			return;
		}
		coachNote = note;
		if (note?.serious) {
			// zeigen, wie der Gegner den Fehler bestraft
			const reply = await punishment(fenNow, coachAbort.signal);
			coachBusy = false;
			if (coachAbort.signal.aborted || game.fen !== fenNow) return;
			coachPending = true;
			sound.bad();
			pendingShapes = [
				{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'bad' },
				...(reply
					? [{ orig: reply.slice(0, 2), dest: reply.slice(2, 4), brush: 'bad' as const }]
					: [])
			];
			// selbst prüfen: erst „Halt“, Pfeile erst auf Wunsch
			whyShown = !selfCheck;
			hintShapes = selfCheck ? [] : pendingShapes;
			if (reply && coachNote)
				coachNote = {
					...coachNote,
					text: `${coachNote.text} ${t('coach.punish', { san: figurine(sanForUci(fenNow, reply)) })}`
				};
			return;
		}
		coachBusy = false;
		coachTip = note && note.judgement !== 'inaccuracy' ? principleTip(fenBefore, uci, history) : '';
		afterMove();
	}

	function coachTakeback() {
		if (!coachPending) return;
		const better = coachNote?.better;
		game.undo(1);
		retryNote = better ? { better, shown: false } : null;
		undos++;
		coachPending = false;
		coachNote = null;
		hintShapes = [];
		v++;
		persist();
	}

	function coachContinue() {
		coachPending = false;
		hintShapes = [];
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
			const ask = () =>
				engine.analyse({
					fen: fenNow,
					nodes: bot.nodes,
					multipv: bot.multipv,
					skill: bot.skill,
					signal
				});
			let res = await ask();
			// Engine war hängen geblieben und wurde neu gestartet → ein zweiter Versuch;
			// klappt auch der nicht, wählt chooseBotMove einen legalen Zug ohne Engine
			if (!res.lines.length && !signal.aborted) res = await ask();
			if (signal.aborted || game.fen !== fenNow) return;
			const choice = chooseBotMove(bot, res.lines, game.legalUcis(), game.captureUcis());
			const wait = thinkDelay(bot, game.ply) - (performance.now() - t0);
			if (wait > 0) await new Promise((r) => setTimeout(r, wait));
			if (signal.aborted || game.fen !== fenNow || !choice) return;
			const botFen = game.fen;
			const played = game.play(choice);
			if (played) {
				sound.move(!!played.captured, game.isCheck);
				addIncrement(myColor === 'white' ? 'black' : 'white');
				if (coachOn && !game.end()) {
					revealed = false;
					const danger = threats(game.fen)[0];
					coachOpp = {
						san: played.san,
						text: opponentIdea(botFen, played.uci),
						warn: danger
							? t('coach.threat', { piece: t(`pieces.poss.${danger.role}`), sq: danger.square })
							: ''
					};
					void detectThreat(game.fen);
					void detectChance(botFen, played.uci, game.fen);
				}
			}
			v++;
			if (game.end()) finish();
			else persist();
		} finally {
			if (!signal.aborted) thinking = false;
		}
	}

	/** Hat der Bot gerade gepatzt (≥ 30 Prozentpunkte)? Dann darf man etwas holen. */
	async function detectChance(fenBefore: string, uci: string, fenNow: string) {
		coachChance = false;
		if (selfCheck) return;
		const bad = await isBlunder(fenBefore, uci).catch(() => false);
		if (game.fen !== fenNow) return;
		coachChance = bad;
	}

	async function detectThreat(fenNow: string) {
		threatAbort?.abort();
		threatAbort = new AbortController();
		const th = await findThreat(fenNow, threatAbort.signal).catch(() => null);
		if (threatAbort.signal.aborted || game.fen !== fenNow) return;
		// hängende Figur wird schon gemeldet – Materialdrohung nur, wenn es etwas anderes ist
		coachThreat = th && (th.kind === 'mate' || !coachOpp?.warn) ? th : null;
	}

	async function hint() {
		if (!myTurn || hintLoading) return;
		// mit Coach: Hinweis in Stufen statt sofort den Zug zeigen
		if (coachOn) return askCoach();
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
		coachAbort?.abort();
		coachBusy = false;
		coachPending = false;
		coachNote = null;
		coachOpp = null;
		clearCoach();
		retryNote = null;
		threatAbort?.abort();
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
					Site: 'rookie.maximilianauer.at',
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
			if (coachOn) {
				coachedGames++;
				await setSetting('coachedGames', coachedGames);
			}
			// zählt für die Spielstärke nur ohne Hilfe: kein Zurücknehmen, kein Hinweis
			if (verdictFor(e, myColor) === 'win' && undos === 0 && hints === 0) {
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
		if (e.key === 'ArrowLeft') stepBack();
		if (e.key === 'ArrowRight') stepForward();
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

			<button
				class="coach-opt"
				class:on={coachOn}
				role="switch"
				aria-checked={coachOn}
				onclick={() => (coachOn = !coachOn)}
			>
				<span class="co-ico"><GraduationCap size={20} /></span>
				<span class="co-text"><b>{t('coach.toggle')}</b><span>{t('coach.toggleText')}</span></span>
				<span class="switch" class:on={coachOn} aria-hidden="true"><span></span></span>
			</button>

			{#if coachOn}
				<div class="opt coach-level">
					<span class="opt-label">{t('coach.levelLabel')}</span>
					<SegmentedSwitch
						label={t('coach.levelLabel')}
						bind:value={coachPref}
						options={[
							{ value: 'auto', label: t('coach.levelAuto') },
							{ value: 'warn', label: t('coach.levelWarn') },
							{ value: 'check', label: t('coach.levelCheck') }
						]}
					/>
					<span class="level-note"
						>{coachLevel(coachPref, coachedGames) === 'check'
							? t('coach.levelCheckText')
							: t('coach.levelWarnText')}</span
					>
				</div>
			{/if}

			<button class="btn big" onclick={start}>{t('play.start')}</button>
		</aside>
	</div>

	<a class="friend-link card pressable" href={resolve('/play/friend')}>
		<span class="fl-ico"><Users size={20} /></span>
		<span class="fl-text"><b>{t('friend.title')}</b><span>{t('friend.teaser')}</span></span>
		<ArrowRight size={18} />
	</a>

	<!-- Mobil: Start immer erreichbar, ohne nach unten zu scrollen -->
	<div class="start-bar" style:--h={botById(botId).hue}>
		<BotAvatar bot={botById(botId)} size={40} />
		<span class="sb-text">
			<b>{botById(botId).name}</b>
			<span>≈ {botById(botId).elo}</span>
		</span>
		<button class="btn" onclick={start}>{t('play.start')}</button>
	</div>
{:else if phase === 'playing'}
	{#if coachOn && !ended}
		<CommentBar
			kicker={coachBar.kicker}
			title={coachBar.title}
			text={coachBar.text}
			color={coachBar.color}
			status={coachBar.state ?? ''}
			testid="coach-bar"
		>
			{#snippet icon()}<GraduationCap size={16} />{/snippet}
			{#snippet action()}
				{#if coachBar.act === 'threat'}
					<button onclick={showThreat}>{t('coach.showThreat')}</button>
				{:else if coachBar.act === 'better'}
					<button onclick={showBetter}>{t('coach.showBetter')}</button>
				{:else if coachBar.act === 'reveal'}
					<button onclick={reveal}>{t('coach.reveal')}</button>
				{:else if coachBar.act === 'why'}
					<button onclick={showWhy}>{t('coach.why')}</button>
				{/if}
			{/snippet}
		</CommentBar>
	{/if}
	<div class="arena">
		<div class="board-col" class:with-bar={coachOn && !ended}>
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
				fen={boardFen}
				{orientation}
				turnColor={turn}
				lastMove={boardLast}
				check={browsing ? false : check}
				dests={browsing ? new Map() : dests}
				movableColor={myColor}
				shapes={browsing ? [] : hintShapes}
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
						{#if browsing}<span class="status viewing"
								>{t('play.viewing', { n: shownPly, m: moves.length })}</span
							>{:else if myTurn}<span class="status yours">{t('play.yourTurn')}</span>{/if}
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
				<!-- Zug zurück · Zugliste · Zug vor (nur ansehen) -->
				<div class="pnav" class:browsing>
					<button
						class="pn-btn"
						onclick={stepBack}
						disabled={shownPly === 0}
						aria-label={t('play.prevMove')}
						title="{t('play.prevMove')} (←)"><ChevronLeft size={21} /></button
					>
					<button
						class="pn-btn list"
						class:on={showMoves}
						onclick={() => (showMoves = !showMoves)}
						aria-expanded={showMoves}
						aria-label={t('play.showMoves')}
						title={t('play.showMoves')}><ListOrdered size={19} /></button
					>
					<button
						class="pn-btn"
						onclick={stepForward}
						disabled={!browsing}
						aria-label={t('play.nextMove')}
						title="{t('play.nextMove')} (→)"><ChevronRight size={21} /></button
					>
				</div>
			</div>
			{#if coachOn && !ended}
				<Dock>
					<div class="coach-box" class:warn={coachNote?.serious} role="status">
						<div class="cb-head">
							<span class="co-ico small"><GraduationCap size={16} /></span>
							<b>{t('coach.title')}</b>
							{#if coachBusy}<span class="cb-busy">{t('coach.thinking')}</span>{/if}
						</div>
						{#if coachChance && myTurn && !selfCheck}
							<p class="cb-chance"><b>{t('coach.chanceTitle')}</b> {t('coach.chanceText')}</p>
						{/if}
						{#if coachOpp && selfCheck && !revealed && myTurn}
							<p class="cb-opp">
								<span class="cb-label">{t('coach.opponent')} {figurine(coachOpp.san)}</span>
								{t('coach.checkPrompt')}
							</p>
							<p class="cb-text">{t('coach.checkPromptText')}</p>
							<button class="cb-link" onclick={reveal}>{t('coach.reveal')}</button>
						{:else if coachOpp}
							<p class="cb-opp">
								<span class="cb-label">{t('coach.opponent')} {figurine(coachOpp.san)}</span>
								{coachOpp.text}
							</p>
							{#if coachOpp.warn}<p class="cb-warn">{coachOpp.warn}</p>{/if}
						{/if}
						{#if coachThreat && myTurn && (!selfCheck || revealed)}
							<p class="cb-warn">
								{coachThreat.kind === 'mate'
									? t('coach.threatMate', { n: coachThreat.mateIn ?? 1 })
									: t('coach.threatMaterial', {
											piece: t(`pieces.Poss.${coachThreat.role ?? 'pawn'}`)
										})}
							</p>
							{#if !threatShown}
								<button class="cb-link" onclick={showThreat}>{t('coach.showThreat')}</button>
							{:else}
								<p class="cb-text">{coachThreat.san}</p>
							{/if}
						{/if}
						{#if retryNote && myTurn}
							<p class="cb-text">{t('coach.retry')}</p>
							{#if retryNote.shown}
								<p class="cb-title j-good">
									{t('coach.betterWas', { san: figurine(sanForUci(fen, retryNote.better)) })}
								</p>
							{:else}
								<button class="cb-link" onclick={showBetter}>{t('coach.showBetter')}</button>
							{/if}
						{/if}
						{#if coachNote && coachPending && selfCheck && !whyShown}
							<p class="cb-title j-blunder">{t('coach.unsafeTitle')}</p>
							<p class="cb-text">{t('coach.unsafeText')}</p>
							<div class="cb-actions">
								<button class="btn" onclick={coachTakeback}
									><Undo2 size={17} /> {t('coach.takebackSelf')}</button
								>
								<button class="btn secondary" onclick={showWhy}>{t('coach.why')}</button>
							</div>
						{:else if coachNote}
							<p class="cb-title j-{coachNote.judgement}">{coachNote.title}</p>
							<p class="cb-text">{coachNote.text}</p>
							{#if coachPending}
								<div class="cb-actions">
									<button class="btn" onclick={coachTakeback}
										><Undo2 size={17} /> {t('coach.takeback')}</button
									>
									<button class="btn secondary" onclick={coachContinue}
										>{t('coach.keepPlaying')}</button
									>
								</div>
							{/if}
						{:else if !coachOpp && !retryNote}
							<p class="cb-text">{t('coach.welcome')}</p>
						{/if}
						{#if coachTip && !coachPending}<p class="cb-tip">{coachTip}</p>{/if}
						{#if coachHelp && myTurn}
							<div class="cb-help">
								<p><Lightbulb size={15} /> {coachHelp.idea}</p>
								{#if coachHelp.level >= 2}<p>{coachHelp.piece}</p>{/if}
							</div>
						{/if}
						{#if myTurn && !coachPending}
							<button
								class="btn secondary small cb-ask"
								onclick={() => void askCoach()}
								disabled={helpBusy}
								><Lightbulb size={16} />
								{!coachHelp
									? t('coach.hint.ask')
									: coachHelp.level === 1
										? t('coach.hint.more')
										: coachHelp.level === 2
											? t('coach.hint.show')
											: t('coach.hint.ask')}</button
							>
						{/if}
					</div>
				</Dock>
			{/if}
		</div>

		{#if showMoves}
			<div class="moves-backdrop" role="presentation" onclick={() => (showMoves = false)}></div>
			<div class="moves-pop card" role="dialog" aria-label={t('play.showMoves')}>
				<div class="mp-head">
					<b>{t('play.showMoves')}</b>
					<button
						class="mp-close"
						onclick={() => (showMoves = false)}
						aria-label={t('common.close')}><X size={18} /></button
					>
				</div>
				<MoveList
					{moves}
					current={shownPly}
					onSelect={(p) => (viewPly = p >= moves.length ? null : p)}
				/>
			</div>
		{/if}

		<aside class="side card">
			<div class="side-moves">
				<MoveList
					{moves}
					current={shownPly}
					onSelect={(p) => (viewPly = p >= moves.length ? null : p)}
				/>
			</div>
			<!-- mit Coach: Platz für die Coach-Knöpfe vorab reservieren (der Text steht oben über dem Brett) -->
			<Dock order={1} reserve={coachOn ? 64 : 0}>
				<div class="controls" class:pending={coachPending && !ended}>
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
			</Dock>
			{#if ended && savedGameId}
				<a class="btn analyse-now" href={resolve(`/analysis?game=${savedGameId}`)}
					><ChartLine size={18} /> {t('play.analyse')}</a
				>
			{/if}
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
				<!-- Lernen zuerst: die Analyse zeigt, was man beim nächsten Mal besser macht -->
				{#if savedGameId}
					<a class="btn" href={resolve(`/analysis?game=${savedGameId}`)}>
						<ChartLine size={18} />
						{t('play.analyse')}
					</a>
				{/if}
				<button class="btn" class:secondary={!!savedGameId} onclick={rematch}
					>{t('play.rematch')}</button
				>
				<button class="btn secondary" onclick={newSetup}>{t('play.newOpponent')}</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	.analyse-now {
		width: 100%;
		justify-content: center;
	}

	.friend-link {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		max-width: 1100px;
		margin: 1.25rem 0 0;
		padding: 0.8rem 1rem;
		color: var(--text-2);
	}

	.fl-ico {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--c-play-soft);
		color: var(--c-play);
	}

	.fl-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		color: var(--text);
		line-height: 1.3;
	}

	.fl-text span {
		font-size: 0.82rem;
		color: var(--text-2);
	}

	/* ── Coach ── */
	.coach-opt {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 14px;
		border: 1.5px solid var(--line);
		background: var(--surface-2);
		text-align: left;
		font: inherit;
		color: var(--text);
		cursor: pointer;
	}

	.coach-opt.on {
		border-color: color-mix(in srgb, var(--c-learn) 55%, transparent);
		background: var(--c-learn-soft);
	}

	.co-ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--c-learn);
		color: #fff;
	}

	.co-ico.small {
		width: 26px;
		height: 26px;
		border-radius: 8px;
	}

	.co-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	.co-text span {
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.switch {
		flex: none;
		position: relative;
		width: 44px;
		height: 26px;
		border-radius: 999px;
		background: var(--line-strong);
		transition: background-color var(--dur) var(--ease-out);
	}

	.switch span {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		box-shadow: var(--shadow-1);
		transition: transform var(--dur) var(--ease-spring);
	}

	.switch.on {
		background: var(--good);
	}

	.switch.on span {
		transform: translateX(18px);
	}

	/* in der mobilen Leiste: nur noch die Coach-Knöpfe (Text steht oben über dem Brett);
	   Platz dafür reserviert die Steuerleiste vorab, das Brett springt also nicht */
	:global(.docked) .coach-box {
		margin: 0;
		padding: 0;
	}

	:global(.docked) .cb-head,
	:global(.docked) .cb-ask {
		display: none;
	}

	:global(.docked) .controls {
		margin: 0;
		gap: 0.4rem;
	}

	:global(.docked) .ctl {
		flex-direction: row;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.6rem 0.2rem;
		border-radius: 999px;
		/* in der Kapsel: keine eigenen Kästchen */
		background: transparent;
	}

	:global(.docked) .ctl:active {
		background: var(--surface-2);
	}

	.coach-box {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.5rem;
		padding: 0.7rem 0.85rem;
		border-radius: 14px;
		background: var(--c-learn-soft);
		border: 1px solid color-mix(in srgb, var(--c-learn) 30%, transparent);
	}

	.coach-box.warn {
		background: color-mix(in srgb, var(--bad) 9%, var(--surface));
		border-color: color-mix(in srgb, var(--bad) 35%, transparent);
	}

	.cb-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cb-busy {
		margin-left: auto;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.cb-label {
		font-weight: 700;
		margin-right: 0.3rem;
	}

	.cb-opp,
	.cb-text {
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.cb-opp {
		color: var(--text-2);
	}

	.cb-warn {
		font-size: 0.9rem;
		font-weight: 650;
		color: var(--warn-text);
	}

	.cb-title {
		font-weight: 750;
		animation: rise 300ms var(--ease-out) both;
	}

	.cb-title.j-best,
	.cb-title.j-good {
		color: var(--good-text);
	}

	.cb-title.j-inaccuracy {
		color: var(--warn-text);
	}

	.cb-title.j-mistake,
	.cb-title.j-blunder {
		color: var(--bad);
	}

	.cb-link {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--accent);
		cursor: pointer;
	}

	.cb-tip {
		font-size: 0.86rem;
		line-height: 1.45;
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: var(--c-learn-soft);
		color: var(--text);
	}

	.cb-help {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: var(--surface-2);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.cb-help p {
		display: flex;
		gap: 0.35rem;
		align-items: flex-start;
	}

	.cb-ask {
		align-self: flex-start;
	}

	.cb-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}

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
		.start-bar {
			display: none !important;
		}
	}

	/* schmal: Farbe/Bedenkzeit oben, Start in der schwebenden Leiste unten */
	@media (max-width: 999px) {
		.friend-link {
			margin-bottom: 5.5rem;
		}
		.options {
			order: -1;
			padding: 1rem;
			gap: 0.85rem;
		}
		.options .chosen,
		.options :global(.btn.big) {
			display: none;
		}
	}

	@media (max-width: 599px) {
		.bots {
			grid-template-columns: 1fr 1fr !important;
			gap: 0.5rem !important;
		}
		.bot {
			flex-direction: column;
			gap: 0.55rem !important;
			padding: 0.75rem !important;
		}
		.bot-tag {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			font-size: 0.78rem;
		}
	}

	.start-bar {
		position: fixed;
		z-index: 40;
		/* bündig mit der Tab-Kapsel */
		left: max(12px, calc(var(--safe-left) + 8px));
		right: max(12px, calc(var(--safe-right) + 8px));
		bottom: calc(var(--tabbar-space) + 0.6rem);
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.55rem 0.55rem 0.7rem;
		border-radius: 20px;
		background: var(--surface-glass);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		border: 1px solid var(--line-strong);
		box-shadow: var(--shadow-2);
		animation: rise 360ms var(--ease-out) both;
	}

	@media (min-width: 768px) {
		.start-bar {
			left: calc(var(--sidebar-w) + 1.5rem);
			right: 1.5rem;
			bottom: calc(1rem + var(--safe-bottom));
			max-width: 560px;
		}
	}

	.sb-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.sb-text b {
		font-size: 0.98rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sb-text span {
		font-size: 0.8rem;
		font-weight: 650;
		color: hsl(var(--h) 60% var(--hue-text-l));
	}

	.start-bar .btn {
		padding-inline: 1.4rem;
		height: 46px;
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
		color: hsl(var(--h) 60% var(--hue-text-l));
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

	.cb-chance {
		font-size: 0.9rem;
		line-height: 1.4;
		color: var(--good-text);
	}

	.level-note {
		font-size: 0.82rem;
		color: var(--text-2);
		line-height: 1.35;
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
		border-radius: 999px;
		background: var(--surface-2);
	}

	.seg button {
		position: relative;
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 38px;
		border: none;
		border-radius: 999px;
		background: none;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text-2);
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out);
	}

	/* 44 px Tippfläche, Optik bleibt kompakt */
	.seg button::after {
		content: '';
		position: absolute;
		inset: -3px 0;
	}

	.seg button.on {
		background: var(--text);
		color: var(--bg);
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
		max-width: min(640px, calc(100svh - 210px));
		margin: 0 auto;
	}

	@media (min-width: 1000px) {
		.arena {
			grid-template-columns: minmax(0, 1fr) 300px;
			align-items: start;
		}
		.board-col {
			max-width: min(680px, calc(100svh - 150px));
		}
		.side {
			position: sticky;
			top: 2rem;
			height: min(560px, calc(100svh - 120px));
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
		font-family: var(--font-num);
		font-size: 1.15rem;
		font-weight: 600;
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

	/* Zug zurück · Zugliste · Zug vor – rechts in der eigenen Spielerzeile */
	.pnav {
		flex: none;
		display: flex;
		gap: 0.3rem;
		margin-left: auto;
	}

	.pn-btn {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.pn-btn:active:not(:disabled) {
		transform: scale(0.94);
	}

	.pn-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pn-btn.on {
		background: var(--text);
		color: var(--bg);
		border-color: var(--text);
	}

	/* beim Zurückblättern deutlich zeigen, dass man nicht die aktuelle Stellung sieht */
	.pnav.browsing .pn-btn:last-child {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}

	.status.viewing {
		color: var(--accent-strong);
		font-weight: 650;
		animation: none;
		white-space: nowrap;
	}

	/* Handy: unter dem Brett nur ein schlichter Link – keine Karte, die halb hinter der Leiste hängt */
	@media (max-width: 767px) {
		.side {
			background: none;
			border: none;
			box-shadow: none;
			padding: 0.2rem 0 0;
			align-items: center;
		}
	}

	.pinfo {
		min-width: 0;
	}

	/* Zugliste auf dem Handy: schwebt über der Leiste, verändert keine Höhen */
	.moves-pop {
		position: fixed;
		z-index: 44;
		left: max(0.6rem, var(--safe-left));
		right: max(0.6rem, var(--safe-right));
		bottom: calc(var(--tabbar-space) + var(--dock-h) + 1rem);
		max-height: 34dvh;
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		box-shadow: var(--shadow-2);
		animation: rise 220ms var(--ease-out) both;
	}

	.moves-backdrop {
		position: fixed;
		inset: 0;
		z-index: 43;
	}

	.mp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0 0.3rem 0.4rem;
	}

	.mp-close {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 50%;
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}

	@media (min-width: 768px) {
		/* am Desktop steht die Zugliste ohnehin daneben */
		.moves-backdrop,
		.moves-pop,
		.pn-btn.list {
			display: none;
		}
	}

	/* Handy: Zugliste nur auf Knopfdruck – nichts liegt mehr halb unter der Leiste */
	@media (max-width: 767px) {
		.side-moves {
			display: none;
		}
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
		color: var(--good-text);
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
		color: var(--good-text);
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
	/* Handy: Brett so groß, dass es neben der Aktionsleiste ganz sichtbar bleibt */
	@media (max-width: 767px) {
		.board-col {
			max-width: min(
				100%,
				calc(100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 130px)
			);
		}
		/* mit Coach: Kommentar steht über dem Brett (feste Höhe) */
		.board-col.with-bar {
			max-width: min(
				100%,
				calc(
					100svh - var(--dock-h) - var(--tabbar-space) - var(--safe-top) - 130px -
						var(--comment-h) - 0.5rem
				)
			);
		}
		/* Texte stehen oben im Kommentar – unten bleiben nur die Knöpfe */
		.coach-box .cb-head,
		.coach-box .cb-opp,
		.coach-box .cb-warn,
		.coach-box .cb-chance,
		.coach-box .cb-text,
		.coach-box .cb-title,
		.coach-box .cb-tip,
		.coach-box .cb-help,
		.coach-box .cb-link {
			display: none;
		}
		/* nach einem Fehler: „Zurücknehmen / Weiterspielen“ ersetzen die Knopfzeile –
		   die Leiste bleibt eine Zeile hoch */
		.controls.pending {
			display: none;
		}
		/* übrig bleiben nur Knöpfe: als ruhige Zeile ohne eigene Karte */
		.coach-box,
		.coach-box.warn {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.45rem;
			margin: 0;
			padding: 0;
			background: none;
			border: none;
		}
		.coach-box .cb-actions {
			margin: 0;
		}
	}
</style>
