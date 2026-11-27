<script lang="ts">
	/**
	 * „Was auf deinem Niveau zählt“ (lib/training/levels.ts): Stufe, Anteile der fünf Fähigkeiten am Weg
	 * zum nächsten Niveau (Lichess-Daten) und die Schwerpunkte der Stufe mit Links.
	 */
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { priorities, stageFor } from '#lib/training/levels.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	/** embedded: ohne eigene Karte und Überschrift (z. B. aufgeklappt in der Schwerpunkt-Karte des Coachs) */
	let { elo, embedded = false }: { elo: number | null; embedded?: boolean } = $props();

	const stage = $derived(stageFor(elo));
	const prio = $derived(priorities(elo));
</script>

<section class="level" class:card={!embedded} class:embedded data-testid="level-focus">
	{#if !embedded}<span class="mono-label kick">{t('levels.title')}</span>{/if}
	<h2>{t(`levels.stage.${stage.id}`)}</h2>
	<p class="muted">
		{elo ? t('levels.intro', { elo }) : t('levels.introNone')}
	</p>
	<ul class="bars">
		{#each prio as p (p.skill)}
			<li>
				<span class="b-name">{t(`skills.name.${p.skill}`)}</span>
				<span class="b-track"><span style:width="{Math.round(p.share * 100)}%"></span></span>
				<b class="b-pct">{Math.round(p.share * 100)} %</b>
			</li>
		{/each}
	</ul>
	<h3>{t('levels.next')}</h3>
	<ol class="focus">
		{#each stage.focus as f (f.key)}
			<li>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href wird hier aufgelöst -->
				<a href={resolve(f.href as '/')}
					><span>{t(`levels.focus.${f.key}`)}</span><ChevronRight size={16} /></a
				>
			</li>
		{/each}
	</ol>
</section>

<style>
	.level {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem;
	}

	.level.embedded {
		padding: 0.6rem 0 0;
	}

	.kick {
		color: var(--text-3);
	}

	h2 {
		font-size: 1.15rem;
	}

	h3 {
		font-size: 0.8rem;
		letter-spacing: 0;
		color: var(--text-3);
		margin-top: 0.3rem;
	}

	.muted {
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.bars li {
		display: grid;
		grid-template-columns: 6.5rem 1fr 3rem;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.86rem;
	}

	.b-track {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.b-track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--c-coach);
	}

	.b-pct {
		font-family: var(--font-num);
		font-weight: 500;
		text-align: right;
	}

	.focus {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.focus a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0.45rem 0.7rem;
		border-radius: 12px;
		background: var(--surface-2);
		color: var(--text);
		font-weight: 600;
		font-size: 0.92rem;
	}
</style>
