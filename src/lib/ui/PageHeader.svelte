<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		subtitle,
		action
	}: { eyebrow?: string; title: string; subtitle?: string; action?: Snippet } = $props();
</script>

<header>
	<div class="row">
		<div class="titles">
			{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
			<h1>{title}</h1>
		</div>
		{#if action}<div class="action">{@render action()}</div>{/if}
	</div>
	{#if subtitle}<p>{subtitle}</p>{/if}
</header>

<style>
	header {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0.5rem 0 1.5rem;
		max-width: 960px;
	}

	.row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.titles {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}

	.action {
		flex: none;
	}

	h1 {
		font-size: clamp(2rem, 6vw, 2.75rem);
	}

	p {
		color: var(--text-2);
		font-size: 1.05rem;
	}
</style>
