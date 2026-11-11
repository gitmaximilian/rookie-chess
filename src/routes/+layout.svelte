<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque';
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { pwaInfo } from 'virtual:pwa-info';
	import TabBar from '#lib/ui/TabBar.svelte';
	import Sidebar from '#lib/ui/Sidebar.svelte';
	import { i18n } from '#lib/i18n/i18n.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(async () => {
		i18n.init();
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({ immediate: true });
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

<style>
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
