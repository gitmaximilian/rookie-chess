<script lang="ts">
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { t } from '#lib/i18n/i18n.svelte.js';
</script>

<svelte:head><title>{t('import.title')} – Rookie</title></svelte:head>
<PageHeader
	eyebrow={t('import.eyebrow')}
	title={t('import.title')}
	subtitle={t('import.subtitle')}
/>
