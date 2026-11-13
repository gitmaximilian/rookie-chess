<script lang="ts">
	/**
	 * Neue Adresse: übernimmt die Daten, die static/move-out.html der alten Adresse mitgebracht hat
	 * (siehe lib/move). Klappt das nicht, geht es zurück zur alten Adresse, die dann eine Sicherung anbietet.
	 */
	import { onMount } from 'svelte';
	import { brought, OLD_ORIGIN, safePath, takeOver } from '#lib/move/move.js';

	onMount(async () => {
		const to = safePath(new URLSearchParams(location.search).get('to'));
		const had = brought();
		if (await takeOver()) location.replace(to);
		else if (had || document.referrer.startsWith(OLD_ORIGIN))
			location.replace(`${OLD_ORIGIN}/?move=failed`);
		else location.replace(to);
	});
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<p class="moving">Rookie …</p>

<style>
	.moving {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		margin: 0;
		font-weight: 600;
	}
</style>
