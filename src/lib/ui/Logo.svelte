<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<!-- „Linie“: Turm als Kontur – Rookie = Anfänger + rook (Turm). Passt sich hell/dunkel an. -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.5" class="tile" />
	<g class="rook">
		<path
			d="M20 13.5h5.5v4.5h3.75v-4.5h5.5v4.5h3.75v-4.5H44v9.5a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 20 23z"
		/>
		<path d="M25.5 28.5h13l2 15h-17z" />
		<rect x="18" y="45.5" width="28" height="6.5" rx="3.25" />
	</g>
</svg>

<style>
	.tile {
		fill: var(--surface);
		stroke: var(--line-strong);
		stroke-width: 1.5;
	}

	.rook {
		fill: none;
		stroke: var(--accent);
		stroke-width: 3;
		stroke-linejoin: round;
	}
</style>
