<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<!-- „Glut-Kachel“: weißer Bauer auf Korall mit Unterkante wie die drückbaren Buttons -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<rect width="64" height="64" rx="15" class="edge" />
	<rect width="64" height="59" rx="15" class="tile" />
	<g class="pawn" transform="translate(32 30.5) scale(0.9) translate(-32 -35.5)">
		<circle cx="32" cy="19" r="7.5" />
		<rect x="23" y="28" width="18" height="5" rx="2.5" />
		<path d="M26.5 33h11l3.5 11h-18z" class="body" />
		<rect x="17" y="44" width="30" height="8" rx="4" />
	</g>
</svg>

<style>
	.edge {
		fill: #c0432a;
	}

	.tile {
		fill: #e2583e;
	}

	.pawn {
		fill: #fff;
	}

	.body {
		stroke: #fff;
		stroke-width: 2;
		stroke-linejoin: round;
	}
</style>
