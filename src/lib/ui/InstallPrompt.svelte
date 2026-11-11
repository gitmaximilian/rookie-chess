<script lang="ts">
	import Share from '@lucide/svelte/icons/share';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import Check from '@lucide/svelte/icons/check';
	import Download from '@lucide/svelte/icons/download';
	import X from '@lucide/svelte/icons/x';
	import Logo from '#lib/ui/Logo.svelte';
	import { install, startInstall, dismissInstall } from '#lib/ui/install.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { page } from '$app/state';

	// nur auf Übersichtsseiten – nie über einem Brett oder dem Start-Button
	const CALM = new Set([
		'/',
		'/learn',
		'/profile',
		'/profile/stats',
		'/settings',
		'/about',
		'/import'
	]);
	const calm = $derived(CALM.has(page.url.pathname));

	const apple = $derived(install.platform === 'ios' || install.platform === 'ipad');
</script>

{#if install.banner && !install.standalone && calm}
	<div class="banner card" role="dialog" aria-label={t('install.title')}>
		<span class="logo"><Logo size={40} /></span>
		<span class="text">
			<b>{t('install.title')}</b>
			<span>{t('install.short')}</span>
		</span>
		<button class="btn" onclick={startInstall}>
			{#if install.canPrompt}<Download size={17} />{/if}
			{install.canPrompt ? t('install.install') : t('install.how')}
		</button>
		<button class="x" onclick={dismissInstall} aria-label={t('install.later')}
			><X size={18} /></button
		>
	</div>
{/if}

{#if install.guide}
	<div class="backdrop" role="presentation" onclick={() => (install.guide = false)}></div>
	<div class="sheet card" role="dialog" aria-modal="true" aria-label={t('install.guideTitle')}>
		<h2>{t('install.guideTitle')}</h2>
		<p class="lead">{t('install.guideLead')}</p>
		{#if apple}
			<ol>
				<li>
					<span class="ico"><Share size={20} /></span>
					<span>{install.platform === 'ipad' ? t('install.ios1ipad') : t('install.ios1')}</span>
				</li>
				<li>
					<span class="ico"><SquarePlus size={20} /></span>
					<span>{t('install.ios2')}</span>
				</li>
				<li>
					<span class="ico"><Check size={20} /></span>
					<span>{t('install.ios3')}</span>
				</li>
			</ol>
			<p class="note">{t('install.iosNote')}</p>
		{:else}
			<ol>
				<li>
					<span class="ico">⋮</span>
					<span>{t('install.other1')}</span>
				</li>
				<li>
					<span class="ico"><SquarePlus size={20} /></span>
					<span>{t('install.other2')}</span>
				</li>
			</ol>
		{/if}
		<div class="actions">
			<button class="btn" onclick={() => (install.guide = false)}>{t('install.gotIt')}</button>
			<button class="btn secondary" onclick={dismissInstall}>{t('install.later')}</button>
		</div>
	</div>
{/if}

<style>
	.banner {
		position: fixed;
		z-index: 80;
		left: max(0.75rem, var(--safe-left));
		right: max(0.75rem, var(--safe-right));
		bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 0.6rem);
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.6rem 0.7rem 0.75rem;
		border: 1px solid var(--line-strong);
		box-shadow: var(--shadow-2);
		animation: up 420ms var(--ease-spring) both;
	}

	@media (min-width: 768px) {
		.banner {
			left: auto;
			right: 1.5rem;
			bottom: 1.5rem;
			max-width: 460px;
		}
	}

	.logo {
		flex: none;
		display: grid;
	}

	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	.text b {
		font-size: 0.95rem;
	}

	.text span {
		font-size: 0.82rem;
		color: var(--text-2);
	}

	.banner .btn {
		flex: none;
		height: 38px;
		padding-inline: 0.8rem;
		font-size: 0.88rem;
		white-space: nowrap;
	}

	.x {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--text-2);
		cursor: pointer;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 95;
		background: rgb(0 0 0 / 0.45);
		animation: fade 200ms ease-out both;
	}

	.sheet {
		position: fixed;
		z-index: 96;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.4rem 1.25rem calc(1.25rem + var(--safe-bottom));
		border-radius: 24px 24px 0 0;
		animation: sheet 380ms var(--ease-out) both;
	}

	@media (min-width: 768px) {
		.sheet {
			left: 50%;
			right: auto;
			bottom: 50%;
			width: min(440px, 92vw);
			transform: translate(-50%, 50%);
			border-radius: 24px;
			animation: fade 240ms ease-out both;
		}
	}

	.sheet h2 {
		font-size: 1.35rem;
	}

	.lead,
	.note {
		color: var(--text-2);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		counter-reset: step;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 0.8rem;
		border-radius: 14px;
		background: var(--surface-2);
		line-height: 1.4;
	}

	.ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--surface);
		color: var(--accent);
		font-size: 1.3rem;
		font-weight: 800;
		box-shadow: var(--shadow-1);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}

	.actions .btn:first-child {
		flex: 1;
	}

	@keyframes up {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}

	@keyframes sheet {
		from {
			transform: translateY(100%);
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
