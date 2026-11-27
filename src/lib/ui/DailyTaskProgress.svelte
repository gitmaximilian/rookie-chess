<script lang="ts">
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import Check from '@lucide/svelte/icons/check';
	import { today } from '#lib/db/db.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { progressOf, type PlanContext, type PlanTask } from '#lib/training/plan.js';
	import { loadPlanContext, todayPlan } from '#lib/training/planData.js';

	let {
		kind,
		gameId,
		active = $bindable(false)
	}: {
		kind: PlanTask['kind'];
		gameId?: number;
		/** true, solange der Tagesplan eine passende Aufgabe hat (Seite blendet eigene Ziele dann aus) */
		active?: boolean;
	} = $props();
	let snapshot = $state<{
		plan: Awaited<ReturnType<typeof todayPlan>>;
		context: PlanContext;
	} | null>(null);

	const progress = $derived.by(() => {
		if (!snapshot) return null;
		const { plan, context } = snapshot;
		const task = plan.tasks.find(
			(task) => task.kind === kind && (task.kind !== 'game' || task.gameId === gameId)
		);
		return task ? progressOf(task, context, plan.initial) : null;
	});

	$effect(() => {
		active = !!progress;
	});

	onMount(() => {
		let day = '';
		let subscription: { unsubscribe(): void } | undefined;

		async function watchDay() {
			const nextDay = today();
			if (day === nextDay) return;
			day = nextDay;
			subscription?.unsubscribe();
			snapshot = null;
			try {
				const context = await loadPlanContext();
				if (day !== nextDay) return;
				// Creating the stored plan can write to IndexedDB, outside the read-only query.
				const plan = await todayPlan(context);
				if (day !== nextDay) return;
				subscription = liveQuery(loadPlanContext).subscribe({
					next(context) {
						if (context.day === plan.day) snapshot = { plan, context };
					},
					error() {
						if (day !== nextDay) return;
						snapshot = null;
					}
				});
			} catch {
				if (day === nextDay) snapshot = null;
			}
		}

		const refresh = () => void watchDay();
		refresh();
		const timer = window.setInterval(refresh, 5_000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			day = '';
			subscription?.unsubscribe();
			window.clearInterval(timer);
			document.removeEventListener('visibilitychange', refresh);
		};
	});
</script>

<div class="progress" role="status" data-testid="daily-task-progress">
	{#if progress}
		{#if progress.done >= progress.target}
			<Check size={15} aria-hidden="true" /> {t('dailyProgress.done')}
		{:else}
			{t('dailyProgress.count', { done: progress.done, goal: progress.target })}
		{/if}
	{/if}
</div>

<style>
	.progress {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 1.25rem;
		color: var(--text-2);
		font-size: 0.82rem;
		font-weight: 650;
	}
</style>
