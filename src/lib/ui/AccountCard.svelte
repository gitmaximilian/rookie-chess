<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import LogOut from '@lucide/svelte/icons/log-out';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import {
		account,
		createAccount,
		signIn,
		signOut,
		syncNow,
		deleteAccount,
		downloadServerData,
		refreshAccount
	} from '#lib/sync/sync.svelte.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	let busy = $state(false);
	let notice = $state('');

	onMount(() => {
		if (account.status === 'unknown') void refreshAccount();
	});

	async function run(fn: () => Promise<unknown>) {
		busy = true;
		notice = '';
		try {
			await fn();
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!confirm(t('account.deleteConfirm'))) return;
		await run(async () => {
			if (await deleteAccount()) notice = t('account.deleted');
		});
	}

	const fmt = (ms: number, withTime = true) =>
		new Date(ms).toLocaleString(intlLocale(), {
			day: 'numeric',
			month: 'short',
			year: withTime ? undefined : 'numeric',
			hour: withTime ? '2-digit' : undefined,
			minute: withTime ? '2-digit' : undefined
		});
</script>

<section class="card block account" data-status={account.status}>
	<h2>
		{#if account.status === 'offline'}<CloudOff size={18} />{:else}<Cloud size={18} />{/if}
		{t('account.title')}
	</h2>

	{#if account.status === 'in'}
		<p class="ok"><ShieldCheck size={16} /> {t('account.signedIn')}</p>
		<p class="meta">
			{t('account.since', { date: fmt(account.created, false) })} ·
			{account.lastSync
				? t('account.lastSync', { when: fmt(account.lastSync) })
				: t('account.never')}
		</p>
		<div class="row-btns">
			<button class="btn" onclick={() => run(syncNow)} disabled={busy || account.syncing}>
				<RefreshCw size={17} class={account.syncing ? 'spin' : ''} />
				{account.syncing ? t('account.syncing') : t('account.syncNow')}
			</button>
			<button class="btn secondary" onclick={() => run(downloadServerData)} disabled={busy}
				><Download size={17} /> {t('account.export')}</button
			>
		</div>
		<p class="fine">{t('account.notSynced')}</p>
		<div class="row-btns">
			<button class="btn ghost" onclick={() => run(signOut)} disabled={busy}
				><LogOut size={16} /> {t('account.signOut')}</button
			>
			<button class="btn ghost danger" onclick={remove} disabled={busy}
				><Trash2 size={16} /> {t('account.delete')}</button
			>
		</div>
	{:else if account.status === 'offline'}
		<p class="meta">{t('account.offline')}</p>
	{:else}
		<p>{t('account.pitch')}</p>
		<p class="meta"><KeyRound size={15} /> {t('account.how')}</p>
		<div class="row-btns">
			<button class="btn" onclick={() => run(createAccount)} disabled={busy}
				>{t('account.create')}</button
			>
			<button class="btn secondary" onclick={() => run(signIn)} disabled={busy}
				>{t('account.signIn')}</button
			>
		</div>
		<p class="fine">
			{t('account.terms')}
			<a href={resolve('/privacy')}>{t('account.privacy')}</a>
		</p>
	{/if}

	{#if account.error}<p class="err" role="alert">{t(`account.err.${account.error}`)}</p>{/if}
	{#if notice}<p class="ok" role="status">{notice}</p>{/if}
</section>

<style>
	.account {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.15rem 1.25rem;
		background:
			radial-gradient(100% 120% at 100% 0%, var(--c-puzzle-soft), transparent 65%), var(--surface);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 1.1rem;
	}

	.meta {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		color: var(--text-2);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.meta :global(svg) {
		flex: none;
		margin-top: 0.15rem;
	}

	.fine {
		font-size: 0.8rem;
		color: var(--text-2);
		line-height: 1.45;
	}

	.fine a {
		color: var(--accent);
		font-weight: 650;
	}

	.ok {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--good);
		font-weight: 650;
	}

	.err {
		color: var(--bad);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn.ghost {
		background: none;
		box-shadow: none;
		color: var(--text-2);
		padding-inline: 0.4rem;
	}

	.btn.ghost.danger {
		color: var(--bad);
	}

	:global(.spin) {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
