<script lang="ts">
	let { eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string } =
		$props();
</script>

<header>
	{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
	<h1>{title}</h1>
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

	h1 {
		font-size: clamp(2rem, 6vw, 2.75rem);
	}

	p {
		color: var(--text-2);
		font-size: 1.05rem;
	}
</style>
