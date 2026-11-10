<script lang="ts">
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ComingSoon from '#lib/ui/ComingSoon.svelte';
</script>

<svelte:head><title>Spielen – Rookie</title></svelte:head>

<PageHeader
	eyebrow="Gegen den Computer"
	title="Spielen"
	subtitle="Wähle einen Gegner, der zu dir passt."
/>
<ComingSoon
	icon={ChessKnight}
	color="var(--c-play)"
	soft="var(--c-play-soft)"
	title="Die Bots wärmen sich auf"
	phase="Kommt bald"
>
	Bald spielst du hier gegen acht Bots mit eigener Persönlichkeit – vom freundlichen Anfänger bis
	zum harten Brocken. Mit Hinweisen und Zug zurück.
</ComingSoon>
