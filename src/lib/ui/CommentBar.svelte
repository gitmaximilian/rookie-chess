<script lang="ts">
	/**
	 * Kommentar über dem Brett (nur Handy): erst lesen, was passiert ist, dann auf dem Brett sehen, wo.
	 * Feste Höhe (--comment-h in app.css) – das Brett springt nie, egal wie lang der Text ist.
	 * Längere Erklärungen öffnen sich über „Mehr“ als Blatt von unten.
	 * Am iPad/Desktop unsichtbar: dort stehen Kommentare in der Seitenspalte.
	 */
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let {
		kicker = '',
		title = '',
		text = '',
		color = 'var(--c-learn)',
		icon,
		action,
		status = '',
		testid
	}: {
		/** kurze Kopfzeile in Mono, z. B. „Dein Zug · Patzer“ */
		kicker?: string;
		title?: string;
		text?: string;
		/** Akzentfarbe (Zugart, Status) */
		color?: string;
		icon?: Snippet;
		/** kleine Aktion zum Kommentar, z. B. „Drohung zeigen“ */
		action?: Snippet;
		/** maschinenlesbarer Zustand (data-state), z. B. für Tests */
		status?: string;
		testid?: string;
	} = $props();

	let body = $state<HTMLElement>();
	let dialog = $state<HTMLDialogElement>();
	let clipped = $state(false);
	let sheetOpen = $state(false);

	// nur auf dem Handy erzeugen – am iPad/Desktop steht der Kommentar in der Seitenspalte
	let mobile = $state(typeof window !== 'undefined' && matchMedia('(max-width: 767px)').matches);
	$effect(() => {
		const mq = matchMedia('(max-width: 767px)');
		mobile = mq.matches;
		const on = () => (mobile = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	// nach jedem neuen Text prüfen, ob etwas abgeschnitten ist
	$effect(() => {
		void title;
		void text;
		requestAnimationFrame(() => {
			// Titel und Text sind auf Zeilen begrenzt: abgeschnitten, wenn ihr Inhalt höher ist als sichtbar
			if (body)
				clipped =
					body.scrollHeight > body.clientHeight + 1 ||
					[...body.querySelectorAll('p')].some((el) => el.scrollHeight > el.clientHeight + 1);
		});
	});
</script>

{#if mobile}
	<section
		class="cbar"
		style:--cb={color}
		aria-live="polite"
		data-testid={testid}
		data-state={status || undefined}
		aria-label={kicker || title}
	>
		{#if icon}<span class="ico" aria-hidden="true">{@render icon()}</span>{/if}
		<div class="body" bind:this={body}>
			{#if kicker}<span class="kick mono-label">{kicker}</span>{/if}
			{#if title}<p class="title">{title}</p>{/if}
			{#if text}<p class="text">{text}</p>{/if}
		</div>
		{#if clipped || action}
			<div class="acts">
				{#if action}{@render action()}{/if}
				{#if clipped}
					<button
						class="more mono-label"
						onclick={() => {
							sheetOpen = true;
							dialog?.showModal();
						}}>{t('common.more')}</button
					>
				{/if}
			</div>
		{/if}
	</section>

	<dialog
		class="sheet"
		bind:this={dialog}
		style:--cb={color}
		onclose={() => (sheetOpen = false)}
		onclick={(e) => {
			if (e.target === dialog) dialog?.close();
		}}
	>
		{#if sheetOpen}
			<div class="sheet-in">
				<div class="sheet-head">
					{#if kicker}<span class="kick mono-label">{kicker}</span>{/if}
					<button class="close" onclick={() => dialog?.close()} aria-label={t('common.close')}
						><X size={18} /></button
					>
				</div>
				{#if title}<p class="title">{title}</p>{/if}
				{#if text}<p class="full">{text}</p>{/if}
			</div>
		{/if}
	</dialog>
{/if}

<style>
	@media (max-width: 767px) {
		.cbar {
			position: relative;
			display: flex;
			gap: 0.65rem;
			height: var(--comment-h);
			margin-bottom: 0.5rem;
			padding: 0.6rem 0.75rem;
			border-radius: 20px;
			background: color-mix(in srgb, var(--cb) 9%, var(--surface));
			border: 1px solid color-mix(in srgb, var(--cb) 28%, transparent);
			overflow: hidden;
		}
	}

	.ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		margin-top: 0.1rem;
		border-radius: 50%;
		background: var(--cb);
		color: #fff;
		font-family: var(--font-num);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		overflow: hidden;
	}

	.kick {
		color: color-mix(in srgb, var(--cb) 70%, var(--text));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title {
		font-weight: 650;
		font-size: 0.95rem;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}

	.text {
		font-size: 0.86rem;
		line-height: 1.35;
		color: var(--text-2);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}

	.acts {
		flex: none;
		align-self: flex-end;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.3rem;
	}

	/* Aktionen (eigene Knöpfe der Seite) im gleichen Stil wie „Mehr“ */
	.acts :global(button:not(.more)),
	.more {
		position: relative;
		min-height: 28px;
		padding: 0 0.65rem;
		border: none;
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 0 0 1px var(--line);
		font: inherit;
		font-family: var(--font-num);
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}

	/* 44 px Tippfläche */
	.acts :global(button:not(.more))::after,
	.more::after {
		content: '';
		position: absolute;
		inset: -8px -4px;
	}

	.sheet {
		margin: auto auto 0;
		width: 100%;
		max-width: 560px;
		max-height: 70dvh;
		padding: 0;
		border: none;
		border-radius: 24px 24px 0 0;
		background: var(--surface);
		color: var(--text);
	}

	.sheet::backdrop {
		background: rgb(0 0 0 / 0.35);
	}

	.sheet-in {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 1.15rem calc(1.25rem + var(--safe-bottom));
		border-top: 3px solid var(--cb);
	}

	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sheet .title {
		display: block;
		font-size: 1.05rem;
	}

	.full {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--text-2);
	}

	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 50%;
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}
</style>
