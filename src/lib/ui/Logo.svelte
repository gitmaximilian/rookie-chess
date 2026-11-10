<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<!-- Turm im Glut-Quadrat: Rookie = Anfänger + rook (Turm) -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<defs>
		<linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#f27a52" />
			<stop offset="1" stop-color="#d9442c" />
		</linearGradient>
	</defs>
	<rect width="64" height="64" rx="16" fill="url(#logo-g)" />
	<g fill="#fff">
		<path
			d="M20 13.5h5.5v4.5h3.75v-4.5h5.5v4.5h3.75v-4.5H44v9.5a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 20 23z"
		/>
		<path d="M25.5 28.5h13l2 15h-17z" />
		<rect x="18" y="45.5" width="28" height="6.5" rx="3.25" />
	</g>
</svg>
