<script lang="ts">
	let { value, max, size = 56 }: { value: number; max: number; size?: number } = $props();

	const r = 22;
	const circ = 2 * Math.PI * r;
	const pct = $derived(Math.min(1, max > 0 ? value / max : 0));
</script>

<div class="ring" style:width="{size}px" style:height="{size}px">
	<svg viewBox="0 0 56 56" aria-hidden="true">
		<circle cx="28" cy="28" {r} class="track" />
		<circle
			cx="28"
			cy="28"
			{r}
			class="bar"
			stroke-dasharray={circ}
			stroke-dashoffset={circ * (1 - pct)}
		/>
	</svg>
	<span class="num">{value}/{max}</span>
	<span class="sr-only">{value} / {max}</span>
</div>

<style>
	.ring {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
	}

	svg {
		position: absolute;
		inset: 0;
		transform: rotate(-90deg);
	}

	circle {
		fill: none;
		stroke-width: 6;
		stroke-linecap: round;
	}

	.track {
		stroke: var(--surface-2);
	}

	.bar {
		stroke: var(--accent);
		transition: stroke-dashoffset 800ms var(--ease-out);
	}

	.num {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.82rem;
		color: var(--text-2);
	}
</style>
