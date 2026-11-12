<script lang="ts" generics="T extends string">
	/** Umschalter im Stil „Woche | Monat“ – kurze Labels in Monospace */
	let {
		options,
		value = $bindable(),
		label,
		onchange
	}: {
		options: { value: T; label: string }[];
		value: T;
		label: string;
		onchange?: (v: T) => void;
	} = $props();
</script>

<div class="seg" role="group" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			class="mono-label"
			class:on={o.value === value}
			aria-pressed={o.value === value}
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}>{o.label}</button
		>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--surface-2);
	}

	button {
		position: relative;
		min-height: 34px;
		padding: 0 0.95rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out);
	}

	/* 44 px Tippfläche */
	button::after {
		content: '';
		position: absolute;
		inset: -5px 0;
	}

	button.on {
		background: var(--text);
		color: var(--bg);
	}
</style>
