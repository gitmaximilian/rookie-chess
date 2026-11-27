<script lang="ts">
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Crown from '@lucide/svelte/icons/crown';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import ChessKnight from '@lucide/svelte/icons/chess-knight';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import ScanEye from '@lucide/svelte/icons/scan-eye';
	import Compass from '@lucide/svelte/icons/compass';
	import Swords from '@lucide/svelte/icons/swords';
	import type { Component } from 'svelte';
	import GoalRing from '#lib/ui/GoalRing.svelte';
	import { loadPlanContext, todayPlan } from '#lib/training/planData.js';
	import {
		minutesOf,
		progressOf,
		rapidDue,
		type PlanContext,
		type PlanInitial,
		type PlanTask
	} from '#lib/training/plan.js';
	import { basicById } from '#lib/basics/lessons.js';
	import { courseById, loc } from '#lib/openings/courses.js';
	import { lessonById, lessonTitle } from '#lib/endgames/lessons.js';
	import { themeName } from '#lib/data/themes.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let ctx = $state<PlanContext | null>(null);
	let tasks = $state<PlanTask[]>([]);
	let initial: PlanInitial = { dueReview: 0, dueRepertoire: 0, dueMistakes: 0 };

	onMount(() => {
		let revision = 0;
		const sub = liveQuery(loadPlanContext).subscribe({
			async next(c) {
				const run = ++revision;
				const plan = await todayPlan(c);
				if (run !== revision) return;
				initial = plan.initial;
				tasks = plan.tasks;
				ctx = c;
			},
			error(error) {
				console.error(error);
			}
		});
		return () => {
			revision++;
			sub.unsubscribe();
		};
	});

	const rows = $derived(
		ctx
			? tasks.map((task) => {
					const p = progressOf(task, ctx!, initial);
					return { task, ...p, finished: p.done >= p.target };
				})
			: []
	);
	// Erfolgsmoment: nur Aufgaben, die während der Sitzung fertig werden, springen auf
	let seen: Set<string> | null = null;
	let justDone = $state(new Set<string>());
	$effect(() => {
		const finished = rows.filter((r) => r.finished).map((r) => r.task.id);
		if (!ctx) return;
		if (seen) {
			const fresh = finished.filter((id) => !seen!.has(id));
			if (fresh.length) justDone = new Set([...justDone, ...fresh]);
		}
		seen = new Set(finished);
	});

	const doneCount = $derived(rows.filter((r) => r.finished).length);
	const next = $derived(rows.find((r) => !r.finished));

	const ICON: Record<PlanTask['kind'], Component> = {
		review: Repeat,
		puzzles: Puzzle,
		repertoire: BookOpen,
		basics: GraduationCap,
		course: BookOpen,
		endgame: Crown,
		game: ChartLine,
		play: ChessKnight,
		safety: ShieldCheck,
		mistakes: Sparkles,
		checkup: ClipboardCheck,
		scan: ScanEye,
		positional: Compass,
		tactic: Swords
	};
	const minutesLeft = $derived(
		rows.filter((r) => !r.finished).reduce((s, r) => s + minutesOf(r.task), 0)
	);

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
			case 'play':
				return t('plan.play');
			case 'safety':
				return t('plan.safety', { n: task.target });
			case 'mistakes':
				return t('plan.mistakes', { n: task.target });
			case 'checkup':
				return t('plan.checkup');
			case 'scan':
				return t('plan.scan', { n: task.target });
			case 'positional':
				return t('plan.positional', { name: loc(basicById(task.lesson)?.title) });
			case 'tactic':
				return t('plan.tactic', { name: loc(basicById(task.lesson)?.title) });
		}
	}

	function href(task: PlanTask): string {
		switch (task.kind) {
			case 'review':
				return resolve('/puzzles?mode=review');
			case 'puzzles':
				// Schwerpunkt gemischt: zwei von drei Puzzles zum Thema, eins aus allen Themen
				return task.theme ? resolve(`/puzzles?theme=${task.theme}&mix=1`) : resolve('/puzzles');
			case 'repertoire':
				return resolve('/learn/openings?train=due');
			case 'basics':
				return resolve(`/learn/basics?id=${task.lesson}`);
			case 'course':
				return resolve(`/learn/openings/course?id=${task.course}&line=${task.line}`);
			case 'endgame':
				return resolve(`/learn/endgame?id=${task.lesson}`);
			case 'game':
				return resolve(`/analysis?game=${task.gameId}&practice=1`);
			case 'play':
				return resolve('/play?plan=1');
			case 'safety':
				return resolve('/puzzles/safety');
			case 'mistakes':
				return resolve('/puzzles?mode=mistakes');
			case 'checkup':
				return resolve('/puzzles/safety?test=1');
			case 'scan':
				return resolve('/puzzles/scan?mode=opponent');
			case 'positional':
			case 'tactic':
				return resolve(`/learn/basics?id=${task.lesson}`);
		}
	}
</script>

<section class="plan tone-play" data-size="l" aria-busy={!ctx}>
	<div class="p-head">
		<GoalRing value={doneCount} max={Math.max(1, rows.length)} size={56} />
		<div class="p-title">
			<h2>{t('plan.title')}</h2>
			<span
				>{ctx
					? next
						? t('plan.progressMin', { n: doneCount, m: rows.length, min: minutesLeft })
						: t('plan.allDone')
					: ' '}</span
			>
		</div>
	</div>

	{#if !ctx}
		<div class="skeleton" style:height="150px"></div>
	{:else}
		<ol class="tasks">
			{#each rows as r, i (r.task.id)}
				{@const Icon = ICON[r.task.kind]}
				<li style:--i={i}>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href() liefert bereits resolve()-Pfade -->
					<a
						href={href(r.task)}
						class="task"
						class:finished={r.finished}
						class:next={r === next}
						class:just-done={justDone.has(r.task.id)}
					>
						<span class="t-ico">
							{#if r.finished}<Check size={17} strokeWidth={3} />{:else}<Icon size={17} />{/if}
						</span>
						<span class="t-text">{title(r.task)}</span>
						{#if r.target > 1 && !r.finished}
							<span class="t-count">{r.done}/{r.target}</span>
						{/if}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ol>
		<!-- Hauptaktion unten und über die volle Breite: der eine nächste Schritt -->
		{#if next}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href() liefert bereits resolve()-Pfade -->
			<a class="btn big go" href={href(next.task)}
				>{doneCount ? t('plan.continue') : t('plan.start')} <ArrowRight size={18} /></a
			>
		{/if}
		{#if rapidDue(ctx) && !tasks.some((task) => task.kind === 'play')}
			<a class="rapid-slot" href={resolve('/play?plan=1')} data-testid="rapid-slot">
				<ChessKnight size={16} />
				{t('plan.rapidSlot')}
			</a>
		{/if}
	{/if}
</section>

<style>
	/* Größte Kachel der Startseite: beantwortet „Was mache ich jetzt?“ */
	.plan {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.2rem;
		border-radius: var(--radius-tile);
	}

	.rapid-slot {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--text-2);
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
		gap: 0.1rem;
	}

	.p-title h2 {
		font-size: 1.3rem;
	}

	.p-title > span:last-child {
		font-family: var(--font-num);
		font-size: 0.8rem;
		color: var(--tile-text-2);
	}

	.go {
		width: 100%;
		margin-top: auto;
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
		min-height: 52px;
		padding: 0.55rem 0.75rem;
		border-radius: 18px;
		background: color-mix(in srgb, var(--surface) 62%, transparent);
		color: var(--tile-text);
		border: 1.5px solid transparent;
		transition: border-color var(--dur) var(--ease-out);
	}

	.task.next {
		border-color: var(--tone-ink);
		background: var(--surface);
	}

	.t-ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 11px;
		background: var(--tone-bg);
		color: var(--tone-ink);
	}

	.task.just-done .t-ico {
		animation: done-pop 520ms var(--ease-spring);
	}

	.task.finished .t-ico {
		background: var(--good);
		color: #fff;
	}

	.task.finished .t-text {
		color: var(--tile-text-2);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--tile-text-2) 50%, transparent);
	}

	.t-text {
		flex: 1;
		min-width: 0;
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.t-count {
		flex: none;
		font-family: var(--font-num);
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--tile-text-2);
		font-variant-numeric: tabular-nums;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
