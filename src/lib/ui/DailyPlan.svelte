<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Crown from '@lucide/svelte/icons/crown';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Gauge from '@lucide/svelte/icons/gauge';
	import type { Component } from 'svelte';
	import GoalRing from '#lib/ui/GoalRing.svelte';
	import { loadPlanContext, todayPlan, currentStrength } from '#lib/training/planData.js';
	import { getSetting, setSetting } from '#lib/db/db.js';
	import { progressOf, type PlanContext, type PlanTask } from '#lib/training/plan.js';
	import type { Strength } from '#lib/training/strength.js';
	import { basicById } from '#lib/basics/lessons.js';
	import { courseById, loc } from '#lib/openings/courses.js';
	import { lessonById, lessonTitle } from '#lib/endgames/lessons.js';
	import { themeName } from '#lib/data/themes.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let ctx = $state<PlanContext | null>(null);
	let tasks = $state<PlanTask[]>([]);
	let initial = { dueReview: 0, dueRepertoire: 0 };
	let strength = $state<Strength | null>(null);

	onMount(async () => {
		const c = await loadPlanContext();
		const plan = await todayPlan(c);
		initial = plan.initial;
		tasks = plan.tasks;
		ctx = c;
		strength = await currentStrength();
	});

	const rows = $derived(
		ctx
			? tasks.map((task) => {
					const p = progressOf(task, ctx!, initial);
					return { task, ...p, finished: p.done >= p.target };
				})
			: []
	);
	const doneCount = $derived(rows.filter((r) => r.finished).length);
	const next = $derived(rows.find((r) => !r.finished));

	// kompletter Tagesplan → Tag für den Erfolg „Diszipliniert“ merken
	$effect(() => {
		if (!ctx || !rows.length || next) return;
		const day = ctx.day;
		void getSetting<string[]>('planDaysDone', []).then((days) => {
			if (!days.includes(day)) void setSetting('planDaysDone', [...days, day]);
		});
	});

	const ICON: Record<PlanTask['kind'], Component> = {
		review: Repeat,
		puzzles: Puzzle,
		repertoire: BookOpen,
		basics: GraduationCap,
		course: BookOpen,
		endgame: Crown,
		game: ChartLine
	};

	function title(task: PlanTask): string {
		switch (task.kind) {
			case 'review':
				return t('plan.review', { n: task.target });
			case 'puzzles':
				return task.theme
					? t('plan.puzzlesTheme', { n: task.target, theme: themeName(task.theme) })
					: t('plan.puzzles', { n: task.target });
			case 'repertoire':
				return t('plan.repertoire', { n: task.target });
			case 'basics':
				return t('plan.basics', { name: loc(basicById(task.lesson)?.title) });
			case 'course': {
				const c = courseById(task.course);
				const line = c?.lines.find((l) => l.id === task.line);
				return t('plan.course', { name: `${loc(c?.name)} · ${loc(line?.name)}` });
			}
			case 'endgame': {
				const l = lessonById(task.lesson);
				return t('plan.endgame', { name: l ? lessonTitle(l) : task.lesson });
			}
			case 'game':
				return t('plan.game');
		}
	}

	function href(task: PlanTask): string {
		switch (task.kind) {
			case 'review':
				return resolve('/puzzles?mode=review');
			case 'puzzles':
				return task.theme ? resolve(`/puzzles?theme=${task.theme}`) : resolve('/puzzles');
			case 'repertoire':
				return resolve('/learn/openings?train=due');
			case 'basics':
				return resolve(`/learn/basics?id=${task.lesson}`);
			case 'course':
				return resolve(`/learn/openings/course?id=${task.course}&line=${task.line}`);
			case 'endgame':
				return resolve(`/learn/endgame?id=${task.lesson}`);
			case 'game':
				return resolve(`/analysis?game=${task.gameId}&retry=1`);
		}
	}
</script>

<section class="plan card" aria-busy={!ctx}>
	<div class="p-head">
		<GoalRing value={doneCount} max={Math.max(1, rows.length)} size={52} />
		<div class="p-title">
			<h2>{t('plan.title')}</h2>
			<span
				>{ctx
					? next
						? t('plan.progress', { n: doneCount, m: rows.length })
						: t('plan.allDone')
					: ' '}</span
			>
		</div>
		{#if next}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href() liefert bereits resolve()-Pfade -->
			<a class="btn go" href={href(next.task)}
				>{doneCount ? t('plan.continue') : t('plan.start')} <ArrowRight size={17} /></a
			>
		{/if}
	</div>

	{#if !ctx}
		<div class="skeleton" style:height="150px"></div>
	{:else}
		<ol class="tasks">
			{#each rows as r, i (r.task.id)}
				{@const Icon = ICON[r.task.kind]}
				<li style:--i={i}>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href() liefert bereits resolve()-Pfade -->
					<a href={href(r.task)} class="task" class:finished={r.finished} class:next={r === next}>
						<span class="t-ico">
							{#if r.finished}<Check size={17} strokeWidth={3} />{:else}<Icon size={17} />{/if}
						</span>
						<span class="t-text">{title(r.task)}</span>
						{#if r.target > 1 && !r.finished}
							<span class="t-count">{r.done}/{r.target}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
	{/if}

	{#if strength}
		<p class="strength" title={t('plan.strengthHint')}>
			<Gauge size={15} />
			{t('plan.strength', { n: strength.value })}
		</p>
	{/if}
</section>

<style>
	.plan {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.1rem 1.15rem;
		background:
			radial-gradient(110% 120% at 100% 0%, var(--accent-soft), transparent 60%), var(--surface);
	}

	.p-head {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.p-title {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.p-title h2 {
		font-size: 1.2rem;
	}

	.p-title span {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.go {
		flex: none;
		height: 40px;
		padding-inline: 1rem;
	}

	.tasks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.tasks li {
		animation: rise 360ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 50ms);
	}

	.task {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 0.7rem;
		border-radius: 13px;
		background: var(--surface-2);
		color: var(--text);
		border: 1.5px solid transparent;
		transition: border-color var(--dur) var(--ease-out);
	}

	.task.next {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: var(--surface);
	}

	.t-ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		background: var(--surface);
		color: var(--accent);
	}

	.task.finished .t-ico {
		background: var(--good);
		color: #fff;
	}

	.task.finished .t-text {
		color: var(--text-2);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--text-2) 50%, transparent);
	}

	.t-text {
		flex: 1;
		min-width: 0;
		font-size: 0.93rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.t-count {
		flex: none;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.strength {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--text-2);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
