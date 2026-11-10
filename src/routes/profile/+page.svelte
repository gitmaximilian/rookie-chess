<script lang="ts">
	import { resolve } from '$app/paths';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Info from '@lucide/svelte/icons/info';
	import Settings from '@lucide/svelte/icons/settings';
	import Scale from '@lucide/svelte/icons/scale';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ComingSoon from '#lib/ui/ComingSoon.svelte';
</script>

<svelte:head><title>Profil – Rookie</title></svelte:head>

<PageHeader
	eyebrow="Du"
	title="Profil"
	subtitle="Dein Fortschritt, deine Partien, deine Einstellungen."
/>
<div class="stack">
	<ComingSoon
		icon={ChartLine}
		color="var(--c-analysis)"
		soft="var(--c-analysis-soft)"
		title="Statistik folgt"
		phase="Kommt bald"
	>
		Rating-Verlauf, Trainingsserie und deine schwächsten Themen – alles auf einen Blick.
	</ComingSoon>
	<a href={resolve('/settings')} class="row card pressable">
		<span class="ico"><Settings size={20} /></span>
		<span class="txt">Einstellungen &amp; Datensicherung</span>
		<ChevronRight size={18} />
	</a>
	<a href={resolve('/about')} class="row card pressable">
		<span class="ico"><Info size={20} /></span>
		<span class="txt">Über Rookie &amp; Lizenzen</span>
		<ChevronRight size={18} />
	</a>
	<a href={resolve('/legal')} class="row card pressable">
		<span class="ico"><Scale size={20} /></span>
		<span class="txt">Impressum &amp; Datenschutz</span>
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
