<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import { BASICS, TACTICS } from '#lib/basics/lessons.js';
	import Swords from '@lucide/svelte/icons/swords';
	import { getSetting } from '#lib/db/db.js';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import LessonIcon from '#lib/ui/LessonIcon.svelte';
	import Stars from '#lib/ui/Stars.svelte';
	import { LESSONS, lessonTitle, lessonSubtitle, goalText } from '#lib/endgames/lessons.js';
	import { db } from '#lib/db/db.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { countDue } from '#lib/training/srs.js';

	let stars = $state<Record<string, number>>({});
	let repCount = $state(0);
	let repDue = $state(0);
	let basicsDone = $state(0);
	let tacticsDone = $state(0);

	onMount(async () => {
		const rows = await db.endgames.toArray();
		stars = Object.fromEntries(rows.map((r) => [r.id, r.stars]));
		repCount = await db.repertoire.filter((r) => r.mine).count();
		repDue = await countDue('repertoire');
		basicsDone = (await getSetting<string[]>('basicsDone', [])).length;
		tacticsDone = (await getSetting<string[]>('tacticsDone', [])).length;
	});

	const total = $derived(Object.values(stars).reduce((a, b) => a + b, 0));
</script>

<svelte:head><title>{t('learn.title')} – Rookie</title></svelte:head>

<PageHeader eyebrow={t('learn.eyebrow')} title={t('learn.title')} subtitle={t('learn.subtitle')} />

<div class="wrap">
	<div class="paths">
		<a
			class="path card pressable"
			style:--c="var(--c-puzzle)"
			style:--i={0}
			href={resolve('/learn/basics')}
		>
			<span class="p-icon"><GraduationCap size={24} /></span>
			<b>{t('basics.title')}</b>
			<span class="p-text">{t('basics.hubText')}</span>
			<span class="p-bar"><span style:width="{(basicsDone / BASICS.length) * 100}%"></span></span>
			<span class="p-meta">{t('basics.progress', { n: basicsDone, m: BASICS.length })}</span>
		</a>
		<a
			class="path card pressable"
			style:--c="var(--c-play)"
			style:--i={1}
			href={resolve('/learn/basics?set=tactics')}
		>
			<span class="p-icon"><Swords size={24} /></span>
			<b>{t('tactics.title')}</b>
			<span class="p-text">{t('tactics.hubText')}</span>
			<span class="p-bar"><span style:width="{(tacticsDone / TACTICS.length) * 100}%"></span></span>
			<span class="p-meta">{t('basics.progress', { n: tacticsDone, m: TACTICS.length })}</span>
		</a>
		<a
			class="path card pressable"
			style:--c="var(--c-learn)"
			style:--i={2}
			href={resolve('/learn/openings')}
		>
			<span class="p-icon"><BookOpen size={24} /></span>
			<b>{t('learn.openings')}</b>
			<span class="p-text">{t('learn.openingsText')}</span>
			<span class="p-bar"><span style:width="{Math.min(100, (repCount / 40) * 100)}%"></span></span>
			<span class="p-meta">
				{t('openings.moves', { n: repCount })}{#if repDue}
					· <b class="due">{t('openings.due', { n: repDue })}</b>{/if}
			</span>
		</a>
	</div>

	<div class="sec-head">
		<div>
			<h2>{t('learn.endgames')}</h2>
			<p>{t('learn.endgamesText')}</p>
		</div>
		<span class="total"><Stars n={1} size={15} /> {total} / {LESSONS.length * 3}</span>
	</div>

	<div class="lessons">
		{#each LESSONS as l, i (l.id)}
			<a
				class="lesson card pressable"
				href={resolve(`/learn/endgame?id=${l.id}`)}
				style:--i={i}
				class:done={(stars[l.id] ?? 0) > 0}
			>
				<span class="l-top">
					<span class="l-icon lv{l.level}"><LessonIcon icon={l.icon} size={22} /></span>
					<span class="lvl">{t('learn.level', { n: l.level })}</span>
				</span>
				<span class="l-title">{lessonTitle(l)}</span>
				<span class="l-sub">{lessonSubtitle(l)}</span>
				<span class="l-foot">
					<span class="goal">{goalText(l)}</span>
					<Stars n={stars[l.id] ?? 0} size={15} />
				</span>
			</a>
		{/each}
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 1040px;
	}

	.paths {
		display: grid;
		gap: 0.6rem;
	}

	@media (min-width: 760px) {
		.paths {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.path {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1.05rem 1.1rem;
		color: var(--text);
		background:
			radial-gradient(
				110% 120% at 100% 0%,
				color-mix(in srgb, var(--c) 14%, transparent),
				transparent 65%
			),
			var(--surface);
		animation: rise 420ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 60ms);
	}

	.p-icon {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		margin-bottom: 0.3rem;
		border-radius: 14px;
		background: var(--c);
		color: #fff;
		box-shadow: 0 8px 20px color-mix(in srgb, var(--c) 35%, transparent);
	}

	.path b {
		font-size: 1.12rem;
	}

	.p-text {
		flex: 1;
		font-size: 0.88rem;
		color: var(--text-2);
		line-height: 1.4;
	}

	.p-bar {
		height: 5px;
		margin-top: 0.45rem;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.p-bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--c);
	}

	.p-meta {
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.due {
		font-family: inherit !important;
		font-size: inherit !important;
		color: var(--accent);
	}

	.sec-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.sec-head h2 {
		font-size: 1.35rem;
	}

	.sec-head p {
		color: var(--text-2);
		font-size: 0.95rem;
		margin-top: 0.2rem;
	}

	.total {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 650;
		color: var(--text-2);
		white-space: nowrap;
	}

	.lessons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 0.75rem;
	}

	.lesson {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1rem 1.1rem;
		min-height: 172px;
		animation: rise 460ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 45ms);
	}

	.l-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.4rem;
	}

	.l-icon {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 13px;
		color: #fff;
		background: var(--c-learn);
	}

	.l-icon.lv2 {
		background: var(--c-puzzle);
	}

	.l-icon.lv3 {
		background: var(--c-play);
	}

	.lvl {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.l-title {
		font-family: var(--font-display);
		font-weight: 680;
		font-size: 1.1rem;
		letter-spacing: -0.01em;
	}

	.l-sub {
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.l-foot {
		margin-top: auto;
		padding-top: 0.6rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.goal {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-3);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
</style>
