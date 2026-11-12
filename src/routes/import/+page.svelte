<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Square from '@lucide/svelte/icons/square';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import {
		fetchLichess,
		fetchChessCom,
		toGameRow,
		ImportError,
		type Source
	} from '#lib/import/importers.js';
	import { db, getSetting, setSetting } from '#lib/db/db.js';
	import { analyseGame, createMistakePuzzles } from '#lib/analysis/run.js';
	import { t, intlLocale } from '#lib/i18n/i18n.svelte.js';
	import Link2 from '@lucide/svelte/icons/link-2';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import {
		getLinked,
		link,
		unlink,
		syncNow,
		syncState,
		analyseInBackground,
		type LinkedAccounts
	} from '#lib/import/sync.svelte.js';

	const SOURCES: [Source, string][] = [
		['lichess', 'Lichess'],
		['chesscom', 'Chess.com']
	];
	let linked = $state<LinkedAccounts>({});
	let linkInput = $state<Record<Source, string>>({ lichess: '', chesscom: '' });

	async function refreshLinked() {
		linked = await getLinked();
	}

	async function doLink(src: Source, e: Event) {
		e.preventDefault();
		const name = linkInput[src].trim();
		if (!name) return;
		await link(src, name);
		linkInput[src] = '';
		await refreshLinked();
		await syncNow();
		await refreshLinked();
		void analyseInBackground();
	}

	async function doUnlink(src: Source) {
		await unlink(src);
		await refreshLinked();
	}

	// Fortschritt der Historie auch anzeigen, wenn der Abruf im Hintergrund (App-Start) läuft
	$effect(() => {
		if (!syncState.running) return;
		const id = setInterval(refreshLinked, 2000);
		return () => {
			clearInterval(id);
			void refreshLinked();
		};
	});

	async function doSync() {
		await syncNow();
		await refreshLinked();
		void analyseInBackground();
	}

	function when(ms?: number) {
		if (!ms) return t('import.notSynced');
		return t('import.lastSync', {
			when: new Date(ms).toLocaleString(intlLocale(), {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit'
			})
		});
	}

	let source = $state<Source>('lichess');
	let user = $state('');
	let count = $state(20);
	let auto = $state(true);

	let phase = $state<'idle' | 'loading' | 'analysing' | 'done' | 'error'>('idle');
	let progress = $state({ i: 0, n: 0, ply: 0 });
	let summary = $state({ g: 0, m: 0 });
	let errorKey = $state('');
	let abort: AbortController | null = null;

	onMount(async () => {
		await refreshLinked();
		const saved = await getSetting<{ source: Source; user: string } | null>('importUser', null);
		if (saved) {
			source = saved.source;
			user = saved.user;
		}
	});

	async function run(e: Event) {
		e.preventDefault();
		const name = user.trim();
		if (!name) return;
		await setSetting('importUser', { source, user: name });
		phase = 'loading';
		errorKey = '';
		summary = { g: 0, m: 0 };
		abort = new AbortController();
		try {
			const games =
				source === 'lichess' ? await fetchLichess(name, count) : await fetchChessCom(name, count);
			const ids: number[] = [];
			for (const g of games) {
				if (await db.games.where('externalId').equals(g.externalId).first()) continue;
				const row = toGameRow(g, name);
				if (!row) continue;
				ids.push((await db.games.add(row)) as number);
			}
			summary.g = ids.length;
			if (!ids.length) {
				phase = 'done';
				return;
			}
			if (auto) {
				phase = 'analysing';
				progress = { i: 0, n: ids.length, ply: 0 };
				for (const id of ids) {
					if (abort.signal.aborted) break;
					progress.i++;
					const row = await db.games.get(id);
					if (!row) continue;
					const evals = await analyseGame(
						row,
						(done, total) => (progress.ply = done / total),
						abort.signal
					);
					const fresh = await db.games.get(id);
					if (fresh?.analysis?.done) summary.m += await createMistakePuzzles(fresh, evals);
				}
			}
			phase = 'done';
		} catch (err) {
			errorKey =
				err instanceof ImportError && err.code === 'notFound' ? 'import.notFound' : 'import.error';
			phase = 'error';
		}
	}

	function stop() {
		abort?.abort();
	}
</script>

<svelte:head><title>{t('import.title')} – Rookie</title></svelte:head>

<PageHeader
	eyebrow={t('import.eyebrow')}
	title={t('import.title')}
	subtitle={t('import.subtitle')}
/>

<div class="wrap">
	<section class="card form accounts">
		<h2><Link2 size={18} /> {t('import.accounts')}</h2>
		<p class="hint">{t('import.accountsText')}</p>
		{#each SOURCES as [src, label] (src)}
			<div class="acc">
				<span class="acc-logo {src}">{label[0]}</span>
				{#if linked[src]}
					<div class="acc-text">
						<b>{linked[src]}</b>
						<span>{label} · {when(linked.lastSync?.[src])}</span>
						<span class="hist" class:done={linked.backfill?.[src]?.done}>
							{linked.backfill?.[src]?.done ? t('import.historyDone') : t('import.historyLoading')}
						</span>
					</div>
					<button class="btn secondary small" onclick={() => doUnlink(src)}
						>{t('import.unlink')}</button
					>
				{:else}
					<form class="acc-form" onsubmit={(e) => doLink(src, e)}>
						<input
							bind:value={linkInput[src]}
							aria-label="{label} {t('import.username')}"
							placeholder={t('import.username')}
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
						/>
						<button class="btn small" type="submit">{t('import.link')}</button>
					</form>
				{/if}
			</div>
		{/each}
		{#if linked.lichess || linked.chesscom}
			<button class="btn secondary" onclick={doSync} disabled={syncState.running}>
				<RefreshCw size={17} class={syncState.running ? 'spin' : ''} />
				{syncState.running ? t('import.syncing') : t('import.syncNow')}
			</button>
		{/if}
		{#if syncState.running && syncState.imported}
			<p class="live" role="status">
				{syncState.history
					? t('import.historyProgress', { n: syncState.imported })
					: t('import.newProgress', { n: syncState.imported })}
			</p>
		{/if}
		{#if syncState.error === 'rateLimit'}<p class="err">{t('import.rateLimit')}</p>
		{:else if syncState.error}<p class="err">{t('import.syncError')}</p>{/if}
		<p class="privacy"><ShieldCheck size={15} /> {t('import.noPassword')}</p>
	</section>

	<h2 class="once">{t('import.once')}</h2>
	<form class="card form" onsubmit={run}>
		<div class="seg" role="radiogroup" aria-label="Source">
			{#each [['lichess', 'Lichess'], ['chesscom', 'Chess.com']] as [id, label] (id)}
				<button
					type="button"
					role="radio"
					aria-checked={source === id}
					class:on={source === id}
					onclick={() => (source = id as Source)}>{label}</button
				>
			{/each}
		</div>

		<label class="field">
			<span>{t('import.username')}</span>
			<input
				bind:value={user}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				placeholder={source === 'lichess' ? 'DrNykterstein' : 'hikaru'}
				required
			/>
		</label>

		<label class="field">
			<span>{t('import.count')}</span>
			<select bind:value={count}>
				{#each [10, 20, 50] as n (n)}<option value={n}>{n}</option>{/each}
			</select>
		</label>

		<label class="check">
			<input type="checkbox" bind:checked={auto} />
			<span>{t('import.autoAnalyse')}</span>
		</label>

		<button class="btn big" type="submit" disabled={phase === 'loading' || phase === 'analysing'}>
			<CloudDownload size={19} />
			{t('import.load')}
		</button>

		<p class="privacy"><ShieldCheck size={15} /> {t('import.privacy')}</p>
	</form>

	{#if phase !== 'idle'}
		<section class="card status {phase}">
			{#if phase === 'loading'}
				<p class="s-title">{t('import.loading', { n: '' })}</p>
				<div class="track"><div class="fill indeterminate"></div></div>
			{:else if phase === 'analysing'}
				<p class="s-title">{t('import.analysing', { i: progress.i, n: progress.n })}</p>
				<div class="track">
					<div
						class="fill"
						style:width="{((progress.i - 1 + progress.ply) / progress.n) * 100}%"
					></div>
				</div>
				<button class="btn secondary small" onclick={stop}
					><Square size={15} /> {t('import.stop')}</button
				>
			{:else if phase === 'done'}
				<p class="s-title">{summary.g ? t('import.done', summary) : t('import.none')}</p>
				<div class="row-btns">
					{#if summary.m}
						<a class="btn" href={resolve('/puzzles?mode=mistakes')}
							><Sparkles size={18} /> {t('import.practise')}</a
						>
					{/if}
					<a class="btn secondary" href={resolve('/analysis')}
						><ChartLine size={18} /> {t('import.toGames')}</a
					>
				</div>
			{:else}
				<p class="s-title err">{t(errorKey)}</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.accounts h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 1.1rem;
	}

	.hint {
		color: var(--text-2);
		font-size: 0.92rem;
		margin-top: -0.4rem;
	}

	.acc {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem;
		border-radius: 14px;
		background: var(--surface-2);
	}

	.acc-logo {
		flex: none;
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 11px;
		font-family: var(--font-display);
		font-weight: 800;
		color: #fff;
		background: #3a3632;
	}

	.acc-logo.chesscom {
		background: #5d8a3a;
	}

	.acc-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.acc-text span {
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.hist {
		font-size: 0.75rem;
		color: var(--c-analysis);
		font-weight: 650;
	}

	.hist.done {
		color: var(--good-text);
	}

	.live {
		font-size: 0.9rem;
		font-weight: 650;
		color: var(--c-puzzle);
	}

	.acc-form {
		flex: 1;
		display: flex;
		gap: 0.5rem;
		min-width: 0;
	}

	.acc-form input {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 16px;
	}

	.err {
		color: var(--bad);
		font-size: 0.9rem;
	}

	.once {
		font-size: 1.1rem;
		margin-top: 0.75rem;
	}

	:global(.spin) {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 560px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
	}

	.seg {
		display: flex;
		padding: 3px;
		border-radius: 999px;
		background: var(--surface-2);
	}

	.seg button {
		flex: 1;
		min-height: 40px;
		border: none;
		border-radius: 999px;
		background: none;
		font-weight: 650;
		color: var(--text-2);
		cursor: pointer;
	}

	.seg button.on {
		background: var(--text);
		color: var(--bg);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field span {
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--text-2);
	}

	input:not([type='checkbox']),
	select {
		font: inherit;
		font-size: 1rem;
		min-height: 46px;
		padding: 0 0.85rem;
		border-radius: 12px;
		border: 1px solid var(--line-strong);
		background: var(--surface-2);
		color: var(--text);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.95rem;
	}

	.check input {
		width: 20px;
		height: 20px;
		accent-color: var(--accent);
	}

	.btn.big {
		min-height: 50px;
	}

	.btn:disabled {
		opacity: 0.5;
	}

	.btn.small {
		align-self: flex-start;
		min-height: 36px;
		font-size: 0.88rem;
	}

	.privacy {
		display: flex;
		gap: 0.45rem;
		font-size: 0.82rem;
		color: var(--text-3);
		line-height: 1.45;
	}

	.privacy :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.1rem 1.25rem;
		animation: rise 300ms var(--ease-out);
	}

	.s-title {
		font-weight: 650;
	}

	.s-title.err {
		color: var(--bad);
	}

	.track {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--c-analysis), var(--accent));
		transition: width 300ms var(--ease-out);
	}

	.fill.indeterminate {
		width: 35%;
		animation: slide 1.1s ease-in-out infinite;
	}

	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
