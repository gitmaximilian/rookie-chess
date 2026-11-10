<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { navItems, isActive } from '#lib/nav.js';
	import Logo from './Logo.svelte';
</script>

<aside class="sidebar">
	<a href={resolve('/')} class="brand">
		<Logo size={34} />
		<span>Rookie</span>
	</a>

	<nav aria-label="Hauptnavigation">
		{#each navItems as item (item.href)}
			{@const active = isActive(item.href, page.url.pathname)}
			<a
				href={resolve(item.href)}
				class="item"
				class:active
				style:--item-color={item.color}
				aria-current={active ? 'page' : undefined}
			>
				<span class="icon"><item.icon size={20} strokeWidth={active ? 2.3 : 1.9} /></span>
				{item.label}
			</a>
		{/each}
	</nav>

	<p class="foot">
		Kostenlos &amp; Open Source<br />
		<a href={resolve('/legal')}>Impressum &amp; Datenschutz</a>
	</p>
</aside>

<style>
	.sidebar {
		display: none;
	}

	@media (min-width: 768px) {
		.sidebar {
			position: fixed;
			inset: 0 auto 0 0;
			width: var(--sidebar-w);
			display: flex;
			flex-direction: column;
			gap: 1.75rem;
			padding: calc(var(--safe-top) + 1.5rem) 1rem 1.25rem calc(var(--safe-left) + 1rem);
			background: var(--bg-tint);
			border-right: 1px solid var(--line);
		}
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0 0.5rem;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 720;
		letter-spacing: -0.03em;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 42px;
		padding: 0 0.6rem;
		border-radius: var(--radius-m);
		color: var(--text-2);
		font-weight: 560;
		transition:
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		transition: background-color var(--dur) var(--ease-out);
	}

	@media (hover: hover) {
		.item:hover {
			background: var(--line);
			color: var(--text);
		}
	}

	.item.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-1);
	}

	.item.active .icon {
		background: var(--item-color);
		color: #fff;
	}

	.foot a {
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: var(--line-strong);
	}

	.foot a:hover {
		color: var(--text);
	}

	.foot {
		margin-top: auto;
		padding: 0 0.6rem;
		font-size: 0.78rem;
		color: var(--text-3);
	}
</style>
