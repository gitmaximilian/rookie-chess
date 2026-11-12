<script lang="ts" module>
	export type Tone = 'play' | 'games' | 'coach' | 'puzzle' | 'learn' | 'stars' | 'neutral';
	export type TileSize = 's' | 'm' | 'l' | 'full';
</script>

<script lang="ts">
	/**
	 * Kennzahl-Kachel: EINE Zahl, groß und in Monospace, mit Label, Zusatzzeile
	 * und optionalem Mini-Verlauf. Größe steuert die Spaltenbreite im BentoGrid.
	 */
	import type { Snippet } from 'svelte';
	import Sparkline from './Sparkline.svelte';

	let {
		tone = 'neutral',
		size = 's',
		label,
		value = null,
		unit = '',
		sub = '',
		delta = null,
		deltaUnit = '',
		href,
		spark,
		bars = false,
		muted = false,
		testid,
		aria,
		children,
		badge
	}: {
		tone?: Tone;
		size?: TileSize;
		label: string;
		value?: string | number | null;
		unit?: string;
		sub?: string;
		/** Veränderung (positiv = besser) */
		delta?: number | null;
		deltaUnit?: string;
		href?: string;
		spark?: number[];
		bars?: boolean;
		/** Platzhalter-Wert (z. B. „–“) dezent */
		muted?: boolean;
		testid?: string;
		aria?: string;
		children?: Snippet;
		badge?: Snippet;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="tile tone-{tone} size-{size}"
	class:link={!!href}
	data-size={size}
	data-testid={testid}
	aria-label={aria}
>
	<span class="head">
		<span class="mono-label lbl">{label}</span>
		{#if badge}{@render badge()}{/if}
	</span>
	{#if value !== null}
		<span class="val num" class:muted
			>{value}{#if unit}<small>{unit}</small>{/if}</span
		>
	{/if}
	{#if children}<span class="body">{@render children()}</span>{/if}
	{#if spark && spark.length > 1}
		<span class="tile-chart"
			><Sparkline values={spark} {bars} height={size === 'l' ? 64 : 34} /></span
		>
	{/if}
	{#if sub || delta}
		<span class="sub">
			{#if delta}
				<span class="delta num" class:down={delta < 0}
					>{delta > 0 ? '▲' : '▼'}&#8239;{Math.abs(delta)}{deltaUnit}</span
				>
			{/if}
			{#if sub}<span class="sub-text">{sub}</span>{/if}
		</span>
	{/if}
</svelte:element>

<style>
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		padding: var(--tile-pad);
		border-radius: var(--radius-tile);
		color: var(--tile-text);
		overflow: hidden;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.link:active {
		transform: scale(0.98);
	}

	@media (hover: hover) {
		.link:hover {
			filter: brightness(0.985) saturate(1.05);
		}
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		min-height: 1.2rem;
	}

	.lbl {
		color: var(--tone-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.val {
		margin-top: 0.15rem;
		font-size: clamp(1.75rem, 8vw, 2.25rem);
		font-weight: 500;
		line-height: 1.05;
		white-space: nowrap;
	}

	.size-l .val,
	.size-full .val {
		font-size: clamp(2.4rem, 11vw, 3.2rem);
	}

	.val small {
		margin-left: 0.15em;
		font-size: 0.45em;
		font-weight: 500;
		color: var(--tile-text-2);
		letter-spacing: 0;
	}

	.val.muted {
		color: var(--tile-text-2);
	}

	.body {
		display: block;
		min-width: 0;
	}

	.tile-chart {
		display: block;
		margin-top: auto;
		padding-top: 0.55rem;
	}

	.sub {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		min-width: 0;
		font-size: 0.82rem;
		color: var(--tile-text-2);
		line-height: 1.3;
	}

	.tile-chart + .sub {
		margin-top: 0.3rem;
	}

	/* höchstens zwei Zeilen, nie abgeschnitten mitten im Wort */
	.sub-text {
		min-width: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.delta {
		flex: none;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--tone-ink);
	}
</style>
