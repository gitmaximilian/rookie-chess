<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<!-- „Bauer“: Der Bauer ist der Rookie unter den Figuren. Passt sich hell/dunkel an. -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.5" class="tile" />
	<g class="pawn">
		<circle cx="32" cy="19" r="7.5" />
		<rect x="23" y="28" width="18" height="5" rx="2.5" />
		<path d="M26.5 33h11l3.5 11h-18z" class="body" />
		<rect x="17" y="44" width="30" height="8" rx="4" />
	</g>
</svg>

<style>
	.tile {
		fill: var(--surface);
		stroke: var(--line-strong);
		stroke-width: 1.5;
	}

	.pawn {
		fill: var(--accent);
	}

	.body {
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
	}
</style>
