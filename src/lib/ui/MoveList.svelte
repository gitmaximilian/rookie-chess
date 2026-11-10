<script lang="ts">
	import { tick } from 'svelte';
	import type { PlayedMove } from '#lib/chess/game.js';

	interface Props {
		moves: PlayedMove[];
		/** aktuell angezeigter Halbzug (0 = Start) */
		current?: number;
		/** Startet die Partie mit Schwarz? */
		blackStarts?: boolean;
		marks?: Record<number, '??' | '?' | '?!' | '!' | ''>;
		onSelect?: (ply: number) => void;
	}

	let {
		moves,
		current = moves.length,
		blackStarts = false,
		marks = {},
		onSelect
	}: Props = $props();
	let box: HTMLDivElement;

	const rows = $derived.by(() => {
		const out: {
			no: number;
			w?: { ply: number; san: string };
			b?: { ply: number; san: string };
		}[] = [];
		const offset = blackStarts ? 1 : 0;
		moves.forEach((m, i) => {
			const idx = i + offset;
			const no = Math.floor(idx / 2) + 1;
			if (idx % 2 === 0) out.push({ no, w: { ply: i + 1, san: m.san } });
			else {
				if (!out.length || out.at(-1)!.no !== no) out.push({ no });
				out.at(-1)!.b = { ply: i + 1, san: m.san };
			}
		});
		return out;
	});

	$effect(() => {
		void current;
		tick().then(() => {
			const el = box?.querySelector('.cur');
			el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		});
	});
</script>

<div class="moves" bind:this={box} role="list" aria-label="Zugliste">
	{#if rows.length === 0}
		<p class="empty">Noch keine Züge</p>
	{/if}
	{#each rows as r (r.no)}
		<div class="row" role="listitem">
			<span class="no">{r.no}.</span>
			{#if r.w}
				<button
					class="mv {marks[r.w.ply]
						? 'm' + (marks[r.w.ply] ?? '').replace(/\W/g, (c) => (c === '?' ? 'q' : 'x'))
						: ''}"
					class:cur={current === r.w.ply}
					onclick={() => onSelect?.(r.w!.ply)}
				>
					{r.w.san}{#if marks[r.w.ply]}<sup>{marks[r.w.ply]}</sup>{/if}
				</button>
			{:else}
				<span class="mv dim">…</span>
			{/if}
			{#if r.b}
				<button
					class="mv {marks[r.b.ply]
						? 'm' + (marks[r.b.ply] ?? '').replace(/\W/g, (c) => (c === '?' ? 'q' : 'x'))
						: ''}"
					class:cur={current === r.b.ply}
					onclick={() => onSelect?.(r.b!.ply)}
				>
					{r.b.san}{#if marks[r.b.ply]}<sup>{marks[r.b.ply]}</sup>{/if}
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	.moves {
		display: grid;
		grid-template-columns: 1fr;
		max-height: 100%;
		overflow-y: auto;
		font-variant-numeric: tabular-nums;
		font-size: 0.95rem;
		scrollbar-width: thin;
	}

	.empty {
		color: var(--text-3);
		font-size: 0.9rem;
		padding: 0.5rem 0.25rem;
	}

	.row {
		display: grid;
		grid-template-columns: 2.4rem 1fr 1fr;
		align-items: center;
		border-radius: 8px;
	}

	.row:nth-child(even) {
		background: var(--surface-2);
	}

	.no {
		color: var(--text-3);
		font-size: 0.85rem;
		padding-left: 0.5rem;
	}

	.mv {
		text-align: left;
		border: none;
		background: none;
		padding: 0.3rem 0.5rem;
		border-radius: 7px;
		font-weight: 560;
		cursor: pointer;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.mv:hover {
		background: var(--line);
	}

	.mv.cur {
		background: var(--accent);
		color: var(--on-accent);
	}

	.mv.dim {
		color: var(--text-3);
		cursor: default;
	}

	sup {
		font-size: 0.7em;
		margin-left: 1px;
		font-weight: 750;
	}

	.mqq sup {
		color: var(--bad);
	}
	.mq sup {
		color: #e07a1f;
	}
	.mqx sup {
		color: var(--warn);
	}
	.mx sup {
		color: var(--good);
	}
	.cur sup {
		color: inherit;
	}
</style>
