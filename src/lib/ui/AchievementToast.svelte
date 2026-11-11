<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { getSetting, setSetting } from '#lib/db/db.js';
	import { loadAchievementData } from '#lib/training/achievementData.js';
	import { ACHIEVEMENTS, unlocked } from '#lib/training/achievements.js';
	import { sound } from '#lib/ui/sound.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let queue = $state<string[]>([]);
	const current = $derived(queue[0] ?? null);
	let checking = false;

	/** Neue Erfolge erkennen – beim ersten Mal still übernehmen (keine Flut für bestehende Nutzer) */
	async function check() {
		if (checking) return;
		checking = true;
		try {
			const now = unlocked(await loadAchievementData());
			const seen = await getSetting<string[] | null>('achievementsSeen', null);
			if (seen === null) {
				await setSetting('achievementsSeen', [...now]);
				return;
			}
			const fresh = now.filter((id) => !seen.includes(id));
			if (!fresh.length) return;
			await setSetting('achievementsSeen', [...seen, ...fresh]);
			queue = [...queue, ...fresh];
			sound.good();
		} finally {
			checking = false;
		}
	}

	onMount(() => {
		void check();
		const on = () => void check();
		addEventListener('rookie:progress', on);
		return () => removeEventListener('rookie:progress', on);
	});
	afterNavigate(() => void check());

	$effect(() => {
		if (!current) return;
		const timer = setTimeout(() => (queue = queue.slice(1)), 4200);
		return () => clearTimeout(timer);
	});

	const icon = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.icon ?? '🏅';
</script>

{#if current}
	{#key current}
		<div class="toast-wrap" role="status">
			<button class="toast" onclick={() => (queue = queue.slice(1))}>
				<span class="badge">{icon(current)}</span>
				<span class="txt">
					<span class="kicker">{t('achievements.unlocked')}</span>
					<b>{t(`achievements.list.${current}.t`)}</b>
				</span>
			</button>
		</div>
	{/key}
{/if}

<style>
	.toast {
		position: fixed;
		z-index: 120;
		left: 50%;
		top: calc(var(--safe-top) + 0.75rem);
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 1.1rem 0.55rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		box-shadow: var(--shadow-2);
		color: var(--text);
		font: inherit;
		cursor: pointer;
		animation: drop 520ms var(--ease-spring) both;
	}

	.badge {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		font-size: 1.35rem;
		background: radial-gradient(circle at 30% 30%, #ffe08a, #f2b544);
		box-shadow: 0 4px 14px rgb(242 181 68 / 0.45);
	}

	.txt {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1.2;
	}

	.kicker {
		font-size: 0.7rem;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--c-analysis);
	}

	@keyframes drop {
		from {
			opacity: 0;
			transform: translate(-50%, -24px) scale(0.9);
		}
	}
</style>
