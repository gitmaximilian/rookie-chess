<script lang="ts">
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import Upload from '@lucide/svelte/icons/upload';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Target from '@lucide/svelte/icons/target';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { downloadBackup, importAll, parseBackup, requestPersistence } from '#lib/db/backup.js';
	import { db, getSetting, setSetting, TABLES } from '#lib/db/db.js';
	import { getThemePref, setThemePref, type ThemePref } from '#lib/ui/theme.js';
	import { sound } from '#lib/ui/sound.js';
	import Languages from '@lucide/svelte/icons/languages';
	import { t, i18n, LOCALES } from '#lib/i18n/i18n.svelte.js';

	let themePref = $state<ThemePref>('system');
	let soundOn = $state(true);
	let goal = $state(5);
	let persisted = $state<boolean | null>(null);
	let lastBackup = $state<number | null>(null);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
	let fileInput: HTMLInputElement;
	let counts = $state<{ games: number; attempts: number; cards: number }>({
		games: 0,
		attempts: 0,
		cards: 0
	});

	onMount(async () => {
		themePref = getThemePref();
		soundOn = sound.enabled;
		goal = await getSetting('dailyGoal', 5);
		lastBackup = await getSetting<number | null>('lastBackupAt', null);
		try {
			persisted = (await navigator.storage?.persisted?.()) ?? false;
		} catch {
			persisted = false;
		}
		counts = {
			games: await db.games.count(),
			attempts: await db.puzzleAttempts.count(),
			cards: await db.reviewCards.count()
		};
	});

	function pickTheme(t: ThemePref) {
		themePref = t;
		setThemePref(t);
	}

	function toggleSound() {
		soundOn = !soundOn;
		sound.setEnabled(soundOn);
		if (soundOn) sound.good();
	}

	async function saveGoal(n: number) {
		goal = n;
		await setSetting('dailyGoal', n);
	}

	async function persist() {
		persisted = await requestPersistence();
		message = persisted
			? { kind: 'ok', text: t('settings.protectOk') }
			: {
					kind: 'err',
					text: t('settings.protectFail')
				};
	}

	async function exportNow() {
		await downloadBackup();
		lastBackup = Date.now();
		message = { kind: 'ok', text: t('settings.saved') };
	}

	async function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const backup = parseBackup(await file.text());
			if (!confirm(t('settings.importConfirm'))) return;
			await importAll(backup);
			message = { kind: 'ok', text: t('settings.imported') };
			setTimeout(() => location.reload(), 900);
		} catch (err) {
			message = {
				kind: 'err',
				text: err instanceof Error ? err.message : t('settings.importFail')
			};
		} finally {
			fileInput.value = '';
		}
	}

	async function resetAll() {
		if (!confirm(t('settings.reset1'))) return;
		if (!confirm(t('settings.reset2'))) return;
		await db.transaction(
			'rw',
			TABLES.map((t) => db.table(t)),
			async () => {
				for (const t of TABLES) await db.table(t).clear();
			}
		);
		location.href = '/';
	}

	const backupAge = $derived(lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null);
</script>

<svelte:head><title>{t('settings.title')} – Rookie</title></svelte:head>

<PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} />

<div class="stack">
	{#if message}
		<div class="msg {message.kind}" role="status">{message.text}</div>
	{/if}

	<section class="card block">
		<h2>{t('settings.appearance')}</h2>
		<div class="seg" role="radiogroup" aria-label={t('settings.appearance')}>
			<button
				role="radio"
				aria-checked={themePref === 'system'}
				class:on={themePref === 'system'}
				onclick={() => pickTheme('system')}
			>
				<Monitor size={17} />
				{t('settings.auto')}
			</button>
			<button
				role="radio"
				aria-checked={themePref === 'light'}
				class:on={themePref === 'light'}
				onclick={() => pickTheme('light')}
			>
				<Sun size={17} />
				{t('settings.light')}
			</button>
			<button
				role="radio"
				aria-checked={themePref === 'dark'}
				class:on={themePref === 'dark'}
				onclick={() => pickTheme('dark')}
			>
				<Moon size={17} />
				{t('settings.dark')}
			</button>
		</div>
		<div class="lang">
			<span class="lang-label"><Languages size={18} /> {t('settings.language')}</span>
			<div class="seg" role="radiogroup" aria-label={t('settings.language')}>
				{#each LOCALES as l (l.id)}
					<button
						role="radio"
						aria-checked={i18n.locale === l.id}
						class:on={i18n.locale === l.id}
						onclick={() => i18n.set(l.id)}
						lang={l.id}
					>
						{l.label}
					</button>
				{/each}
			</div>
		</div>
		<button class="row" onclick={toggleSound}>
			<span class="ico"
				>{#if soundOn}<Volume2 size={19} />{:else}<VolumeX size={19} />{/if}</span
			>
			<span class="txt">{t('settings.sound')}</span>
			<span class="switch" class:on={soundOn} aria-hidden="true"><span></span></span>
		</button>
	</section>

	<section class="card block">
		<h2><Target size={18} /> {t('settings.goal')}</h2>
		<p class="hint">{t('settings.goalText')}</p>
		<div class="seg" role="radiogroup" aria-label={t('settings.goal')}>
			{#each [3, 5, 10, 20] as n (n)}
				<button
					role="radio"
					aria-checked={goal === n}
					class:on={goal === n}
					onclick={() => saveGoal(n)}>{n}</button
				>
			{/each}
		</div>
	</section>

	<section class="card block">
		<h2>{t('settings.data')}</h2>
		<p class="hint">{t('settings.dataText')}</p>
		<p class="facts">
			{t('settings.facts', { g: counts.games, a: counts.attempts, c: counts.cards })}
		</p>

		<div class="status" class:ok={persisted} class:warn={persisted === false}>
			{#if persisted}
				<ShieldCheck size={20} />
				<span>{t('settings.protected')}</span>
			{:else}
				<ShieldAlert size={20} />
				<span>{t('settings.unprotected')}</span>
				<button class="btn small" onclick={persist}>{t('settings.protect')}</button>
			{/if}
		</div>

		<div class="actions">
			<button class="btn" onclick={exportNow}><Download size={18} /> {t('settings.save')}</button>
			<button class="btn secondary" onclick={() => fileInput.click()}
				><Upload size={18} /> {t('settings.load')}</button
			>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				hidden
				onchange={onFile}
			/>
		</div>
		<p class="hint small">
			{#if backupAge === null}
				{t('settings.never')}
			{:else if backupAge === 0}
				{t('settings.todayBackup')}
			{:else}
				{t('settings.ago', { n: backupAge })}
			{/if}
		</p>
	</section>

	<section class="card block danger-zone">
		<h2>{t('settings.reset')}</h2>
		<p class="hint">{t('settings.resetText')}</p>
		<button class="btn danger" onclick={resetAll}
			><Trash2 size={18} /> {t('settings.resetBtn')}</button
		>
	</section>
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 680px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.25rem 1.35rem;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 1.15rem;
	}

	.hint {
		color: var(--text-2);
		font-size: 0.95rem;
	}

	.hint.small {
		font-size: 0.85rem;
		color: var(--text-3);
	}

	.facts {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-3);
	}

	.seg {
		display: flex;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}

	.seg button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 40px;
		border: none;
		border-radius: 9px;
		background: none;
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--text-2);
		cursor: pointer;
		transition: background-color var(--dur) var(--ease-out);
	}

	.seg button.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-1);
	}

	.lang {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.lang-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.88rem;
		font-weight: 650;
		color: var(--text-2);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.4rem 0;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 11px;
		background: var(--surface-2);
	}

	.txt {
		flex: 1;
		font-weight: 560;
	}

	.switch {
		position: relative;
		width: 50px;
		height: 30px;
		border-radius: 999px;
		background: var(--line-strong);
		transition: background-color var(--dur) var(--ease-out);
	}

	.switch span {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
		transition: transform var(--dur) var(--ease-spring);
	}

	.switch.on {
		background: var(--good);
	}

	.switch.on span {
		transform: translateX(20px);
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 0.9rem;
		border-radius: 12px;
		background: var(--surface-2);
		font-size: 0.92rem;
	}

	.status span {
		flex: 1;
	}

	.status.ok {
		color: var(--good);
		background: color-mix(in srgb, var(--good) 12%, transparent);
	}

	.status.warn {
		color: color-mix(in srgb, var(--warn) 75%, var(--text));
		background: color-mix(in srgb, var(--warn) 14%, transparent);
	}

	.btn.small {
		min-height: 34px;
		padding: 0 0.85rem;
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.msg {
		padding: 0.85rem 1rem;
		border-radius: 14px;
		font-weight: 560;
		animation: rise 300ms var(--ease-out);
	}

	.msg.ok {
		background: color-mix(in srgb, var(--good) 14%, transparent);
		color: var(--good);
	}

	.msg.err {
		background: color-mix(in srgb, var(--bad) 12%, transparent);
		color: var(--bad);
	}

	.btn.danger {
		align-self: flex-start;
		background: color-mix(in srgb, var(--bad) 12%, transparent);
		color: var(--bad);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
</style>
