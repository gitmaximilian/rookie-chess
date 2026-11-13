<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque';
	import '@fontsource/ibm-plex-mono/latin-400.css';
	import '@fontsource/ibm-plex-mono/latin-500.css';
	import '@fontsource/ibm-plex-mono/latin-600.css';
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { pwaInfo } from 'virtual:pwa-info';
	import TabBar from '#lib/ui/TabBar.svelte';
	import Sidebar from '#lib/ui/Sidebar.svelte';
	import { i18n, t } from '#lib/i18n/i18n.svelte.js';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { refreshAccount, syncNow, account } from '#lib/sync/sync.svelte.js';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import Onboarding from '#lib/onboarding/Onboarding.svelte';
	import { needsOnboarding } from '#lib/onboarding/profile.js';
	import { initInstall } from '#lib/ui/install.svelte.js';
	import {
		autoSync,
		busyRoute,
		pauseBackground,
		analyseInBackground,
		syncState
	} from '#lib/import/sync.svelte.js';
	import type { LayoutProps } from './$types';
	import MoveNotice from '#lib/move/MoveNotice.svelte';
	import { isOldHost, isStandalone } from '#lib/move/move.js';

	let { children }: LayoutProps = $props();
	let needRefresh = $state(false);
	let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

	let newGames = $state(0);
	let onboarding = $state(false);
	// Umzug: /move-in ist nur der unsichtbare Empfänger, die alte Adresse leitet weiter
	const receiver = page.url.pathname === '/move-in';
	let oldHost = $state(false);

	async function sync() {
		await autoSync(page.url.pathname);
		if (syncState.lastNew > 0) {
			newGames = syncState.lastNew;
			syncState.lastNew = 0;
			setTimeout(() => (newGames = 0), 6000);
		}
	}

	onMount(async () => {
		if (receiver) return;
		i18n.init();
		oldHost = isOldHost();
		// im Browser übernimmt die Umzugs-Anzeige; nur die Home-Bildschirm-App läuft hier weiter
		if (oldHost && !isStandalone()) return;
		initInstall();
		// Einstieg nur für ganz neue Nutzer (Test-/Sync-Umgebungen können ihn per localStorage abschalten)
		let seen = false;
		try {
			seen = localStorage.getItem('rookie:onboarded') === '1';
		} catch {
			/* egal */
		}
		if (!seen) {
			if (await needsOnboarding()) onboarding = true;
			else {
				// Bestandsnutzer ohne Merker: künftig sofort starten
				try {
					localStorage.setItem('rookie:onboarded', '1');
				} catch {
					/* egal */
				}
			}
		}
		if (!onboarding) document.documentElement.removeAttribute('data-first-run');
		// verknüpfte Konten: neue Partien holen, wenn die App geöffnet wird oder zurückkehrt
		setTimeout(sync, 2500);
		// Konto: Stand beim Öffnen holen, beim Verlassen der App sichern
		setTimeout(async () => {
			await refreshAccount();
			if (account.status === 'in') void syncNow();
		}, 1200);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void sync();
			if (account.status === 'in') void syncNow();
		});
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			// Kein automatisches Neuladen mitten in einer Partie – nur ein dezenter Hinweis
			updateSW = registerSW({
				immediate: true,
				onNeedRefresh: () => (needRefresh = true)
			});
		}
	});

	// Weicher Seitenwechsel ohne View Transitions: Safari fotografiert dabei die Seite,
	// wodurch die Tab-Leiste kurz verschwindet. Hier bewegt sich nur der Inhalt.
	let mainEl = $state<HTMLElement>();
	afterNavigate(({ from, to, type }) => {
		if (to && busyRoute(to.url.pathname)) pauseBackground();
		else if (type !== 'enter') void analyseInBackground();
		if (type === 'enter' || !from || from.url.pathname === to?.url.pathname) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		mainEl?.animate(
			[
				{ opacity: 0, transform: 'translateY(10px)' },
				{ opacity: 1, transform: 'none' }
			],
			{ duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
		);
	});
</script>

<svelte:head>
	{#if pwaInfo}<link rel="manifest" href="/manifest.webmanifest" />{/if}
</svelte:head>

{#if receiver}
	{@render children()}
{:else}
	<Sidebar />

	<main bind:this={mainEl}>
		{@render children()}
	</main>

	<TabBar />

	{#if onboarding}<Onboarding
			onclose={() => {
				onboarding = false;
				document.documentElement.removeAttribute('data-first-run');
			}}
		/>{:else}<InstallPrompt />{/if}

	{#if newGames > 0}
		<div role="status">
			<a class="update synced" href={resolve('/analysis')} onclick={() => (newGames = 0)}>
				{t('import.synced', { n: newGames })}
			</a>
		</div>
	{/if}

	{#if needRefresh}
		<div class="update" role="status">
			<span>{t('common.updateAvailable')}</span>
			<button onclick={() => updateSW?.(true)}>{t('common.reload')}</button>
			<button class="x" onclick={() => (needRefresh = false)} aria-label="×">×</button>
		</div>
	{/if}

	{#if oldHost}<MoveNotice />{/if}
{/if}

<style>
	.update {
		position: fixed;
		z-index: 90;
		left: 50%;
		bottom: calc(var(--tabbar-space) + 12px);
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

	.update.synced {
		padding: 0.6rem 1.1rem;
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
		min-height: 100dvh;
		padding: calc(var(--safe-top) + 1.25rem) max(1.1rem, var(--safe-right))
			calc(var(--tabbar-space) + 1.5rem) max(1.1rem, var(--safe-left));
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
