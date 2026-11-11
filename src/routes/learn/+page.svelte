<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BookOpen from '@lucide/svelte/icons/book-open';
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

	onMount(async () => {
		const rows = await db.endgames.toArray();
		stars = Object.fromEntries(rows.map((r) => [r.id, r.stars]));
		repCount = await db.repertoire.filter((r) => r.mine).count();
		repDue = await countDue('repertoire');
	});

	const total = $derived(Object.values(stars).reduce((a, b) => a + b, 0));
</script>

<svelte:head><title>{t('learn.title')} – Rookie</title></svelte:head>

<PageHeader eyebrow={t('learn.eyebrow')} title={t('learn.title')} subtitle={t('learn.subtitle')} />

<div class="wrap">
	<a class="openings card pressable" href={resolve('/learn/openings')}>
		<span class="o-icon"><BookOpen size={26} /></span>
		<span class="o-text">
			<b>{t('learn.openings')}</b>
			<span>{t('learn.openingsText')}</span>
			{#if repCount}
				<span class="o-meta">
					{t('openings.moves', { n: repCount })}{#if repDue}
						· <b class="due">{t('openings.due', { n: repDue })}</b>{/if}
				</span>
			{/if}
		</span>
		<ArrowRight size={20} />
	</a>

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

	.openings {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.1rem 1.25rem;
		color: var(--text);
		background:
			radial-gradient(90% 140% at 100% 0%, var(--c-learn-soft), transparent 70%), var(--surface);
	}

	.o-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--c-learn);
		color: #fff;
		box-shadow: 0 8px 20px color-mix(in srgb, var(--c-learn) 35%, transparent);
	}

	.o-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.o-text b {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 680;
	}

	.o-text span {
		color: var(--text-2);
		font-size: 0.92rem;
	}

	.o-meta {
		font-size: 0.82rem !important;
		font-weight: 600;
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
