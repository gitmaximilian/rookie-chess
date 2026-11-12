<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	export interface AccPoint {
		id: number;
		date: number;
		accuracy: number;
		opponent: string;
		result: 'w' | 'd' | 'l';
	}

	/** Genauigkeit der letzten Partien (älteste links). Eine Reihe, eine Achse 0–100 %. */
	let { points }: { points: AccPoint[] } = $props();

	const W = 340;
	const H = 170;
	const PAD = { l: 30, r: 8, t: 12, b: 18 };
	const iw = W - PAD.l - PAD.r;
	const ih = H - PAD.t - PAD.b;

	// y-Achse: 40–100 %, darunter wird es für Anfänger ohnehin nicht interessant
	const MIN = 40;
	const y = (a: number) => PAD.t + ih - ((Math.max(MIN, a) - MIN) / (100 - MIN)) * ih;

	const slot = $derived(points.length ? iw / points.length : iw);
	const bw = $derived(Math.min(24, Math.max(4, slot - 2)));
	const avg = $derived(
		points.length ? Math.round(points.reduce((s, p) => s + p.accuracy, 0) / points.length) : 0
	);

	/** Säule mit 4px-Rundung oben, gerade an der Grundlinie */
	function bar(i: number, a: number): string {
		const x = PAD.l + i * slot + (slot - bw) / 2;
		const top = y(a);
		const base = PAD.t + ih;
		const r = Math.min(4, bw / 2, base - top);
		return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`;
	}

	let active = $state<number | null>(null);
	const fmt = (ms: number) =>
		new Date(ms).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
	const resultText = (r: AccPoint['result']) =>
		t(`analysis.result.${r === 'w' ? 'win' : r === 'l' ? 'loss' : 'draw'}`);
</script>

<figure class="trend">
	<svg
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label={t('skills.trendAria', { n: points.length, avg })}
	>
		{#each [50, 75, 100] as g (g)}
			<line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} />
			<text class="axis" x={PAD.l - 6} y={y(g) + 4} text-anchor="end">{g}</text>
		{/each}
		<line class="base" x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} />

		{#each points as p, i (p.id)}
			<g
				class="col"
				class:on={active === i}
				role="link"
				tabindex="0"
				aria-label="{fmt(p.date)}, {p.opponent}, {resultText(p.result)}, {p.accuracy}%"
				onpointerenter={() => (active = i)}
				onpointerleave={() => (active = null)}
				onfocus={() => (active = i)}
				onblur={() => (active = null)}
				onclick={() => goto(resolve(`/analysis?game=${p.id}`))}
				onkeydown={(e) => e.key === 'Enter' && goto(resolve(`/analysis?game=${p.id}`))}
			>
				<rect class="hit" x={PAD.l + i * slot} y={PAD.t} width={slot} height={ih} />
				<path class="bar" d={bar(i, p.accuracy)} />
			</g>
		{/each}

		<!-- Durchschnitt als einzige Bezugslinie, direkt beschriftet -->
		<line class="avg" x1={PAD.l} x2={W - PAD.r} y1={y(avg)} y2={y(avg)} />
		<text class="avg-l" x={W - PAD.r} y={y(avg) - 5} text-anchor="end">Ø {avg}%</text>
	</svg>

	{#if active !== null}
		{@const p = points[active]}
		<div
			class="tip"
			style:left="{Math.min(80, Math.max(20, ((PAD.l + (active + 0.5) * slot) / W) * 100))}%"
			style:top="{(y(p.accuracy) / H) * 100}%"
			role="status"
		>
			<b>{p.accuracy}%</b>
			<span>{p.opponent} · {resultText(p.result)} · {fmt(p.date)}</span>
		</div>
	{/if}
</figure>

<style>
	.trend {
		position: relative;
		margin: 0;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}

	.base {
		stroke: var(--line-strong);
		stroke-width: 1;
	}

	.axis {
		font-size: 10px;
		fill: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.hit {
		fill: transparent;
	}

	.col {
		cursor: pointer;
		outline: none;
	}

	.bar {
		fill: color-mix(in srgb, var(--c-coach) 75%, transparent);
		transition: fill var(--dur-fast) var(--ease-out);
	}

	.col.on .bar,
	.col:focus-visible .bar {
		fill: var(--c-coach);
	}

	.avg {
		stroke: var(--text-2);
		stroke-width: 1.5;
		stroke-dasharray: 4 4;
	}

	.avg-l {
		font-size: 11px;
		font-weight: 700;
		fill: var(--text-2);
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 4px;
	}

	.tip {
		position: absolute;
		z-index: 3;
		transform: translate(-50%, calc(-100% - 10px));
		display: flex;
		flex-direction: column;
		padding: 0.4rem 0.6rem;
		border-radius: 10px;
		background: var(--text);
		color: var(--bg);
		font-size: 0.8rem;
		white-space: nowrap;
		pointer-events: none;
		box-shadow: var(--shadow-2);
	}

	.tip span {
		opacity: 0.8;
	}
</style>
