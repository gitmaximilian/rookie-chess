<script lang="ts">
	import { t } from '#lib/i18n/i18n.svelte.js';

	/** Mit welcher Farbe man spielt – als Figur statt als Quadrat (das sah wie eine Checkbox aus) */
	let { color, size = 26 }: { color: 'white' | 'black'; size?: number } = $props();
</script>

<span
	class="cb {color}"
	style:--s="{size}px"
	role="img"
	aria-label={t(color === 'white' ? 'openings.asWhite' : 'openings.asBlack')}
	>{color === 'white' ? '♔' : '♚'}</span
>

<style>
	.cb {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--s);
		height: var(--s);
		border-radius: 50%;
		font-size: calc(var(--s) * 0.8);
		line-height: 1;
		padding-bottom: calc(var(--s) * 0.06);
	}

	.cb.white {
		background: #fbf8f2;
		color: #2a2724;
		box-shadow: inset 0 0 0 1.5px rgb(42 39 36 / 0.25);
	}

	.cb.black {
		background: #2a2724;
		color: #fbf8f2;
	}
</style>
