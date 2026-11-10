<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<!-- Bauer im Glut-Quadrat: „vom Bauern zur Dame“ -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<defs>
		<linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#f27a52" />
			<stop offset="1" stop-color="#d9442c" />
		</linearGradient>
	</defs>
	<rect width="64" height="64" rx="16" fill="url(#logo-g)" />
	<g fill="#fff">
		<circle cx="32" cy="20.5" r="7.5" />
		<path d="M25.5 30h13l2.6 14h-18.2z" />
		<rect x="18" y="45" width="28" height="6.5" rx="3.25" />
	</g>
</svg>
