<script lang="ts">
	import { whiteWin, type PlyEval } from '#lib/analysis/classify.js';
	import type { MoveReview } from '#lib/analysis/run.js';

	interface Props {
		evals: PlyEval[];
		total: number;
		current: number;
		reviews: MoveReview[];
		myColor?: 'white' | 'black';
		onSelect: (ply: number) => void;
	}

	let { evals, total, current, reviews, myColor = 'white', onSelect }: Props = $props();

	const W = 600;
	const H = 120;
	const x = (i: number) => (total <= 1 ? 0 : (i / (total - 1)) * W);
	const y = (e: PlyEval | undefined) => (e ? (1 - whiteWin(e)) * H : H / 2);

	const path = $derived.by(() => {
		if (!evals.length) return '';
		let d = `M0,${H / 2}`;
		evals.forEach((e, i) => (d += ` L${x(i).toFixed(1)},${y(e).toFixed(1)}`));
		d += ` L${x(evals.length - 1).toFixed(1)},${H} L0,${H} Z`;
		return d;
	});

	const marks = $derived(
		reviews.filter((r) => r.judgement === 'blunder' || r.judgement === 'mistake')
	);

	let svg: SVGSVGElement;
	function pick(e: PointerEvent) {
		const r = svg.getBoundingClientRect();
		const ply = Math.round(((e.clientX - r.left) / r.width) * (total - 1));
		onSelect(Math.max(0, Math.min(total - 1, ply)));
	}
</script>

<svg
	bind:this={svg}
	viewBox="0 0 {W} {H}"
	preserveAspectRatio="none"
	class="graph"
	role="slider"
	tabindex="0"
	aria-label="Bewertungsverlauf"
	aria-valuemin={0}
	aria-valuemax={total - 1}
	aria-valuenow={current}
	onpointerdown={pick}
	onpointermove={(e) => e.buttons === 1 && pick(e)}
>
	<rect width={W} height={H} class="bg" />
	<path d={path} class="area" />
	<line x1="0" x2={W} y1={H / 2} y2={H / 2} class="mid" />
	{#each marks as m (m.ply)}
		<circle
			cx={x(m.ply)}
			cy={y(evals[m.ply])}
			r="5"
			class="dot {m.judgement}"
			class:mine={m.mover === myColor}
		/>
	{/each}
	<line x1={x(current)} x2={x(current)} y1="0" y2={H} class="cursor" />
</svg>

<style>
	.graph {
		width: 100%;
		height: 92px;
		border-radius: 12px;
		cursor: pointer;
		touch-action: none;
		display: block;
	}

	.bg {
		fill: #3a3430;
	}

	.area {
		fill: #f4efe7;
		transition: d 300ms;
	}

	.mid {
		stroke: var(--accent);
		stroke-width: 1;
		opacity: 0.5;
		vector-effect: non-scaling-stroke;
	}

	.cursor {
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	.dot {
		stroke: #fff;
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
		opacity: 0.55;
	}

	.dot.mine {
		opacity: 1;
	}

	.dot.blunder {
		fill: var(--bad);
	}

	.dot.mistake {
		fill: #e07a1f;
	}
</style>
