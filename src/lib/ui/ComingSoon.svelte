<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	let {
		icon: Icon,
		color,
		soft,
		title,
		phase,
		children
	}: {
		icon: Component;
		color: string;
		soft: string;
		title: string;
		phase: string;
		children: Snippet;
	} = $props();
</script>

<section class="empty card" style:--c={color} style:--c-soft={soft}>
	<div class="blob" aria-hidden="true">
		<span class="ring r1"></span>
		<span class="ring r2"></span>
		<span class="badge"><Icon size={34} strokeWidth={2} /></span>
	</div>
	<span class="pill">{phase}</span>
	<h2>{title}</h2>
	<p>{@render children()}</p>
</section>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.75rem;
		padding: 2.75rem 1.5rem 2.5rem;
		overflow: hidden;
		position: relative;
	}

	.blob {
		position: relative;
		display: grid;
		place-items: center;
		width: 120px;
		height: 120px;
		margin-bottom: 1.25rem;
	}

	.badge {
		position: relative;
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: 24px;
		background: var(--c);
		color: #fff;
		box-shadow: 0 10px 30px color-mix(in srgb, var(--c) 40%, transparent);
		animation: bob 4s var(--ease-out) infinite;
	}

	.ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--c-soft);
		animation: pulse 4s ease-in-out infinite;
	}
	.r2 {
		inset: -18px;
		opacity: 0.5;
		animation-delay: -2s;
	}

	.pill {
		font-size: 0.75rem;
		font-weight: 650;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		background: var(--c-soft);
		color: var(--c);
	}

	h2 {
		font-size: 1.45rem;
	}

	p {
		max-width: 34ch;
		color: var(--text-2);
	}

	@keyframes bob {
		50% {
			transform: translateY(-5px) rotate(-3deg);
		}
	}
	@keyframes pulse {
		50% {
			transform: scale(1.08);
		}
	}
</style>
