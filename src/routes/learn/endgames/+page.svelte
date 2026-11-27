<script lang="ts">
	/** Alle Endspiel-Lektionen – eigene Seite, damit „Lernen“ eine kurze Übersicht bleibt */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Star from '@lucide/svelte/icons/star';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import LessonIcon from '#lib/ui/LessonIcon.svelte';
	import Stars from '#lib/ui/Stars.svelte';
	import { LESSONS, lessonTitle, lessonSubtitle } from '#lib/endgames/lessons.js';
	import { db } from '#lib/db/db.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let stars = $state<Record<string, number>>({});
	onMount(async () => {
		const rows = await db.endgames.toArray();
		stars = Object.fromEntries(rows.map((r) => [r.id, r.stars]));
	});
	const total = $derived(Object.values(stars).reduce((a, b) => a + b, 0));
</script>

<svelte:head><title>{t('learn.endgames')} – Rookie</title></svelte:head>

<a class="back hit44" href={resolve('/learn')}><ArrowLeft size={18} /> {t('endgame.back')}</a>
<PageHeader title={t('learn.endgames')} />

<div class="wrap">
	<div class="sec-head">
		<div>
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
		max-width: 1100px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
		color: var(--text-2);
		margin-bottom: 0.75rem;
	}

	.sec-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
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
		font-family: var(--font-num);
		font-weight: 500;
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
