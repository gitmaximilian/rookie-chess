<script lang="ts">
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ComingSoon from '#lib/ui/ComingSoon.svelte';
</script>

<svelte:head><title>Puzzles – Rookie</title></svelte:head>

<PageHeader eyebrow="Taktik" title="Puzzles" subtitle="Finde den besten Zug – Rätsel für Rätsel." />
<ComingSoon
	icon={Puzzle}
	color="var(--c-puzzle)"
	soft="var(--c-puzzle-soft)"
	title="Tausende Rätsel unterwegs"
	phase="Kommt bald"
>
	Taktik-Puzzles aus der freien Lichess-Datenbank, passend zu deinem Rating. Falsche Lösungen kommen
	automatisch zur Wiederholung.
</ComingSoon>
