<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let { active }: { active: 'overview' | 'stats' } = $props();
</script>

<nav class="tabs" aria-label={t('coachTab.title')}>
	<a
		class="mono-label"
		href={resolve('/coach')}
		class:on={active === 'overview'}
		aria-current={active === 'overview' ? 'page' : undefined}>{t('stats.tabOverview')}</a
	>
	<a
		class="mono-label"
		href={resolve('/coach/stats')}
		class:on={active === 'stats'}
		aria-current={active === 'stats' ? 'page' : undefined}>{t('stats.tabStats')}</a
	>
</nav>

<style>
	/* gleiche Form wie SegmentedSwitch */
	.tabs {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--surface-2);
		margin-bottom: 1rem;
	}

	a {
		display: grid;
		place-items: center;
		min-width: 112px;
		min-height: 38px;
		padding: 0 1rem;
		border-radius: 999px;
		color: var(--text-2);
		transition:
			background-color var(--dur) var(--ease-out),
			color var(--dur) var(--ease-out);
	}

	a.on {
		background: var(--text);
		color: var(--bg);
	}
</style>
