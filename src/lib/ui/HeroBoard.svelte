<script lang="ts">
	import ChessKing from '@lucide/svelte/icons/chess-king';
	import ChessRook from '@lucide/svelte/icons/chess-rook';
	import ChessPawn from '@lucide/svelte/icons/chess-pawn';

	// Dekoratives 5×5-Ausschnittsbrett: Grundreihenmatt mit dem Turm.
	const N = 5;
	const squares = Array.from({ length: N * N }, (_, i) => ({
		x: i % N,
		y: Math.floor(i / N),
		dark: ((i % N) + Math.floor(i / N)) % 2 === 1
	}));
</script>

<div class="board" aria-hidden="true">
	{#each squares as s (s.x + '-' + s.y)}
		<span class="sq" class:dark={s.dark} style:grid-column={s.x + 1} style:grid-row={s.y + 1}
		></span>
	{/each}

	<!-- schwarzer König hinter seinen Bauern -->
	<span class="pc black" style:grid-column="3" style:grid-row="1"><ChessKing /></span>
	<span class="pc black" style:grid-column="2" style:grid-row="2"><ChessPawn /></span>
	<span class="pc black" style:grid-column="3" style:grid-row="2"><ChessPawn /></span>
	<span class="pc black" style:grid-column="4" style:grid-row="2"><ChessPawn /></span>
	<!-- weißer Turm -->
	<span class="pc white rook" style:grid-column="1" style:grid-row="5"><ChessRook /></span>

	<!-- Zielfeld + Pfeil -->
	<span class="target" style:grid-column="1" style:grid-row="1"></span>
	<svg class="arrow" viewBox="0 0 5 5" preserveAspectRatio="none">
		<line x1="0.5" y1="4.3" x2="0.5" y2="1.25" />
		<polygon points="0.5,0.92 0.76,1.38 0.24,1.38" />
	</svg>
</div>

<style>
	.board {
		position: relative;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		grid-template-rows: repeat(5, 1fr);
		aspect-ratio: 1;
		border-radius: 18px;
		overflow: hidden;
		box-shadow:
			0 0 0 1px rgb(255 255 255 / 0.08),
			0 20px 50px rgb(0 0 0 / 0.45);
		transform: perspective(900px) rotateX(10deg) rotateZ(-4deg);
		animation: float 6s ease-in-out infinite;
	}

	.sq {
		background: #efe3cf;
	}
	.sq.dark {
		background: #b58863;
	}

	.pc {
		display: grid;
		place-items: center;
		z-index: 1;
	}

	.pc :global(svg) {
		width: 62%;
		height: 62%;
		stroke-width: 1.6;
	}

	.black :global(svg) {
		fill: #2a2420;
		stroke: #2a2420;
	}

	.white :global(svg) {
		fill: #fff;
		stroke: #2a2420;
	}

	.rook {
		animation: nudge 3.2s var(--ease-out) infinite;
	}

	.target {
		z-index: 1;
		margin: 10%;
		border-radius: 50%;
		border: 3px solid rgb(242 122 82 / 0.95);
		animation: ping 2.4s ease-out infinite;
	}

	.arrow {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 2;
		pointer-events: none;
	}
	.arrow line {
		stroke: rgb(242 122 82 / 0.9);
		stroke-width: 0.16;
		stroke-linecap: round;
	}
	.arrow polygon {
		fill: rgb(242 122 82 / 0.9);
	}

	@keyframes float {
		50% {
			transform: perspective(900px) rotateX(8deg) rotateZ(-2deg) translateY(-6px);
		}
	}
	@keyframes nudge {
		0%,
		60%,
		100% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(-8%);
		}
	}
	@keyframes ping {
		0% {
			box-shadow: 0 0 0 0 rgb(242 122 82 / 0.6);
		}
		100% {
			box-shadow: 0 0 0 14px rgb(242 122 82 / 0);
		}
	}
</style>
