<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { navItems, isActive } from '#lib/nav.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import Logo from './Logo.svelte';
	import Settings from '@lucide/svelte/icons/settings';
	import UserRound from '@lucide/svelte/icons/user-round';
</script>

<aside class="sidebar">
	<a href={resolve('/')} class="brand">
		<Logo size={34} />
		<span>Rookie</span>
	</a>

	<nav aria-label={t('nav.main')}>
		{#each navItems as item (item.href)}
			<!-- Einstellungen haben hier einen eigenen Eintrag -->
			{@const active = isActive(item.href, page.url.pathname)}
			<a
				href={resolve(item.href)}
				class="item"
				class:active
				style:--item-bg="var(--tile-{item.tone})"
				style:--item-ink="var(--tile-{item.tone}-ink)"
				aria-current={active ? 'page' : undefined}
			>
				<span class="icon"><item.icon size={20} strokeWidth={active ? 2.3 : 1.9} /></span>
				{t(item.label)}
			</a>
		{/each}
	</nav>

	<a
		href={resolve('/profile')}
		class="item profile"
		class:active={page.url.pathname.startsWith('/profile')}
		style:--item-bg="var(--tile-neutral)"
		style:--item-ink="var(--tile-neutral-ink)"
		aria-current={page.url.pathname.startsWith('/profile') ? 'page' : undefined}
	>
		<span class="icon"><UserRound size={20} /></span>
		{t('nav.profile')}
	</a>
	<a
		href={resolve('/settings')}
		class="item settings"
		class:active={page.url.pathname.startsWith('/settings')}
		style:--item-bg="var(--tile-neutral)"
		style:--item-ink="var(--tile-neutral-ink)"
		aria-current={page.url.pathname.startsWith('/settings') ? 'page' : undefined}
	>
		<span class="icon"><Settings size={20} /></span>
		{t('profile.settings')}
	</a>

	<p class="foot">
		{t('nav.foot')}<br />
		<a href="https://maximilianauer.at/legal/" rel="noopener">{t('nav.legal')}</a>
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
		height: 44px;
		padding: 0 0.6rem;
		border-radius: 999px;
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
		background: var(--item-bg);
		color: var(--tile-text);
	}

	.item.active .icon {
		color: var(--item-ink);
	}

	.foot a {
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: var(--line-strong);
	}

	.foot a:hover {
		color: var(--text);
	}

	.profile {
		margin-top: auto;
		margin-bottom: -1.5rem;
	}

	.settings {
		margin-bottom: -1rem;
	}

	.foot {
		padding: 0 0.6rem;
		font-family: var(--font-num);
		font-size: 0.7rem;
		color: var(--text-3);
	}
</style>
