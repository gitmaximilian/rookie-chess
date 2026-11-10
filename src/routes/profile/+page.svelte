<script lang="ts">
	import { resolve } from '$app/paths';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Info from '@lucide/svelte/icons/info';
	import Settings from '@lucide/svelte/icons/settings';
	import Scale from '@lucide/svelte/icons/scale';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ComingSoon from '#lib/ui/ComingSoon.svelte';
	import { t } from '#lib/i18n/i18n.svelte.js';
</script>

<svelte:head><title>{t('profile.title')} – Rookie</title></svelte:head>

<PageHeader
	eyebrow={t('profile.eyebrow')}
	title={t('profile.title')}
	subtitle={t('profile.subtitle')}
/>
<div class="stack">
	<ComingSoon
		icon={ChartLine}
		color="var(--c-analysis)"
		soft="var(--c-analysis-soft)"
		title={t('profile.ratingHistory')}
		phase={t('common.comingSoon')}
	>
		{t('profile.noHistory')}
	</ComingSoon>
	<a href={resolve('/settings')} class="row card pressable">
		<span class="ico"><Settings size={20} /></span>
		<span class="txt">{t('profile.settings')}</span>
		<ChevronRight size={18} />
	</a>
	<a href={resolve('/about')} class="row card pressable">
		<span class="ico"><Info size={20} /></span>
		<span class="txt">{t('profile.about')}</span>
		<ChevronRight size={18} />
	</a>
	<a href="https://maximilianauer.at/legal/" rel="noopener" class="row card pressable">
		<span class="ico"><Scale size={20} /></span>
		<span class="txt">{t('profile.legal')}</span>
		<ChevronRight size={18} />
	</a>
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 960px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		color: var(--text-2);
	}
	.ico {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 11px;
		background: var(--surface-2);
		color: var(--text);
	}
	.txt {
		flex: 1;
		color: var(--text);
		font-weight: 560;
	}
</style>
