<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { navItems, isActive } from '#lib/nav.js';
</script>

<nav class="tabbar" aria-label="Hauptnavigation">
	{#each navItems as item (item.href)}
		{@const active = isActive(item.href, page.url.pathname)}
		<a
			href={resolve(item.href)}
			class="tab"
			class:active
			style:--tab-color={item.color}
			aria-current={active ? 'page' : undefined}
		>
			<span class="icon-wrap">
				<item.icon size={23} strokeWidth={active ? 2.3 : 1.9} />
			</span>
			<span class="label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 50;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		height: calc(var(--tabbar-h) + var(--safe-bottom));
		padding: 6px max(8px, var(--safe-left)) var(--safe-bottom) max(8px, var(--safe-right));
		background: var(--surface-glass);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		border-top: 1px solid var(--line);
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: var(--text-3);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		transition: color var(--dur) var(--ease-out);
		-webkit-user-select: none;
		user-select: none;
	}

	.icon-wrap {
		position: relative;
		display: grid;
		place-items: center;
		width: 52px;
		height: 30px;
		border-radius: 999px;
		transition: transform var(--dur) var(--ease-spring);
	}

	.icon-wrap::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: color-mix(in srgb, var(--tab-color) 14%, transparent);
		transform: scale(0.4);
		opacity: 0;
		transition:
			transform var(--dur) var(--ease-spring),
			opacity var(--dur) var(--ease-out);
	}

	.tab:active .icon-wrap {
		transform: scale(0.88);
	}

	.tab.active {
		color: var(--tab-color);
	}

	.tab.active .icon-wrap::before {
		transform: scale(1);
		opacity: 1;
	}

	.icon-wrap :global(svg) {
		position: relative;
	}

	@media (min-width: 768px) {
		.tabbar {
			display: none;
		}
	}
</style>
