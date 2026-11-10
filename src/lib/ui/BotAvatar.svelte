<script lang="ts">
	import ChessPawn from '@lucide/svelte/icons/chess-pawn';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import ChessBishop from '@lucide/svelte/icons/chess-bishop';
	import ChessRook from '@lucide/svelte/icons/chess-rook';
	import ChessQueen from '@lucide/svelte/icons/chess-queen';
	import ChessKing from '@lucide/svelte/icons/chess-king';
	import type { Bot } from '#lib/bots/bots.js';

	let {
		bot,
		size = 48,
		thinking = false
	}: { bot: Bot; size?: number; thinking?: boolean } = $props();

	const icons = {
		pawn: ChessPawn,
		knight: ChessKnight,
		bishop: ChessBishop,
		rook: ChessRook,
		queen: ChessQueen,
		king: ChessKing
	};
	const Icon = $derived(icons[bot.piece]);
</script>

<span
	class="avatar"
	class:thinking
	style:--h={bot.hue}
	style:width="{size}px"
	style:height="{size}px"
	aria-hidden="true"
>
	<Icon size={size * 0.52} strokeWidth={2} />
</span>

<style>
	.avatar {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 32%;
		color: #fff;
		background: linear-gradient(145deg, hsl(var(--h) 75% 62%), hsl(calc(var(--h) + 18) 70% 46%));
		box-shadow: 0 6px 16px hsl(var(--h) 70% 45% / 0.3);
	}

	.avatar::after {
		content: '';
		position: absolute;
		inset: -4px;
		border-radius: 36%;
		border: 2px solid hsl(var(--h) 75% 55%);
		opacity: 0;
	}

	.thinking::after {
		animation: think 1.2s ease-in-out infinite;
	}

	@keyframes think {
		0% {
			opacity: 0.8;
			transform: scale(0.95);
		}
		100% {
			opacity: 0;
			transform: scale(1.15);
		}
	}
</style>
