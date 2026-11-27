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
	/* Schwebende Papier-Leiste (hell im hellen, dunkel im dunklen Modus). Der aktive Tab ist eine
	   Pastell-Kachel seines Bereichs mit Unterkante – wie Buttons und App-Icon.
	   Platzbedarf steht in --tabbar-space (app.css) – Dock und Brettgröße rechnen damit. */
	.tabbar {
		position: fixed;
		z-index: 50;
		left: max(12px, calc(var(--safe-left) + 8px));
		right: max(12px, calc(var(--safe-right) + 8px));
		bottom: var(--tabbar-gap);
		display: grid;
		/* so viele gleich breite Spalten wie Tabs – nie eine leere Spalte */
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 3px;
		height: var(--tabbar-h);
		padding: 5px;
		border-radius: 22px;
		/* 88 % deckend: Beschriftung bleibt auch über buntem Inhalt ≥ 4,5:1 (scripts/contrast.mjs) */
		background: color-mix(in srgb, var(--tabbar-bg) 88%, transparent);
		backdrop-filter: saturate(160%) blur(22px);
		-webkit-backdrop-filter: saturate(160%) blur(22px);
		border: 1px solid var(--line-strong);
		box-shadow:
			0 1px 2px rgb(28 26 23 / 0.06),
			0 10px 28px rgb(28 26 23 / 0.12);
	}

	.tab {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		border-radius: 16px;
		color: var(--tabbar-fg);
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: 0;
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
		box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--tab-ink) 28%, transparent);
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
		color: var(--tab-ink);
	}

	.tab:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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
