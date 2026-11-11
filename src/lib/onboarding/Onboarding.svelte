<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Logo from '#lib/ui/Logo.svelte';
	import { setSetting } from '#lib/db/db.js';
	import { firstRoute, saveProfile, type Focus, type Level, type Rules } from './profile.js';
	import { link, syncNow, analyseInBackground } from '#lib/import/sync.svelte.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let { onclose }: { onclose: () => void } = $props();

	let step = $state(0);
	let rules = $state<Rules>('yes');
	let level = $state<Level>('unknown');
	let focus = $state<Focus>('play');
	let lichess = $state('');
	let chesscom = $state('');

	// wer die Regeln nicht kennt, bekommt keine Frage zur Spielstärke
	const steps = $derived(
		rules === 'no' ? ['rules', 'focus'] : ['rules', 'level', 'focus', 'online']
	);
	const current = $derived(steps[step]);

	const RULES: Rules[] = ['no', 'some', 'yes'];
	const LEVELS: Level[] = ['new', 'casual', 'club', 'unknown'];
	const FOCUS: Focus[] = ['rules', 'tactics', 'play', 'openings'];

	function pickRules(r: Rules) {
		rules = r;
		level = r === 'yes' ? 'unknown' : 'new';
		step = 1;
	}

	function pickLevel(l: Level) {
		level = l;
		step++;
	}

	async function pickFocus(f: Focus) {
		focus = f;
		// wer online spielt, kann gleich sein Konto verknüpfen
		if (steps.includes('online')) {
			step++;
			return;
		}
		await finish();
	}

	async function finish() {
		if (lichess.trim()) await link('lichess', lichess);
		if (chesscom.trim()) await link('chesscom', chesscom);
		if (lichess.trim() || chesscom.trim()) void syncNow().then(() => void analyseInBackground());
		const p = { rules, level, focus, date: Date.now() };
		await saveProfile(p);
		try {
			localStorage.setItem('rookie:onboarded', '1');
		} catch {
			/* egal */
		}
		onclose();
		await goto(resolve(firstRoute(p)));
	}

	async function skip() {
		await setSetting('onboardingSkipped', true);
		try {
			localStorage.setItem('rookie:onboarded', '1');
		} catch {
			/* egal */
		}
		onclose();
	}
</script>

<div class="ob" role="dialog" aria-modal="true" aria-label={t('onboarding.welcome')}>
	<div class="inner">
		<header>
			{#if step > 0}
				<button class="link" onclick={() => step--}
					><ArrowLeft size={17} /> {t('onboarding.back')}</button
				>
			{:else}
				<span></span>
			{/if}
			<button class="link" onclick={skip}>{t('onboarding.skip')}</button>
		</header>

		{#if step === 0}
			<div class="hero">
				<Logo size={64} />
				<h1>{t('onboarding.welcome')}</h1>
				<p>{t('onboarding.intro')}</p>
			</div>
		{/if}

		<div class="dots" aria-hidden="true">
			{#each steps as s, i (s)}<span class:on={i <= step}></span>{/each}
		</div>
		<span class="count">{t('onboarding.step', { i: step + 1, n: steps.length })}</span>

		{#key current}
			<div class="q">
				{#if current === 'rules'}
					<h2>{t('onboarding.rulesQ')}</h2>
					{#each RULES as r, i (r)}
						<button class="opt" style:--i={i} onclick={() => pickRules(r)}>
							<b>{t(`onboarding.rules.${r}.t`)}</b><span>{t(`onboarding.rules.${r}.d`)}</span>
						</button>
					{/each}
				{:else if current === 'level'}
					<h2>{t('onboarding.levelQ')}</h2>
					{#each LEVELS as l, i (l)}
						<button class="opt" style:--i={i} onclick={() => pickLevel(l)}>
							<b>{t(`onboarding.level.${l}.t`)}</b><span>{t(`onboarding.level.${l}.d`)}</span>
						</button>
					{/each}
				{:else if current === 'online'}
					<h2>{t('onboarding.onlineQ')}</h2>
					<p class="sub">{t('onboarding.onlineText')}</p>
					<label class="inp"
						><span class="logo">L</span><input
							bind:value={lichess}
							placeholder={t('onboarding.lichessName')}
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
						/></label
					>
					<label class="inp"
						><span class="logo cc">C</span><input
							bind:value={chesscom}
							placeholder={t('onboarding.chesscomName')}
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
						/></label
					>
					<button class="btn big" onclick={() => void finish()}
						>{lichess.trim() || chesscom.trim()
							? t('onboarding.linkGo')
							: t('onboarding.noOnline')}</button
					>
				{:else}
					<h2>{t('onboarding.focusQ')}</h2>
					{#each FOCUS as f, i (f)}
						<button class="opt" style:--i={i} onclick={() => pickFocus(f)}>
							<b>{t(`onboarding.focus.${f}.t`)}</b><span>{t(`onboarding.focus.${f}.d`)}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/key}
	</div>
</div>

<style>
	.ob {
		position: fixed;
		inset: 0;
		z-index: 200;
		overflow-y: auto;
		background: radial-gradient(120% 60% at 50% 0%, var(--accent-soft), transparent 60%), var(--bg);
		animation: fade 260ms ease-out both;
	}

	.inner {
		max-width: 520px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + 1rem) 1.25rem calc(var(--safe-bottom) + 2rem);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 36px;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: none;
		background: none;
		color: var(--text-2);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
		padding: 0.4rem 0;
	}

	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
		margin: 0.5rem 0 0.4rem;
	}

	.hero h1 {
		font-size: clamp(1.8rem, 7vw, 2.4rem);
		line-height: 1.1;
	}

	.hero p {
		color: var(--text-2);
		max-width: 22rem;
	}

	.dots {
		display: flex;
		gap: 5px;
	}

	.dots span {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-2);
		transition: background-color var(--dur) var(--ease-out);
	}

	.dots span.on {
		background: var(--accent);
	}

	.count {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-2);
	}

	.q {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.q h2 {
		font-size: 1.45rem;
		margin-bottom: 0.3rem;
	}

	.opt {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		padding: 0.95rem 1.05rem;
		border-radius: 16px;
		border: 1.5px solid var(--line);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		text-align: left;
		font: inherit;
		color: var(--text);
		cursor: pointer;
		animation: rise 360ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 50ms);
		transition:
			border-color var(--dur) var(--ease-out),
			transform var(--dur) var(--ease-out);
	}

	.opt:hover {
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}

	.opt:active {
		transform: scale(0.98);
	}

	.opt b {
		font-size: 1.05rem;
	}

	.opt span {
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.sub {
		color: var(--text-2);
		line-height: 1.45;
		margin-top: -0.2rem;
	}

	.inp {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem;
		border-radius: 14px;
		background: var(--surface);
		border: 1.5px solid var(--line);
	}

	.inp input {
		flex: 1;
		min-width: 0;
		height: 40px;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 16px;
		outline: none;
	}

	.logo {
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		font-family: var(--font-display);
		font-weight: 800;
		color: #fff;
		background: #3a3632;
	}

	.logo.cc {
		background: #5d8a3a;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
