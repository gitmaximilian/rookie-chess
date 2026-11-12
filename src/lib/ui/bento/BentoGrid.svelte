<script lang="ts">
	/**
	 * Responsives Bento-Raster: 2 Spalten auf dem iPhone, 4 ab Tablet.
	 * Kinder steuern ihre Breite über data-size (s · m · l · full), siehe app.css.
	 */
	import type { Snippet } from 'svelte';
	let {
		children,
		label,
		dense = true,
		testid
	}: { children: Snippet; label?: string; dense?: boolean; testid?: string } = $props();
</script>

<section class="bento" class:dense aria-label={label} data-testid={testid}>
	{@render children()}
</section>
