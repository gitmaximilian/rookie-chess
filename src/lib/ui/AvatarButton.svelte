<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { getLinked } from '#lib/import/sync.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	/** Profil, Sterne und Einstellungen – erreichbar über den Avatar oben rechts (kein eigener Tab) */
	let name = $state('');
	onMount(async () => {
		const l = await getLinked();
		name = l.lichess || l.chesscom || '';
	});
	const here = $derived(page.url.pathname.startsWith('/profile'));
</script>

<a
	class="avatar"
	class:here
	href={resolve('/profile')}
	aria-label={t('nav.profile')}
	title={t('nav.profile')}
	aria-current={here ? 'page' : undefined}
>
	{#if name}{name[0].toUpperCase()}{:else}<UserRound size={20} />{/if}
</a>

<style>
	.avatar {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: linear-gradient(
			140deg,
			var(--accent),
			color-mix(in srgb, var(--accent) 55%, #6d4bd8)
		);
		color: #fff;
		font-family: var(--font-display);
		font-weight: 750;
		font-size: 1.15rem;
		box-shadow:
			0 0 0 2px var(--bg),
			0 0 0 3.5px color-mix(in srgb, var(--accent) 40%, transparent),
			var(--shadow-1);
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.avatar:active {
		transform: scale(0.94);
	}
</style>
