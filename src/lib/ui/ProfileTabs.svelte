<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let { active }: { active: 'overview' | 'stats' } = $props();
</script>

<nav class="tabs" aria-label={t('profile.title')}>
	<a
		href={resolve('/profile')}
		class:on={active === 'overview'}
		aria-current={active === 'overview' ? 'page' : undefined}>{t('stats.tabOverview')}</a
	>
	<a
		href={resolve('/profile/stats')}
		class:on={active === 'stats'}
		aria-current={active === 'stats' ? 'page' : undefined}>{t('stats.tabStats')}</a
	>
</nav>

<style>
	.tabs {
		display: inline-flex;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
		margin-bottom: 1rem;
	}

	a {
		min-width: 120px;
		padding: 0.5rem 1rem;
		border-radius: 9px;
		text-align: center;
		font-weight: 650;
		color: var(--text-2);
		transition: background-color var(--dur) var(--ease-out);
	}

	a.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-1);
	}
</style>
