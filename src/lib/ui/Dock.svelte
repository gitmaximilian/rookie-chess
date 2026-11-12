<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dock } from './dock.js';

	let {
		order = 0,
		mobileOnly = false,
		reserve = 0,
		class: cls = '',
		children
	}: {
		order?: number;
		mobileOnly?: boolean;
		/** Höhe (px), die die ganze Leiste von Anfang an reserviert */
		reserve?: number;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<!-- nur das innere Element wandert in die Leiste; die äußere Hülle bleibt für Svelte an ihrem Platz -->
<div class="dock-slot" class:mobile-only={mobileOnly}>
	<div class="dock-item {cls}" use:dock={{ order, mobileOnly, reserve }}>
		{@render children()}
	</div>
</div>

<style>
	.dock-slot {
		display: contents;
	}
</style>
