<script lang="ts">
	import type { ActivityRow } from '#lib/db/db.js';
	import { today } from '#lib/db/db.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	let { rows, weeks = 12 }: { rows: ActivityRow[]; weeks?: number } = $props();

	const cells = $derived.by(() => {
		const map = new Map(rows.map((r) => [r.day, r.puzzles + r.games + r.reviews]));
		const end = new Date();
		// Spalten = Wochen (Mo–So), letzte Spalte = aktuelle Woche
		const dow = (end.getDay() + 6) % 7;
		const start = new Date(
			end.getFullYear(),
			end.getMonth(),
			end.getDate() - dow - (weeks - 1) * 7
		);
		const out: { day: string; n: number; date: Date; future: boolean }[] = [];
		for (let i = 0; i < weeks * 7; i++) {
			const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
			const key = today(d);
			out.push({ day: key, n: map.get(key) ?? 0, date: d, future: d > end });
		}
		return out;
	});

	function level(n: number): number {
		if (n <= 0) return 0;
		if (n < 3) return 1;
		if (n < 6) return 2;
		if (n < 11) return 3;
		return 4;
	}

	let tip = $state<{ text: string; x: number; y: number } | null>(null);
	function show(e: PointerEvent, c: { n: number; date: Date }) {
		const el = e.currentTarget as HTMLElement;
		const box = el.getBoundingClientRect();
		const host = el.parentElement!.getBoundingClientRect();
		tip = {
			text: `${c.n} · ${c.date.toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}`,
			x: box.left - host.left + box.width / 2,
			y: box.top - host.top
		};
	}
</script>

<div class="heat">
	<div class="grid" style:--weeks={weeks}>
		{#each cells as c (c.day)}
			<span
				class="cell l{level(c.n)}"
				class:future={c.future}
				role="img"
				aria-label="{c.day}: {c.n}"
				onpointerenter={(e) => show(e, c)}
				onpointerleave={() => (tip = null)}
			></span>
		{/each}
		{#if tip}
			<span class="tip" style:left="{tip.x}px" style:top="{tip.y}px">{tip.text}</span>
		{/if}
	</div>
	<div class="legend">
		<span>{t('profile.less')}</span>
		{#each [0, 1, 2, 3, 4] as l (l)}<span class="cell l{l} sw"></span>{/each}
		<span>{t('profile.more')}</span>
	</div>
</div>

<style>
	.grid {
		position: relative;
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 3px;
	}

	.cell {
		aspect-ratio: 1;
		border-radius: 4px;
		background: var(--surface-2);
		outline: none;
	}

	.cell:focus-visible {
		box-shadow: 0 0 0 2px var(--text);
	}

	.cell.l1 {
		background: color-mix(in srgb, var(--accent) 28%, var(--surface-2));
	}
	.cell.l2 {
		background: color-mix(in srgb, var(--accent) 52%, var(--surface-2));
	}
	.cell.l3 {
		background: color-mix(in srgb, var(--accent) 76%, var(--surface-2));
	}
	.cell.l4 {
		background: var(--accent);
	}

	.cell.future {
		opacity: 0.35;
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.legend span:first-child {
		margin-right: 4px;
	}

	.legend span:last-child {
		margin-left: 4px;
	}

	.sw {
		width: 11px;
		height: 11px;
		aspect-ratio: auto;
		border-radius: 3px;
	}

	.tip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 6px));
		padding: 0.25rem 0.55rem;
		border-radius: 7px;
		background: var(--text);
		color: var(--bg);
		font-size: 0.75rem;
		white-space: nowrap;
		pointer-events: none;
		z-index: 2;
	}
</style>
