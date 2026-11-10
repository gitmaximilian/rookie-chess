<script lang="ts">
	import { whiteWin } from '#lib/analysis/classify.js';
	import { formatScore, type Score } from '#lib/engine/uci.js';

	let { score, orientation = 'white' }: { score: Score | null; orientation?: 'white' | 'black' } =
		$props();

	const white = $derived(score ? whiteWin(score) : 0.5);
	const label = $derived(score ? formatScore(score) : '');
</script>

<div class="bar" class:flip={orientation === 'black'} role="img" aria-label="Bewertung {label}">
	<div class="white" style:height="{white * 100}%"></div>
	<span class="lbl" class:top={white < 0.5}>{label.replace('+', '')}</span>
</div>

<style>
	.bar {
		position: relative;
		flex: none;
		width: 14px;
		align-self: stretch;
		border-radius: 7px;
		overflow: hidden;
		background: #3a3430;
		display: flex;
		flex-direction: column-reverse;
		outline: 1px solid var(--line-strong);
		outline-offset: -1px;
		box-shadow: var(--shadow-1);
	}

	.bar.flip {
		flex-direction: column;
	}

	.white {
		background: #fffdf9;
		transition: height 500ms var(--ease-out);
	}

	.lbl {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 4px;
		font-size: 8px;
		font-weight: 750;
		text-align: center;
		color: #3a3430;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
	}

	.lbl.top {
		bottom: auto;
		top: 4px;
		color: #f4efe7;
	}

	.flip .lbl {
		bottom: auto;
		top: 4px;
	}

	.flip .lbl.top {
		top: auto;
		bottom: 4px;
	}
</style>
