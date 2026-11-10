<script lang="ts">
	import PageHeader from '#lib/ui/PageHeader.svelte';

	import { t } from '#lib/i18n/i18n.svelte.js';

	const credits = [
		{ name: 'Stockfish', key: 'stockfish', license: 'GPL-3.0', url: 'https://stockfishchess.org' },
		{
			name: 'stockfish.js',
			key: 'stockfishjs',
			license: 'GPL-3.0',
			url: 'https://github.com/nmrugg/stockfish.js'
		},
		{
			name: 'chessground',
			key: 'chessground',
			license: 'GPL-3.0',
			url: 'https://github.com/lichess-org/chessground'
		},
		{
			name: 'chessops',
			key: 'chessops',
			license: 'GPL-3.0',
			url: 'https://github.com/niklasf/chessops'
		},
		{
			name: 'Lichess puzzle database',
			key: 'puzzles',
			license: 'CC0',
			url: 'https://database.lichess.org'
		},
		{
			name: 'Lichess chess-openings',
			key: 'openings',
			license: 'CC0',
			url: 'https://github.com/lichess-org/chess-openings'
		},
		{
			name: 'Lichess tablebase',
			key: 'tablebase',
			license: 'AGPL-3.0',
			url: 'https://tablebase.lichess.ovh'
		},
		{ name: 'Lucide', key: 'lucide', license: 'ISC', url: 'https://lucide.dev' },
		{
			name: 'Bricolage Grotesque',
			key: 'font',
			license: 'OFL-1.1',
			url: 'https://github.com/ateliertriay/bricolage'
		},
		{ name: 'Dexie', key: 'dexie', license: 'Apache-2.0', url: 'https://dexie.org' },
		{
			name: 'ts-fsrs',
			key: 'fsrs',
			license: 'MIT',
			url: 'https://github.com/open-spaced-repetition/ts-fsrs'
		}
	];
</script>

<svelte:head><title>{t('about.title')} – Rookie</title></svelte:head>

<PageHeader eyebrow={t('about.eyebrow')} title={t('about.title')} subtitle={t('about.subtitle')} />

<div class="wrap">
	<section class="card block">
		<h2>{t('about.licence')}</h2>
		<p>{t('about.licenceText')}</p>
		<p class="src">
			<a
				href="https://github.com/gitmaximilian/rookie-chess"
				target="_blank"
				rel="noopener noreferrer">{t('about.source')} →</a
			>
		</p>
	</section>

	<section class="card block">
		<h2>{t('about.thanks')}</h2>
		<ul>
			{#each credits as c (c.name)}
				<li>
					<a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a>
					<span class="what">{t(`about.credits.${c.key}`)}</span>
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
	.src {
		margin-top: 0.6rem;
		font-weight: 600;
	}
	.src a:hover {
		color: var(--accent);
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
