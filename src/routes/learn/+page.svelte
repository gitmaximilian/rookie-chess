<script lang="ts">
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ComingSoon from '#lib/ui/ComingSoon.svelte';
</script>

<svelte:head><title>Lernen – Rookie</title></svelte:head>

<PageHeader
	eyebrow="Wissen"
	title="Lernen"
	subtitle="Eröffnungen und Endspiele, die du wirklich brauchst."
/>
<ComingSoon
	icon={GraduationCap}
	color="var(--c-learn)"
	soft="var(--c-learn-soft)"
	title="Lektionen in Arbeit"
	phase="Kommt bald"
>
	Lerne Matt mit Dame und Turm, die Opposition und ein solides Eröffnungsrepertoire – mit
	Wiederholung im richtigen Moment.
</ComingSoon>
