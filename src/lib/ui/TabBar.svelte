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
				<item.icon size={22} strokeWidth={active ? 2.3 : 1.9} />
			</span>
			<span class="label">{t(item.label)}</span>
		</a>
	{/each}
</nav>

<style>
	/* Schwebende Glas-Kapsel (wie aktuelle iOS-Apps): dunkel in beiden Modi,
	   Beschriftungen bleiben, aktiver Tab als Pastell-Kapsel mit Symbol und Text.
	   Platzbedarf steht in --tabbar-space (app.css) – Dock und Brettgröße rechnen damit. */
	.tabbar {
		position: fixed;
		z-index: 50;
		left: max(12px, calc(var(--safe-left) + 8px));
		right: max(12px, calc(var(--safe-right) + 8px));
		bottom: var(--tabbar-gap);
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 2px;
		height: var(--tabbar-h);
		padding: 4px;
		border-radius: 999px;
		/* 88 % deckend: Beschriftung bleibt auch über hellem Inhalt ≥ 4,5:1 (scripts/contrast.mjs) */
		background: color-mix(in srgb, var(--tabbar-bg) 88%, transparent);
		backdrop-filter: saturate(160%) blur(22px);
		-webkit-backdrop-filter: saturate(160%) blur(22px);
		border: 1px solid rgb(255 255 255 / 0.08);
		box-shadow:
			0 10px 30px rgb(0 0 0 / 0.22),
			inset 0 1px 0 rgb(255 255 255 / 0.06);
		color-scheme: dark;
	}

	.tab {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		border-radius: 999px;
		color: var(--tabbar-fg);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		-webkit-user-select: none;
		user-select: none;
		transition:
			color var(--dur) var(--ease-out),
			transform var(--dur-fast) var(--ease-out);
	}

	/* aktive Kapsel: Pastellfläche des Bereichs, gleitet weich ein */
	.tab::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--tab-bg);
		opacity: 0;
		transform: scale(0.82);
		transition:
			opacity var(--dur) var(--ease-out),
			transform var(--dur) var(--ease-spring);
	}

	.tab:active {
		transform: scale(0.94);
	}

	.tab.active {
		color: var(--tile-text);
	}

	.tab.active::before {
		opacity: 1;
		transform: none;
	}

	.icon-wrap {
		position: relative;
		display: grid;
		place-items: center;
		height: 24px;
	}

	.tab.active .icon-wrap {
		color: var(--tab-ink);
	}

	.label {
		position: relative;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 768px) {
		.tabbar {
			display: none;
		}
	}
</style>
