<script lang="ts">
	/**
	 * Kleines, statisches Brett (nur Anzeige): Farben und Figurensatz wie im Spiel-Brett.
	 * Für Vorschaubilder, z. B. die Zielstellung eines Eröffnungskurses.
	 */
	import 'chessground/assets/chessground.cburnett.css';

	let {
		fen,
		orientation = 'white',
		size = 76
	}: { fen: string; orientation?: 'white' | 'black'; size?: number } = $props();

	const ROLE: Record<string, string> = {
		p: 'pawn',
		n: 'knight',
		b: 'bishop',
		r: 'rook',
		q: 'queen',
		k: 'king'
	};

	/** 64 Felder von oben links, je nach Blickrichtung */
	const cells = $derived.by(() => {
		const rows = fen.split(' ')[0].split('/');
		const out: { dark: boolean; piece: string | null }[] = [];
		rows.forEach((row, r) => {
			let f = 0;
			for (const ch of row) {
				if (/\d/.test(ch)) {
					for (let k = 0; k < Number(ch); k++) out.push({ dark: (r + f++) % 2 === 1, piece: null });
				} else {
					const color = ch === ch.toUpperCase() ? 'white' : 'black';
					out.push({ dark: (r + f++) % 2 === 1, piece: `${ROLE[ch.toLowerCase()]} ${color}` });
				}
			}
		});
		return orientation === 'white' ? out : out.reverse();
	});
</script>

<span class="mb cg-wrap" style:--s="{size}px" aria-hidden="true">
	{#each cells as c, i (i)}
		<span class="sq" class:dark={c.dark}
			>{#if c.piece}<piece class={c.piece}></piece>{/if}</span
		>
	{/each}
</span>

<style>
	.mb {
		flex: none;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		width: var(--s);
		height: var(--s);
		border-radius: 6px;
		overflow: hidden;
		box-shadow: var(--shadow-1);
	}

	.sq {
		position: relative;
		background: var(--sq-light);
	}

	.sq.dark {
		background: var(--sq-dark);
	}

	.mb :global(piece) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background-size: cover;
		transform: none;
		pointer-events: none;
	}
</style>
