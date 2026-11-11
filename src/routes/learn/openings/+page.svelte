<script lang="ts">
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { t } from '#lib/i18n/i18n.svelte.js';
</script>

<svelte:head><title>{t('openings.title')} – Rookie</title></svelte:head>
<PageHeader
	eyebrow={t('learn.title')}
	title={t('openings.title')}
	subtitle={t('openings.subtitle')}
/>
