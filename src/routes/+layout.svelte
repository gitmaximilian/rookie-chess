<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque';
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { pwaInfo } from 'virtual:pwa-info';
	import TabBar from '#lib/ui/TabBar.svelte';
	import Sidebar from '#lib/ui/Sidebar.svelte';
	import { i18n, t } from '#lib/i18n/i18n.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let needRefresh = $state(false);
	let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

	onMount(async () => {
		i18n.init();
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			// Kein automatisches Neuladen mitten in einer Partie – nur ein dezenter Hinweis
			updateSW = registerSW({
				immediate: true,
				onNeedRefresh: () => (needRefresh = true)
			});
		}
	});

	// Weiche Seitenwechsel (Safari 18+, sonst ohne Animation)
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	{#if pwaInfo}<link rel="manifest" href="/manifest.webmanifest" />{/if}
</svelte:head>

<Sidebar />

<main>
	{@render children()}
</main>

<TabBar />

{#if needRefresh}
	<div class="update" role="status">
		<span>{t('common.updateAvailable')}</span>
		<button onclick={() => updateSW?.(true)}>{t('common.reload')}</button>
		<button class="x" onclick={() => (needRefresh = false)} aria-label="×">×</button>
	</div>
{/if}

<style>
	.update {
		position: fixed;
		z-index: 90;
		left: 50%;
		bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 12px);
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		border-radius: 999px;
		background: var(--text);
		color: var(--bg);
		font-size: 0.9rem;
		font-weight: 600;
		box-shadow: var(--shadow-2);
		animation: up 320ms var(--ease-spring);
		white-space: nowrap;
	}

	@media (min-width: 768px) {
		.update {
			bottom: 1.5rem;
			left: calc(50% + var(--sidebar-w) / 2);
		}
	}

	.update button {
		border: none;
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		background: var(--accent);
		color: #fff;
		font-weight: 650;
		cursor: pointer;
	}

	.update .x {
		background: none;
		color: inherit;
		opacity: 0.6;
		padding: 0.4rem 0.6rem;
	}

	@keyframes up {
		from {
			opacity: 0;
			transform: translate(-50%, 10px);
		}
	}

	main {
		view-transition-name: main;
		min-height: 100dvh;
		padding: calc(var(--safe-top) + 1.25rem) max(1.1rem, var(--safe-right))
			calc(var(--tabbar-h) + var(--safe-bottom) + 1.5rem) max(1.1rem, var(--safe-left));
	}

	@media (min-width: 768px) {
		main {
			margin-left: var(--sidebar-w);
			padding: calc(var(--safe-top) + 2.25rem) 2.5rem 3rem;
		}
	}

	@media (min-width: 1200px) {
		main {
			padding-inline: 3.5rem;
		}
	}
</style>
