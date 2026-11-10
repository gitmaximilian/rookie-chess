<script lang="ts">
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ComingSoon from '#lib/ui/ComingSoon.svelte';
	import { t } from '#lib/i18n/i18n.svelte.js';
</script>

<svelte:head><title>{t('learn.title')} – Rookie</title></svelte:head>

<PageHeader eyebrow={t('learn.eyebrow')} title={t('learn.title')} subtitle={t('learn.subtitle')} />
<ComingSoon
	icon={GraduationCap}
	color="var(--c-learn)"
	soft="var(--c-learn-soft)"
	title={t('learn.endgames')}
	phase={t('common.comingSoon')}
>
	{t('learn.endgamesText')}
</ComingSoon>
