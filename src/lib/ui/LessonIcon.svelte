<script lang="ts">
	import ChessQueen from '@lucide/svelte/icons/chess-queen';
	import ChessRook from '@lucide/svelte/icons/chess-rook';
	import ChessPawn from '@lucide/svelte/icons/chess-pawn';
	import ChessKing from '@lucide/svelte/icons/chess-king';
	import Castle from '@lucide/svelte/icons/castle';
	import Route from '@lucide/svelte/icons/route';
	import Shield from '@lucide/svelte/icons/shield';
	import type { Lesson } from '#lib/endgames/lessons.js';

	let { icon, size = 24 }: { icon: Lesson['icon']; size?: number } = $props();

	const map = {
		queen: ChessQueen,
		rook: ChessRook,
		rooks: Castle,
		pawn: ChessPawn,
		king: ChessKing,
		bridge: Route,
		shield: Shield
	};
	const Icon = $derived(map[icon]);
</script>

<Icon {size} strokeWidth={2} />
