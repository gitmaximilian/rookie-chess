<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { navItems, isActive } from '#lib/nav.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
</script>

<nav class="tabbar" aria-label={t('nav.main')}>
	{#each navItems as item (item.href)}
		{@const active = isActive(item.href, page.url.pathname)}
		<a
			href={resolve(item.href)}
			class="tab"
			class:active
			style:--tab-bg="var(--tile-{item.tone})"
			style:--tab-ink="var(--tile-{item.tone}-ink)"
			aria-current={active ? 'page' : undefined}
		>
			<span class="icon-wrap">
				<item.icon size={23} strokeWidth={active ? 2.3 : 1.9} />
			</span>
			<span class="label">{t(item.label)}</span>
		</a>
	{/each}
</nav>

<style>
	/* Dunkel und ruhig in beiden Modi; aktiver Tab als Pastell-Pille in Bereichsfarbe.
	   Höhe unverändert (--tabbar-h), damit Dock-Reservierung und Brettgröße gleich bleiben. */
	.tabbar {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 50;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		height: calc(var(--tabbar-h) + var(--safe-bottom));
		padding: 6px max(4px, var(--safe-left)) var(--safe-bottom) max(4px, var(--safe-right));
		background: var(--tabbar-bg);
		border-top: 1px solid rgb(255 255 255 / 0.06);
		color-scheme: dark;
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: var(--tabbar-fg);
		font-size: 0.72rem;
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
		width: 50px;
		height: 30px;
		border-radius: 999px;
		transition: transform var(--dur) var(--ease-spring);
	}

	.icon-wrap::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--tab-bg);
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
		color: var(--tabbar-active-bg);
	}

	.tab.active .icon-wrap {
		color: var(--tab-ink);
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
