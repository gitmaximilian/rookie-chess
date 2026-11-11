<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import Link2 from '@lucide/svelte/icons/link-2';
	import {
		getLinked,
		link,
		syncNow,
		syncState,
		analyseInBackground,
		type LinkedAccounts
	} from '#lib/import/sync.svelte.js';
	import { onlineRatings, type OnlineRating } from '#lib/import/ratings.js';
	import type { Source } from '#lib/import/importers.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';

	let { compact = false }: { compact?: boolean } = $props();

	let linked = $state<LinkedAccounts | null>(null);
	let ratings = $state<OnlineRating[]>([]);
	let input = $state<Record<Source, string>>({ lichess: '', chesscom: '' });
	let busy = $state(false);

	const SOURCES: [Source, string][] = [
		['lichess', 'Lichess'],
		['chesscom', 'Chess.com']
	];

	async function refresh() {
		linked = await getLinked();
		ratings = await onlineRatings();
	}

	onMount(refresh);

	// während eines Abrufs (auch im Hintergrund) regelmäßig aktualisieren
	$effect(() => {
		if (!syncState.running) return;
		const id = setInterval(refresh, 2500);
		return () => {
			clearInterval(id);
			void refresh();
		};
	});

	const any = $derived(!!(linked?.lichess || linked?.chesscom));

	async function doLink(src: Source, e: Event) {
		e.preventDefault();
		const name = input[src].trim();
		if (!name) return;
		busy = true;
		await link(src, name);
		input[src] = '';
		await refresh();
		busy = false;
		// komplette Historie läuft im Hintergrund weiter
		void syncNow().then(async () => {
			await refresh();
			void analyseInBackground();
		});
	}

	async function doSync() {
		await syncNow();
		await refresh();
	}

	const speedName = (k: string) => {
		const s = t(`stats.speed.${k}`);
		return s.startsWith('stats.') ? k : s;
	};
	const fmt = (ms?: number) =>
		ms
			? new Date(ms).toLocaleString(intlLocale(), {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				})
			: '';
</script>

{#if linked && !any}
	<section class="cta card" class:compact>
		<div class="cta-head">
			<span class="ico"><Link2 size={20} /></span>
			<div>
				<h2>{t('accounts.ctaTitle')}</h2>
				<p>{t('accounts.ctaText')}</p>
			</div>
		</div>
		<div class="forms">
			{#each SOURCES as [src, label] (src)}
				<form class="f" onsubmit={(e) => doLink(src, e)}>
					<span class="logo {src}">{label[0]}</span>
					<input
						bind:value={input[src]}
						aria-label="{label} {t('import.username')}"
						placeholder="{label}-{t('import.username')}"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
					/>
					<button class="btn small" type="submit" disabled={busy || !input[src].trim()}
						>{t('import.link')}</button
					>
				</form>
			{/each}
		</div>
		<p class="fine">{t('import.noPassword')}</p>
	</section>
{:else if linked}
	<section class="strip card" class:compact>
		<div class="accs">
			{#each SOURCES.filter(([s]) => linked?.[s]) as [src, label] (src)}
				{@const rs = ratings.filter((r) => r.source === src)}
				<div class="acc">
					<span class="logo {src}">{label[0]}</span>
					<div class="acc-main">
						<b>{linked[src]}</b>
						<div class="elos">
							{#each rs.slice(0, compact ? 2 : 4) as r (r.speed)}
								<span class="elo" title="{label} {speedName(r.speed)}">
									<span class="sp">{speedName(r.speed)}</span>
									<b>{r.rating}</b>
									{#if r.delta}
										<span class="d" class:up={r.delta > 0}
											>{#if r.delta > 0}<TrendingUp size={12} />+{:else}<TrendingDown
													size={12}
												/>{/if}{r.delta}</span
										>
									{/if}
								</span>
							{:else}
								<span class="sp">{t('accounts.noRating')}</span>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
		<div class="sync">
			<span class="st" role="status">
				{#if syncState.running}
					{syncState.history
						? t('import.historyProgress', { n: syncState.imported })
						: t('import.syncing')}
				{:else}
					{t('import.lastSync', {
						when: fmt(Math.max(linked.lastSync?.lichess ?? 0, linked.lastSync?.chesscom ?? 0))
					})}
				{/if}
			</span>
			<button
				class="icon-btn"
				onclick={doSync}
				disabled={syncState.running}
				aria-label={t('import.syncNow')}
				title={t('import.syncNow')}
				><RefreshCw size={16} class={syncState.running ? 'spin' : ''} /></button
			>
			{#if !compact}<a class="manage" href={resolve('/import')}>{t('accounts.manage')}</a>{/if}
		</div>
	</section>
{/if}

<style>
	.card {
		padding: 1rem 1.1rem;
	}

	.cta {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		border: 1.5px solid color-mix(in srgb, var(--c-analysis) 45%, transparent);
		background:
			radial-gradient(110% 120% at 100% 0%, var(--c-analysis-soft), transparent 65%), var(--surface);
	}

	.cta-head {
		display: flex;
		gap: 0.8rem;
		align-items: flex-start;
	}

	.cta h2 {
		font-size: 1.1rem;
	}

	.cta p {
		font-size: 0.9rem;
		color: var(--text-2);
		line-height: 1.45;
	}

	.ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--c-analysis);
		color: #fff;
	}

	.forms {
		display: grid;
		gap: 0.5rem;
	}

	@media (min-width: 700px) {
		.forms {
			grid-template-columns: 1fr 1fr;
		}
	}

	.f {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem;
		border-radius: 13px;
		background: var(--surface-2);
	}

	.f input {
		flex: 1;
		min-width: 0;
		height: 38px;
		padding: 0 0.7rem;
		border-radius: 10px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 16px;
	}

	.logo {
		flex: none;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		font-family: var(--font-display);
		font-weight: 800;
		color: #fff;
		background: #3a3632;
	}

	.logo.chesscom {
		background: #5d8a3a;
	}

	.fine {
		font-size: 0.78rem !important;
	}

	.strip {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.accs {
		display: grid;
		gap: 0.6rem;
	}

	@media (min-width: 700px) {
		.strip:not(.compact) .accs {
			grid-template-columns: 1fr 1fr;
		}
	}

	.acc {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
	}

	.acc-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.elos {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.elo {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--surface-2);
		font-variant-numeric: tabular-nums;
	}

	.elo b {
		font-size: 1rem;
	}

	.sp {
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.d {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--bad);
	}

	.d.up {
		color: var(--good);
	}

	.sync {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.st {
		flex: 1;
		min-width: 0;
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--text-2);
		cursor: pointer;
	}

	.manage {
		font-weight: 650;
		color: var(--accent);
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
