<script lang="ts">
	/**
	 * Nur unter der alten Adresse: Daten an die neue Adresse übergeben und dorthin weiterleiten.
	 * Klappt das nicht (oder läuft Rookie als Home-Bildschirm-App mit eigenem Speicher),
	 * erklärt ein Hinweis, wie man die Daten per Sicherung oder Konto mitnimmt.
	 */
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { downloadBackup } from '#lib/db/backup.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import {
		alreadyMoved,
		clearMoved,
		hasLocalData,
		isStandalone,
		NEW_ORIGIN,
		newUrl
	} from './move.js';

	let mode = $state<'sending' | 'pwa' | 'failed' | 'hidden'>('sending');

	function go() {
		location.replace(mode === 'failed' ? `${NEW_ORIGIN}/` : newUrl());
	}

	/** Daten im selben Tab mitnehmen (static/move-out.html → /move-in der neuen Adresse) */
	function moveOut(to: string) {
		location.replace(`/move-out?to=${encodeURIComponent(to)}`);
	}

	async function run() {
		mode = 'sending';
		if (isStandalone()) {
			mode = 'pwa';
			return;
		}
		// zurück von der neuen Adresse, weil die Übernahme nicht geklappt hat
		if (new URLSearchParams(location.search).get('move') === 'failed') {
			clearMoved();
			mode = 'failed';
			return;
		}
		if (alreadyMoved() || !(await hasLocalData())) return go();
		moveOut(location.pathname + location.search + location.hash);
	}

	onMount(run);
</script>

{#if mode !== 'hidden'}
	<div class="move" role="dialog" aria-modal="true" aria-labelledby="move-title" data-testid="move">
		<div class="card tone-play">
			{#if mode === 'sending'}
				<p class="sending" id="move-title" aria-live="polite">{t('move.sending')}</p>
			{:else}
				<h2 id="move-title">{t('move.title')}</h2>
				<p class="addr num">{t('move.address')}</p>
				{#if mode === 'pwa'}
					<p>{t('move.pwaText')}</p>
					<ol>
						<li>{t('move.step1')}</li>
						<li>{t('move.step2')}</li>
						<li>{t('move.step3')}</li>
					</ol>
				{:else}
					<p>{t('move.failText')}</p>
				{/if}
				<p class="hint">{t('move.account')}</p>
				<div class="acts">
					<button class="btn big" onclick={() => downloadBackup()}
						><Download size={18} /> {t('move.save')}</button
					>
					{#if mode === 'failed'}
						<button class="btn secondary" onclick={() => moveOut('/')}>{t('move.retry')}</button>
					{/if}
					<button class="btn secondary" onclick={go}
						>{t('move.open')} <ArrowRight size={18} /></button
					>
					{#if mode === 'pwa'}
						<button class="btn secondary" onclick={() => (mode = 'hidden')}
							>{t('move.later')}</button
						>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.move {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: max(16px, var(--safe-top)) 16px max(16px, var(--safe-bottom));
		background: var(--bg);
		overflow-y: auto;
	}

	.card {
		width: 100%;
		max-width: 440px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.5rem 1.25rem;
		border-radius: var(--radius-tile);
		background: var(--tone-bg);
		color: var(--text);
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
	}

	.addr {
		margin: 0;
		font-weight: 600;
		color: var(--tone-ink);
	}

	p,
	ol {
		margin: 0;
		line-height: 1.45;
	}

	ol {
		padding-left: 1.25rem;
		display: grid;
		gap: 0.35rem;
	}

	.hint {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.sending {
		font-weight: 600;
		text-align: center;
	}

	.acts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.acts .btn {
		width: 100%;
		justify-content: center;
	}
</style>
