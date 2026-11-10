<script lang="ts">
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const credits = [
		{
			name: 'Stockfish',
			what: 'Schach-Engine',
			license: 'GPL-3.0',
			url: 'https://stockfishchess.org'
		},
		{
			name: 'stockfish.js',
			what: 'WebAssembly-Version',
			license: 'GPL-3.0',
			url: 'https://github.com/nmrugg/stockfish.js'
		},
		{
			name: 'chessground',
			what: 'Schachbrett',
			license: 'GPL-3.0',
			url: 'https://github.com/lichess-org/chessground'
		},
		{
			name: 'chessops',
			what: 'Schachregeln & PGN',
			license: 'GPL-3.0',
			url: 'https://github.com/niklasf/chessops'
		},
		{
			name: 'Lichess-Puzzle-Datenbank',
			what: 'Taktik-Aufgaben',
			license: 'CC0',
			url: 'https://database.lichess.org'
		},
		{ name: 'Lucide', what: 'Icons', license: 'ISC', url: 'https://lucide.dev' },
		{
			name: 'Bricolage Grotesque',
			what: 'Schrift',
			license: 'OFL-1.1',
			url: 'https://github.com/ateliertriay/bricolage'
		},
		{ name: 'Dexie', what: 'Lokale Datenbank', license: 'Apache-2.0', url: 'https://dexie.org' },
		{
			name: 'ts-fsrs',
			what: 'Wiederholungs-Algorithmus',
			license: 'MIT',
			url: 'https://github.com/open-spaced-repetition/ts-fsrs'
		}
	];
</script>

<svelte:head><title>Über – Rookie</title></svelte:head>

<PageHeader
	eyebrow="Open Source"
	title="Über Rookie"
	subtitle="Ein kostenloser Schach-Trainer. Keine Werbung, kein Tracking, keine Anmeldung."
/>

<div class="wrap">
	<section class="card block">
		<h2>Lizenz</h2>
		<p>
			Rookie steht unter der <b>GNU General Public License v3</b>. Du darfst den Code nutzen,
			verändern und weitergeben – solange er offen bleibt. Alle Daten bleiben auf deinem Gerät.
		</p>
	</section>

	<section class="card block">
		<h2>Danke an</h2>
		<ul>
			{#each credits as c (c.name)}
				<li>
					<a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a>
					<span class="what">{c.what}</span>
					<span class="lic">{c.license}</span>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 720px;
	}
	.block {
		padding: 1.25rem 1.35rem;
	}
	h2 {
		font-size: 1.2rem;
		margin-bottom: 0.6rem;
	}
	p {
		color: var(--text-2);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--line);
	}
	li:first-child {
		border-top: none;
	}
	li a {
		font-weight: 600;
	}
	li a:hover {
		color: var(--accent);
	}
	.what {
		flex: 1;
		color: var(--text-2);
		font-size: 0.92rem;
	}
	.lic {
		font-size: 0.75rem;
		font-weight: 650;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
		white-space: nowrap;
	}
</style>
