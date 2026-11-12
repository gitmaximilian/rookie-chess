<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import { BASICS, TACTICS } from '#lib/basics/lessons.js';
	import { loc } from '#lib/openings/courses.js';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Crown from '@lucide/svelte/icons/crown';
	import Star from '@lucide/svelte/icons/star';
	import Swords from '@lucide/svelte/icons/swords';
	import { getSetting } from '#lib/db/db.js';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import LessonIcon from '#lib/ui/LessonIcon.svelte';
	import Stars from '#lib/ui/Stars.svelte';
	import { LESSONS, lessonTitle, lessonSubtitle } from '#lib/endgames/lessons.js';
	import { db } from '#lib/db/db.js';
	import { t } from '#lib/i18n/i18n.svelte.js';
	import { countDue } from '#lib/training/srs.js';
	import { loadStars, totalStars, type AreaStars, type StarArea } from '#lib/training/stars.js';

	let stars = $state<Record<string, number>>({});
	let repCount = $state(0);
	let repDue = $state(0);
	let basicsDone = $state(0);
	let tacticsDone = $state(0);
	let doneIds = $state<string[]>([]);
	let loaded = $state(false);
	let starAreas = $state<AreaStars[]>([]);
	const starsOf = (a: StarArea) => starAreas.find((x) => x.area === a);
	const allStars = $derived(totalStars(starAreas));

	onMount(async () => {
		const rows = await db.endgames.toArray();
		stars = Object.fromEntries(rows.map((r) => [r.id, r.stars]));
		repCount = await db.repertoire.filter((r) => r.mine).count();
		repDue = await countDue('repertoire');
		const b = await getSetting<string[]>('basicsDone', []);
		const tc = await getSetting<string[]>('tacticsDone', []);
		basicsDone = b.length;
		tacticsDone = tc.length;
		doneIds = [...b, ...tc];
		starAreas = await loadStars();
		loaded = true;
	});

	/** Der eine nächste Schritt: Grundlagen → Taktik → fällige Eröffnungen → Endspiele */
	const next = $derived.by(() => {
		if (!loaded) return null;
		const basic = BASICS.find((l) => !doneIds.includes(l.id));
		if (basic)
			return {
				area: t('basics.title'),
				title: loc(basic.title),
				href: resolve(`/learn/basics?id=${basic.id}`),
				c: 'var(--c-puzzle)'
			};
		const tactic = TACTICS.find((l) => !doneIds.includes(l.id));
		if (tactic)
			return {
				area: t('tactics.title'),
				title: loc(tactic.title),
				href: resolve(`/learn/basics?set=tactics&id=${tactic.id}`),
				c: 'var(--c-play)'
			};
		if (repDue)
			return {
				area: t('learn.openings'),
				title: t('openings.due', { n: repDue }),
				href: resolve('/learn/openings?train=due'),
				c: 'var(--c-learn)'
			};
		const eg = LESSONS.find((l) => !stars[l.id]);
		if (eg)
			return {
				area: t('learn.endgames'),
				title: lessonTitle(eg),
				href: resolve(`/learn/endgame?id=${eg.id}`),
				c: 'var(--c-analysis)'
			};
		return null;
	});

	const total = $derived(Object.values(stars).reduce((a, b) => a + b, 0));
</script>

{#snippet starChip(a: StarArea)}
	{@const s = starsOf(a)}
	{#if s}<span class="st"><Star size={12} fill="currentColor" /> {s.earned}/{s.max}</span>{/if}
{/snippet}

<svelte:head><title>{t('learn.title')} – Rookie</title></svelte:head>

<PageHeader eyebrow={t('learn.eyebrow')} title={t('learn.title')} subtitle={t('learn.subtitle')}>
	{#snippet action()}
		{#if loaded}
			<a
				class="all-stars"
				href={resolve('/profile')}
				aria-label="{t('stars.title')}: {t('stars.total', { n: allStars.earned, m: allStars.max })}"
				><Star size={17} fill="currentColor" /><b>{allStars.earned}</b><small>/{allStars.max}</small
				></a
			>
		{/if}
	{/snippet}
</PageHeader>

<div class="wrap">
	{#if next}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- next.href ist bereits aufgelöst -->
		<a
			class="next card pressable"
			href={next.href}
			style:--c={next.c}
			aria-label="{t('learn.continue')}: {next.title}"
		>
			<span class="n-text">
				<span class="eyebrow">{t('learn.continue')} · {next.area}</span>
				<b>{next.title}</b>
			</span>
			<span class="n-go"><ArrowRight size={20} /></span>
		</a>
	{:else if !loaded}
		<div class="skeleton" style:height="76px"></div>
	{/if}

	<div class="paths">
		<a class="path card pressable" style:--c="var(--c-puzzle)" href={resolve('/learn/basics')}>
			<span class="p-icon"><GraduationCap size={22} /></span>
			<span class="p-main">
				<b>{t('basics.title')}</b>
				<span class="p-text">{t('basics.hubText')}</span>
				<span class="p-bar"><span style:width="{(basicsDone / BASICS.length) * 100}%"></span></span>
				<span class="p-meta"
					>{@render starChip('basics')}{t('basics.progress', {
						n: basicsDone,
						m: BASICS.length
					})}</span
				>
			</span>
			<ChevronRight size={18} class="chev" />
		</a>
		<a
			class="path card pressable"
			style:--c="var(--c-play)"
			href={resolve('/learn/basics?set=tactics')}
		>
			<span class="p-icon"><Swords size={22} /></span>
			<span class="p-main">
				<b>{t('tactics.title')}</b>
				<span class="p-text">{t('tactics.hubText')}</span>
				<span class="p-bar"
					><span style:width="{(tacticsDone / TACTICS.length) * 100}%"></span></span
				>
				<span class="p-meta"
					>{@render starChip('tactics')}{t('basics.progress', {
						n: tacticsDone,
						m: TACTICS.length
					})}</span
				>
			</span>
			<ChevronRight size={18} class="chev" />
		</a>
		<a class="path card pressable" style:--c="var(--c-learn)" href={resolve('/learn/openings')}>
			<span class="p-icon"><BookOpen size={22} /></span>
			<span class="p-main">
				<b>{t('learn.openings')}</b>
				<span class="p-text">{t('learn.openingsText')}</span>
				<span class="p-bar"
					><span style:width="{Math.min(100, (repCount / 40) * 100)}%"></span></span
				>
				<span class="p-meta">
					{@render starChip('openings')}
					{t('openings.moves', { n: repCount })}{#if repDue}
						· <b class="due">{t('openings.due', { n: repDue })}</b>{/if}
				</span>
			</span>
			<ChevronRight size={18} class="chev" />
		</a>
	</div>

	<div class="sec-head">
		<div>
			<h2><Crown size={20} /> {t('learn.endgames')}</h2>
			<p>{t('learn.endgamesText')}</p>
		</div>
		<span class="total"
			><Star size={15} fill="var(--warn)" color="var(--warn)" />
			{total} / {LESSONS.length * 3}</span
		>
	</div>

	<div class="lessons">
		{#each LESSONS as l (l.id)}
			<a
				class="lesson card pressable"
				href={resolve(`/learn/endgame?id=${l.id}`)}
				class:done={(stars[l.id] ?? 0) > 0}
			>
				<span class="l-icon lv{l.level}"><LessonIcon icon={l.icon} size={20} /></span>
				<span class="l-main">
					<span class="l-title">{lessonTitle(l)}</span>
					<span class="l-sub"
						><span class="lvl lv{l.level}">{t('learn.level', { n: l.level })}</span> · {lessonSubtitle(
							l
						)}</span
					>
				</span>
				<Stars n={stars[l.id] ?? 0} size={14} />
			</a>
		{/each}
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 1040px;
	}

	.next {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 1rem 1rem 1rem 1.15rem;
		color: var(--text);
		border: 1.5px solid color-mix(in srgb, var(--c) 40%, transparent);
		background:
			radial-gradient(
				120% 140% at 100% 0%,
				color-mix(in srgb, var(--c) 16%, transparent),
				transparent 70%
			),
			var(--surface);
	}

	.n-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.n-text .eyebrow {
		color: color-mix(in srgb, var(--c) 70%, var(--text));
	}

	.n-text b {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.n-go {
		flex: none;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: var(--c);
		color: #fff;
		box-shadow: 0 6px 16px color-mix(in srgb, var(--c) 35%, transparent);
	}

	.paths {
		display: grid;
		gap: 0.5rem;
	}

	@media (min-width: 900px) {
		.paths {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.path {
			align-items: flex-start !important;
		}
	}

	.path {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 0.8rem 0.9rem 0.95rem;
		color: var(--text);
	}

	.p-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 13px;
		background: var(--c);
		color: #fff;
	}

	.p-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.path b {
		font-size: 1.05rem;
	}

	.p-text {
		font-size: 0.84rem;
		color: var(--text-2);
		line-height: 1.35;
	}

	.p-bar {
		height: 4px;
		margin-top: 0.35rem;
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
		font-size: 0.76rem;
		color: var(--text-2);
	}

	.path :global(.chev) {
		flex: none;
		color: var(--text-3);
	}

	.st {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		margin-right: 0.45rem;
		font-weight: 700;
		color: var(--warn-text);
	}

	.all-stars {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 44px;
		padding: 0 0.85rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--warn) 16%, var(--surface));
		border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
		color: var(--warn);
	}

	.all-stars b {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--text);
	}

	.all-stars small {
		font-size: 0.8rem;
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
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 1.3rem;
	}

	.sec-head p {
		color: var(--text-2);
		font-size: 0.92rem;
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
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
		gap: 0.45rem;
	}

	.lesson {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 64px;
		padding: 0.65rem 0.85rem 0.65rem 0.7rem;
		color: var(--text);
	}

	.l-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		color: #fff;
		background: var(--c-learn);
	}

	.l-icon.lv2 {
		background: var(--c-puzzle);
	}

	.l-icon.lv3 {
		background: var(--c-play);
	}

	.l-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.l-title {
		font-family: var(--font-display);
		font-weight: 680;
		font-size: 1rem;
		letter-spacing: -0.01em;
	}

	.l-sub {
		font-size: 0.8rem;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lvl {
		font-weight: 700;
		color: var(--c-learn);
	}

	.lvl.lv2 {
		color: var(--c-puzzle);
	}

	.lvl.lv3 {
		color: var(--c-play);
	}
</style>
