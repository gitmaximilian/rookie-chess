<script lang="ts">
	import { intlLocale } from '#lib/i18n/i18n.svelte.js';

	let { points }: { points: { date: number; rating: number }[] } = $props();

	// schmaler viewBox: Linie und Schrift bleiben auf dem iPhone gut lesbar
	const W = 360;
	const H = 150;
	const PAD = { l: 34, r: 10, t: 10, b: 14 };

	const min = $derived(Math.floor((Math.min(...points.map((p) => p.rating)) - 20) / 50) * 50);
	const max = $derived(Math.ceil((Math.max(...points.map((p) => p.rating)) + 20) / 50) * 50);
	const x = (i: number) =>
		PAD.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
	const y = (r: number) => PAD.t + (1 - (r - min) / Math.max(1, max - min)) * (H - PAD.t - PAD.b);

	const line = $derived(
		points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ')
	);
	const area = $derived(
		points.length
			? `${line} L${x(points.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`
			: ''
	);
	const ticks = $derived([min, Math.round((min + max) / 2 / 10) * 10, max]);

	let hover = $state<number | null>(null);
	let svg: SVGSVGElement;

	function onMove(e: PointerEvent) {
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
		hover = Math.max(0, Math.min(points.length - 1, i));
	}

	const fmt = (d: number) =>
		new Date(d).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
</script>

<div class="chart">
	<svg
		bind:this={svg}
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="Rating {points.at(-1)?.rating ?? ''}"
		onpointermove={onMove}
		onpointerleave={() => (hover = null)}
	>
		<defs>
			<linearGradient id="rc-fill" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="var(--c-puzzle)" stop-opacity="0.22" />
				<stop offset="1" stop-color="var(--c-puzzle)" stop-opacity="0" />
			</linearGradient>
		</defs>
		{#each ticks as tk (tk)}
			<line x1={PAD.l} x2={W - PAD.r} y1={y(tk)} y2={y(tk)} class="grid" />
			<text x={PAD.l - 6} y={y(tk) + 4} class="tick" text-anchor="end">{tk}</text>
		{/each}
		<path d={area} fill="url(#rc-fill)" />
		<path d={line} class="line" />
		{#if points.length}
			<circle cx={x(points.length - 1)} cy={y(points.at(-1)!.rating)} r="4.5" class="end" />
		{/if}
		{#if hover !== null}
			<line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} class="cross" />
			<circle cx={x(hover)} cy={y(points[hover].rating)} r="5" class="end" />
		{/if}
	</svg>
	{#if hover !== null}
		<div class="tip" style:left="{(x(hover) / W) * 100}%">
			<b>{points[hover].rating}</b>
			<span>{fmt(points[hover].date)}</span>
		</div>
	{/if}
</div>

<style>
	.chart {
		position: relative;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		touch-action: pan-y;
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}

	.tick {
		fill: var(--text-3);
		font-size: 10px;
		font-family: var(--font-body);
	}

	.line {
		vector-effect: non-scaling-stroke;
		fill: none;
		stroke: var(--c-puzzle);
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.end {
		fill: var(--c-puzzle);
		stroke: var(--surface);
		stroke-width: 2;
	}

	.cross {
		stroke: var(--text-3);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.tip {
		position: absolute;
		top: -6px;
		transform: translate(-50%, -100%);
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
		padding: 0.3rem 0.6rem;
		border-radius: 8px;
		background: var(--text);
		color: var(--bg);
		font-size: 0.8rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.tip span {
		opacity: 0.75;
	}
</style>
