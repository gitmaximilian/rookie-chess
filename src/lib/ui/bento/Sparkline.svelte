<script lang="ts">
	/**
	 * Mini-Verlauf für Kacheln. Linie in der Bereichsfarbe (--tone-ink, ≥ 3:1 auf Pastell),
	 * letzter Punkt hervorgehoben. Rein dekorativ – die Zahl steht daneben als Text.
	 */
	let {
		values,
		height = 36,
		fill = true,
		bars = false
	}: { values: number[]; height?: number; fill?: boolean; bars?: boolean } = $props();

	const W = 100;
	const pts = $derived.by(() => {
		const v = values.filter((x) => Number.isFinite(x));
		if (v.length < 2) return [];
		const min = Math.min(...v);
		const max = Math.max(...v);
		const span = max - min || 1;
		return v.map((x, i) => ({
			x: (i / (v.length - 1)) * W,
			y: 4 + (1 - (x - min) / span) * (height - 8)
		}));
	});
	const line = $derived(pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
	const last = $derived(pts.at(-1));
	const barW = $derived(values.length ? W / values.length : 0);
	const barMax = $derived(Math.max(1, ...values));
</script>

<span class="wrap">
	{#if bars && values.length}
		<svg
			class="spark"
			viewBox="0 0 {W} {height}"
			preserveAspectRatio="none"
			style:height="{height}px"
			aria-hidden="true"
		>
			{#each values as v, i (i)}
				{@const h = Math.max(2, (v / barMax) * (height - 2))}
				<rect
					x={i * barW + barW * 0.15}
					y={height - h}
					width={barW * 0.7}
					height={h}
					rx="1.5"
					class:empty={v === 0}
				/>
			{/each}
		</svg>
	{:else if pts.length}
		<svg
			class="spark"
			viewBox="0 0 {W} {height}"
			preserveAspectRatio="none"
			style:height="{height}px"
			aria-hidden="true"
		>
			{#if fill}
				<polygon class="area" points="0,{height} {line} {W},{height}" />
			{/if}
			<polyline points={line} />
		</svg>
		{#if last}
			<span
				class="dot"
				style:left="calc({last.x}% - 4px)"
				style:top="{last.y - 4}px"
				aria-hidden="true"
			></span>
		{/if}
	{/if}
</span>

<style>
	.wrap {
		position: relative;
		display: block;
	}

	.spark {
		display: block;
		width: 100%;
		overflow: visible;
	}

	polyline {
		fill: none;
		stroke: var(--tone-ink, var(--accent));
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	.area {
		fill: color-mix(in srgb, var(--tone-ink, var(--accent)) 14%, transparent);
	}

	rect {
		fill: var(--tone-ink, var(--accent));
	}

	rect.empty {
		fill: color-mix(in srgb, var(--tone-ink, var(--accent)) 25%, transparent);
	}

	.dot {
		position: absolute;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--tone-ink, var(--accent));
		box-shadow: 0 0 0 2px var(--tone-bg, var(--surface));
	}
</style>
