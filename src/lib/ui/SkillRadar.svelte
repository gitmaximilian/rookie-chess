<script lang="ts">
	import type { SkillValue } from '#lib/training/skills.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	/** Fünfeck-Profil der Fähigkeiten (0–100). Eine Datenreihe → keine Legende, Werte an den Ecken. */
	let { values }: { values: SkillValue[] } = $props();

	// breit genug für Beschriftungen links und rechts (z. B. „Mittelspiel“)
	const W = 380;
	const H = 290;
	const CX = W / 2;
	const CY = 148;
	const R = 92;
	const n = $derived(values.length);

	const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
	const pt = (i: number, r: number) => ({
		x: CX + Math.cos(angle(i)) * r,
		y: CY + Math.sin(angle(i)) * r
	});
	const ring = (f: number) =>
		Array.from({ length: n }, (_, i) => pt(i, R * f))
			.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
			.join(' ');

	const points = $derived(values.map((v, i) => pt(i, (R * (v.score ?? 0)) / 100)));
	const shape = $derived(points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

	/** Beschriftung außerhalb des Netzes, je nach Lage links/rechts/mittig ausgerichtet */
	const labels = $derived(
		values.map((_, i) => {
			const p = pt(i, R + 22);
			const c = Math.cos(angle(i));
			return { ...p, anchor: Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end' };
		})
	);

	function rawText(v: SkillValue): string {
		if (v.raw === null) return t('skills.noData');
		if (v.skill === 'tactics') return t('skills.rawTactics', { n: v.raw.toFixed(1) });
		if (v.skill === 'safety') return t('skills.rawBlunders', { n: v.raw.toFixed(1) });
		return t('skills.rawAccuracy', { n: v.raw });
	}

	let active = $state<number | null>(null);
</script>

<figure class="radar">
	<svg
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="{t('skills.title')}: {values
			.map((v) => `${t(`skills.name.${v.skill}`)} ${v.score ?? '–'}`)
			.join(', ')}"
	>
		<!-- Netz: zurückhaltend -->
		{#each [0.25, 0.5, 0.75, 1] as f (f)}
			<polygon class="grid" class:outer={f === 1} points={ring(f)} />
		{/each}
		{#each values as v, i (v.skill)}
			{@const p = pt(i, R)}
			<line class="spoke" x1={CX} y1={CY} x2={p.x} y2={p.y} />
		{/each}

		<polygon class="shape" points={shape} />

		{#each values as v, i (v.skill)}
			{@const p = points[i]}
			{@const l = labels[i]}
			<g
				class="vertex"
				class:on={active === i}
				role="button"
				tabindex="0"
				aria-label="{t(`skills.name.${v.skill}`)}: {v.score ?? '–'} / 100, {rawText(v)}"
				onpointerenter={() => (active = i)}
				onpointerleave={() => (active = null)}
				onfocus={() => (active = i)}
				onblur={() => (active = null)}
				onclick={() => (active = active === i ? null : i)}
				onkeydown={(e) => e.key === 'Escape' && (active = null)}
			>
				<!-- große, unsichtbare Trefferfläche -->
				<circle class="hit" cx={p.x} cy={p.y} r="22" />
				<circle class="dot" class:empty={v.score === null} cx={p.x} cy={p.y} r="5" />
				<text x={l.x} y={l.y - 6} text-anchor={l.anchor} class="lbl"
					>{t(`skills.name.${v.skill}`)}</text
				>
				<text x={l.x} y={l.y + 12} text-anchor={l.anchor} class="val"
					>{v.score === null ? '–' : v.score}</text
				>
			</g>
		{/each}
	</svg>

	{#if active !== null}
		{@const v = values[active]}
		{@const p = points[active]}
		<div
			class="tip"
			style:left="{Math.min(78, Math.max(22, (p.x / W) * 100))}%"
			style:top="{(p.y / H) * 100}%"
			role="status"
		>
			<b>{t(`skills.name.${v.skill}`)}</b>
			<span>{rawText(v)}</span>
		</div>
	{/if}
</figure>

<style>
	.radar {
		position: relative;
		margin: 0 auto;
		width: 100%;
		max-width: 420px;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.grid {
		fill: none;
		stroke: var(--line-strong);
		stroke-width: 1;
	}

	.grid.outer {
		fill: color-mix(in srgb, var(--text) 3%, transparent);
	}

	.spoke {
		stroke: var(--line);
		stroke-width: 1;
	}

	.shape {
		fill: color-mix(in srgb, var(--c-coach) 22%, transparent);
		stroke: var(--c-coach);
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.hit {
		fill: transparent;
	}

	.vertex {
		cursor: pointer;
		outline: none;
	}

	.dot {
		fill: var(--c-coach);
		stroke: var(--surface);
		stroke-width: 2;
		transition: r var(--dur-fast) var(--ease-out);
	}

	.dot.empty {
		fill: var(--surface);
		stroke: var(--text-3);
		stroke-dasharray: 2 2;
	}

	.vertex.on .dot,
	.vertex:focus-visible .dot {
		r: 7;
	}

	.vertex:focus-visible .lbl {
		text-decoration: underline;
	}

	.lbl {
		font-size: 12.5px;
		font-weight: 650;
		fill: var(--text-2);
	}

	.val {
		font-family: var(--font-num);
		font-size: 17px;
		font-weight: 500;
		fill: var(--text);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.tip {
		position: absolute;
		z-index: 3;
		transform: translate(-50%, calc(-100% - 12px));
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
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
