<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let { n, size = 16, animate = false }: { n: number; size?: number; animate?: boolean } = $props();
</script>

<span class="stars" class:animate role="img" aria-label={t('endgame.stars', { n })}>
	{#each [1, 2, 3] as i (i)}
		<span class="s" class:on={i <= n} style:--d="{i * 140}ms">
			<Star {size} strokeWidth={2} />
		</span>
	{/each}
</span>

<style>
	.stars {
		display: inline-flex;
		gap: 2px;
	}

	.s {
		display: inline-grid;
		color: var(--line-strong);
	}

	.s.on {
		color: var(--warn);
	}

	.s.on :global(svg) {
		fill: currentColor;
	}

	.animate .s.on {
		animation: pop 520ms var(--ease-spring) both;
		animation-delay: var(--d);
	}

	@keyframes pop {
		from {
			transform: scale(0.2) rotate(-40deg);
			opacity: 0;
		}
	}
</style>
