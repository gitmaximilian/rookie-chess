<script lang="ts">
	/**
	 * Skill-Penta (lib/training/skills.ts): fünf Fähigkeiten auf 0–100, 100 = Weltspitze.
	 * Ecken sind antippbar (Auswahl über `selected`/`onSelect`); dazu Ringe für die Etappen bis 1600
	 * und ein gestrichelter Ring für das eigene Gesamtniveau.
	 */
	import { scoreFor, type Skill, type SkillValue } from '#lib/training/skills.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let {
		values,
		selected = null,
		overall = null,
		onSelect
	}: {
		values: SkillValue[];
		selected?: Skill | null;
		/** Gesamtniveau (Punkte 0–100) als gestrichelter Ring */
		overall?: number | null;
		onSelect?: (s: Skill) => void;
	} = $props();

	const W = 380;
	const H = 300;
	const CX = W / 2;
	const CY = 152;
	const R = 96;
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

	/** Etappen-Ringe: 1000, 1600 (Ziel der App), 2800 = außen */
	const MILESTONE_RINGS = [scoreFor(1000) / 100, scoreFor(1600) / 100];

	const points = $derived(values.map((v, i) => pt(i, (R * (v.score ?? 0)) / 100)));
	const shape = $derived(points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

	const labels = $derived(
		values.map((_, i) => {
			const p = pt(i, R + 24);
			const c = Math.cos(angle(i));
			return { ...p, anchor: Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end' };
		})
	);

	function pick(s: Skill) {
		onSelect?.(s);
	}
</script>

<figure class="radar">
	<svg
		viewBox="0 0 {W} {H}"
		role="group"
		aria-label="{t('skills.title')}: {values
			.map((v) => `${t(`skills.name.${v.skill}`)} ${v.score ?? '–'}`)
			.join(', ')}"
	>
		{#each [0.25, 0.5, 0.75, 1] as f (f)}
			<polygon class="grid" class:outer={f === 1} points={ring(f)} />
		{/each}
		{#each MILESTONE_RINGS as f (f)}
			<polygon class="milestone" points={ring(f)} />
		{/each}
		{#if overall !== null}
			<polygon class="overall" points={ring(overall / 100)} />
		{/if}
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
				class:on={selected === v.skill}
				role="button"
				tabindex="0"
				aria-pressed={selected === v.skill}
				aria-label="{t(`skills.name.${v.skill}`)}: {v.score ?? '–'} / 100"
				data-testid="skill-{v.skill}"
				onclick={() => pick(v.skill)}
				onkeydown={(e) =>
					(e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(v.skill))}
			>
				<!-- große, unsichtbare Trefferfläche über Punkt und Beschriftung -->
				<circle class="hit" cx={p.x} cy={p.y} r="20" />
				<circle class="hit" cx={l.x} cy={l.y} r="30" />
				<circle class="dot" class:empty={v.score === null} cx={p.x} cy={p.y} r="5" />
				<text x={l.x} y={l.y - 6} text-anchor={l.anchor} class="lbl"
					>{t(`skills.name.${v.skill}`)}</text
				>
				<text x={l.x} y={l.y + 13} text-anchor={l.anchor} class="val"
					>{v.score === null ? '–' : v.score}</text
				>
			</g>
		{/each}
	</svg>
	<figcaption class="legend">
		<span><i class="lg-shape"></i>{t('skills.legendYou')}</span>
		{#if overall !== null}<span><i class="lg-overall"></i>{t('skills.legendOverall')}</span>{/if}
		<span><i class="lg-milestone"></i>{t('skills.legendRings')}</span>
	</figcaption>
</figure>

<style>
	.radar {
		margin: 0 auto;
		width: 100%;
		max-width: 440px;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.grid {
		fill: none;
		stroke: var(--line);
		stroke-width: 1;
	}

	.grid.outer {
		fill: color-mix(in srgb, var(--text) 3%, transparent);
		stroke: var(--line-strong);
	}

	.milestone {
		fill: none;
		stroke: var(--c-learn);
		stroke-opacity: 0.55;
		stroke-width: 1.25;
	}

	.overall {
		fill: none;
		stroke: var(--text-2);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
	}

	.spoke {
		stroke: var(--line);
		stroke-width: 1;
	}

	.shape {
		fill: color-mix(in srgb, var(--c-coach) 24%, transparent);
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
		r: 8;
	}

	.vertex.on .lbl {
		fill: var(--text);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.vertex:focus-visible .lbl {
		text-decoration: underline;
	}

	.lbl {
		font-size: 13px;
		font-weight: 650;
		fill: var(--text-2);
	}

	.val {
		font-family: var(--font-num);
		font-size: 18px;
		font-weight: 500;
		fill: var(--text);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.3rem 0.9rem;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.legend i {
		display: inline-block;
		width: 16px;
		height: 0;
		border-top: 2px solid;
	}

	.lg-shape {
		border-color: var(--c-coach) !important;
	}

	.lg-overall {
		border-top-style: dashed !important;
		border-color: var(--text-2) !important;
	}

	.lg-milestone {
		border-color: var(--c-learn) !important;
		opacity: 0.7;
	}
</style>
