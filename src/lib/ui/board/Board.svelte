<script lang="ts" module>
	export type Shape = {
		orig: string;
		dest?: string;
		brush?: 'hint' | 'good' | 'bad' | 'info' | 'mine';
	};
</script>

<script lang="ts">
	import 'chessground/assets/chessground.base.css';
	import 'chessground/assets/chessground.cburnett.css';
	import './board.css';
	import { onDestroy, onMount } from 'svelte';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { Chessground } from 'chessground';
	import type { Api } from 'chessground/api';
	import type { Key, Color } from 'chessground/types';
	import type { DrawShape } from 'chessground/draw';

	interface Props {
		fen: string;
		orientation?: Color;
		turnColor?: Color;
		lastMove?: [string, string];
		check?: boolean;
		/** Erlaubte Züge; leer/undefined = keine Eingabe */
		dests?: Map<string, string[]>;
		movableColor?: Color | 'both';
		viewOnly?: boolean;
		shapes?: Shape[];
		coordinates?: boolean;
		/** Wird für Bauernumwandlungen gefragt */
		isPromotion?: (from: string, to: string) => boolean;
		onMove?: (uci: string) => void;
		/** Zusätzliche CSS-Klasse für Rückmeldungen (z. B. 'flash-good') */
		flash?: '' | 'good' | 'bad';
		label?: string;
	}

	let {
		fen,
		orientation = 'white',
		turnColor,
		lastMove,
		check = false,
		dests,
		movableColor,
		viewOnly = false,
		shapes = [],
		coordinates = true,
		isPromotion,
		onMove,
		flash = '',
		label
	}: Props = $props();

	let el: HTMLDivElement;
	let cg: Api | null = null;
	let promo = $state<{ from: string; to: string; color: Color } | null>(null);

	const brushes = {
		green: { key: 'g', color: '#2b9a66', opacity: 0.85, lineWidth: 10 },
		red: { key: 'r', color: '#d64545', opacity: 0.85, lineWidth: 10 },
		blue: { key: 'b', color: '#3b82c4', opacity: 0.8, lineWidth: 10 },
		yellow: { key: 'y', color: '#e0a526', opacity: 0.85, lineWidth: 10 },
		paleBlue: { key: 'pb', color: '#3b82c4', opacity: 0.4, lineWidth: 15 },
		paleGreen: { key: 'pg', color: '#2b9a66', opacity: 0.4, lineWidth: 15 },
		paleRed: { key: 'pr', color: '#d64545', opacity: 0.4, lineWidth: 15 },
		paleGrey: { key: 'pgr', color: '#4a4a4a', opacity: 0.35, lineWidth: 15 },
		purple: { key: 'purple', color: '#6d5bf0', opacity: 0.65, lineWidth: 15 },
		pink: { key: 'pink', color: '#ee2080', opacity: 0.5, lineWidth: 15 },
		white: { key: 'white', color: 'white', opacity: 1, lineWidth: 15 },
		hint: { key: 'hint', color: '#e2583e', opacity: 0.9, lineWidth: 11 },
		good: { key: 'good', color: '#2b9a66', opacity: 0.9, lineWidth: 11 },
		bad: { key: 'bad', color: '#d64545', opacity: 0.85, lineWidth: 11 },
		info: { key: 'info', color: '#6d5bf0', opacity: 0.8, lineWidth: 11 },
		mine: { key: 'mine', color: '#13907f', opacity: 0.85, lineWidth: 11 }
	};

	function toDrawShapes(s: Shape[]): DrawShape[] {
		return s.map((x) => ({
			orig: x.orig as Key,
			dest: x.dest as Key | undefined,
			brush: x.brush ?? 'hint'
		}));
	}

	function config() {
		const canMove = !viewOnly && !!dests && dests.size > 0 && !promo;
		return {
			fen,
			orientation,
			turnColor,
			lastMove: lastMove as Key[] | undefined,
			check: check ? turnColor : false,
			coordinates,
			viewOnly,
			movable: {
				free: false,
				color: canMove ? (movableColor ?? turnColor) : undefined,
				dests: (canMove ? dests : new Map()) as Map<Key, Key[]>,
				showDests: true
			},
			drawable: { autoShapes: toDrawShapes(shapes) }
		};
	}

	onMount(() => {
		cg = Chessground(el, {
			...config(),
			animation: { enabled: true, duration: 220 },
			highlight: { lastMove: true, check: true },
			premovable: { enabled: false },
			draggable: { enabled: true, showGhost: true, distance: 3 },
			blockTouchScroll: true,
			addDimensionsCssVarsTo: el,
			drawable: { enabled: true, brushes, autoShapes: toDrawShapes(shapes) },
			movable: {
				...config().movable,
				events: {
					after: (orig: Key, dest: Key) => {
						if (isPromotion?.(orig, dest)) {
							const piece = cg?.state.pieces.get(dest);
							promo = { from: orig, to: dest, color: piece?.color ?? 'white' };
							return;
						}
						onMove?.(orig + dest);
					}
				}
			}
		});
	});

	$effect(() => {
		// Abhängigkeiten registrieren
		void [
			fen,
			orientation,
			turnColor,
			lastMove,
			check,
			dests,
			movableColor,
			viewOnly,
			shapes,
			coordinates
		];
		if (cg) cg.set(config());
	});

	onDestroy(() => cg?.destroy());

	function choose(role: 'q' | 'r' | 'b' | 'n') {
		if (!promo) return;
		const uci = promo.from + promo.to + role;
		promo = null;
		onMove?.(uci);
	}

	function cancelPromo() {
		promo = null;
		cg?.set(config());
	}

	const promoRoles = [
		{ r: 'q', name: 'queen' },
		{ r: 'r', name: 'rook' },
		{ r: 'b', name: 'bishop' },
		{ r: 'n', name: 'knight' }
	] as const;
</script>

<div class="board-shell" class:flash-good={flash === 'good'} class:flash-bad={flash === 'bad'}>
	<div class="board-sizer">
		<div
			bind:this={el}
			class="cg-host"
			data-fen={fen}
			data-orientation={orientation}
			role="application"
			aria-label={label ?? t('board.label')}
		></div>
	</div>

	{#if promo}
		<div class="promo-backdrop" role="presentation" onclick={cancelPromo}></div>
		<div class="promo" role="dialog" aria-label={t('board.promoteDialog')}>
			<p>{t('board.promote')}</p>
			<div class="promo-row">
				{#each promoRoles as p (p.r)}
					<button
						class="promo-btn cg-wrap"
						onclick={() => choose(p.r)}
						aria-label={t(`board.roles.${p.r}`)}
						title={t(`board.roles.${p.r}`)}
					>
						<piece class="{p.name} {promo.color}"></piece>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.board-shell {
		position: relative;
		width: 100%;
		border-radius: 14px;
		box-shadow:
			0 0 0 1px rgb(28 26 23 / 0.06),
			0 10px 30px rgb(28 26 23 / 0.12);
		transition: box-shadow 400ms var(--ease-out);
	}

	.board-sizer {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 14px;
		overflow: hidden;
	}

	.cg-host {
		position: absolute;
		inset: 0;
	}

	.flash-good {
		box-shadow:
			0 0 0 3px var(--good),
			0 10px 40px color-mix(in srgb, var(--good) 35%, transparent);
	}

	.flash-bad {
		box-shadow:
			0 0 0 3px var(--bad),
			0 10px 40px color-mix(in srgb, var(--bad) 30%, transparent);
		animation: shake 360ms var(--ease-out);
	}

	@keyframes shake {
		20% {
			transform: translateX(-6px);
		}
		40% {
			transform: translateX(5px);
		}
		60% {
			transform: translateX(-3px);
		}
		80% {
			transform: translateX(2px);
		}
	}

	.promo-backdrop {
		position: absolute;
		inset: 0;
		z-index: 20;
		border-radius: 14px;
		background: rgb(20 18 16 / 0.35);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		animation: fade 160ms ease-out;
	}

	.promo {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 21;
		transform: translate(-50%, -50%);
		padding: 0.9rem 1rem 1rem;
		border-radius: 20px;
		background: var(--surface);
		box-shadow: var(--shadow-2);
		text-align: center;
		animation: pop 260ms var(--ease-spring);
	}

	.promo p {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text-2);
		margin-bottom: 0.6rem;
	}

	.promo-row {
		display: flex;
		gap: 0.5rem;
	}

	.promo-btn {
		position: relative;
		width: 64px;
		height: 64px;
		border: none;
		border-radius: 14px;
		background: var(--surface-2);
		cursor: pointer;
		transition:
			transform var(--dur-fast) var(--ease-out),
			background-color var(--dur) var(--ease-out);
	}

	.promo-btn:hover {
		background: var(--accent-soft);
	}

	.promo-btn:active {
		transform: scale(0.92);
	}

	.promo-btn piece {
		position: absolute;
		inset: 6px;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translate(-50%, -46%) scale(0.92);
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
