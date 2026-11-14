<script lang="ts">
	/**
	 * Skill-Penta: Fünfeck + Detailkarte + Empfehlung (lib/training/skills.ts).
	 * Standardauswahl: die Ecke mit dem größten erwarteten Elo-Gewinn.
	 */
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import SkillRadar from '#lib/ui/SkillRadar.svelte';
	import {
		valueAt,
		shareAt,
		SKILL_TABLE,
		MEAN_COUNT,
		MIN_SAMPLE,
		SKILLS,
		type Advice,
		type Skill,
		type SkillValue
	} from '#lib/training/skills.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	let {
		values,
		advice,
		overall,
		games,
		blunderShare = { opening: null, endgame: null }
	}: {
		values: SkillValue[];
		advice: Advice[];
		overall: { elo: number; score: number } | null;
		/** analysierte Partien, die einfließen */
		games: number;
		/** Anteil der Patzer am Verlust in Eröffnung und Endspiel (collectSkills) */
		blunderShare?: { opening: number | null; endgame: number | null };
	} = $props();

	let chosen = $state<Skill | null>(null);
	const selected = $derived<Skill>(chosen ?? advice[0]?.skill ?? 'safety');
	const v = $derived(values.find((x) => x.skill === selected)!);
	const adv = $derived(advice.find((a) => a.skill === selected) ?? null);
	const top = $derived(advice[0] ?? null);
	/** Anteil am Abstand zu Spielern 200 Elo über dir (aus Lichess-Daten) */
	const share = $derived(overall ? shareAt(overall.elo) : null);
	const bottom = SKILL_TABLE[0]?.r ?? 0;
	const topR = SKILL_TABLE.at(-1)?.r ?? 0;

	/** Messwert lesbar: Patzer mit einer Nachkommastelle, sonst ganze Prozent */
	const fmt = (s: Skill, x: number) =>
		s === 'safety'
			? x.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
			: String(Math.round(x));
	const unit = (s: Skill, x: number) => t(`skills.unit.${s}`, { v: fmt(s, x) });

	const LEVELS = [800, 1200, 1600, 2000, 2800];
	/** Eröffnung/Endspiel voller Patzer: dann führt der Rat zum Blunder-Check (lib/training/skills.ts) */
	const viaSafety = $derived(adv?.viaSafety ?? false);
	const blunderPct = $derived(
		selected === 'opening' || selected === 'endgame'
			? Math.round((blunderShare[selected] ?? 0) * 100)
			: 0
	);
	const ctaSkill = $derived<Skill>(viaSafety ? 'safety' : selected);

	const HREF: Record<Skill, string> = {
		safety: '/puzzles/safety',
		tactics: '/puzzles',
		opening: '/learn/openings',
		strategy: '/learn/basics?set=positional',
		endgame: '/learn/endgame'
	};
</script>

<section class="penta" data-testid="skill-penta">
	<header class="ph">
		<div>
			<h2>{t('skills.title')}</h2>
			<p class="muted">{t('skills.subtitle')}</p>
		</div>
		{#if overall}
			<div class="overall" title={t('skills.overallTitle')}>
				<span class="mono-label">{t('skills.overall')}</span>
				<b>{overall.score}<small>/100</small></b>
				<span>{t('skills.overallFrom', { elo: overall.elo })}</span>
			</div>
		{/if}
	</header>

	{#if top && top.gain > 0}
		<button class="lever" onclick={() => (chosen = top.skill)} data-testid="skill-lever">
			<TrendingUp size={18} />
			<span
				><b>{t('skills.lever', { name: t(`skills.name.${top.skill}`), gain: top.gain })}</b></span
			>
		</button>
	{/if}

	<SkillRadar {values} {selected} overall={overall?.score ?? null} onSelect={(s) => (chosen = s)} />

	<!-- dieselbe Auswahl als Knöpfe (Tastatur, Screenreader, kleine Bildschirme) -->
	<div class="chips" role="tablist" aria-label={t('skills.title')}>
		{#each SKILLS as s (s)}
			{@const x = values.find((y) => y.skill === s)!}
			<button
				role="tab"
				aria-selected={selected === s}
				class:on={selected === s}
				onclick={() => (chosen = s)}>{t(`skills.name.${s}`)} <b>{x.score ?? '–'}</b></button
			>
		{/each}
	</div>

	<div class="detail card" role="tabpanel" data-testid="skill-detail">
		<div class="d-head">
			<h3>{t(`skills.name.${selected}`)}</h3>
			{#if v.score !== null}
				<span class="d-score"><b>{v.score}</b>/100</span>
			{/if}
		</div>

		{#if v.score !== null && v.value !== null}
			<p class="d-you">{unit(selected, v.value)}</p>
			<p class="d-elo muted">
				{(v.elo ?? 0) <= bottom
					? t('skills.eloEqLow', { elo: bottom })
					: (v.elo ?? 0) >= topR
						? t('skills.eloEqHigh', { elo: topR })
						: t('skills.eloEq', { elo: v.elo ?? 0 })}
				{#if v.low !== null && v.high !== null && v.high > v.low}
					{t('skills.range', { low: v.low, high: v.high })}
				{/if}
			</p>
		{:else}
			<p class="d-you muted">
				{t('skills.needMoreShort', {
					n: Math.max(1, Math.ceil(v.missing / MEAN_COUNT[selected]))
				})}
			</p>
		{/if}

		<!-- So sieht der Wert auf anderen Niveaus aus -->
		<div class="scale" aria-label={t('skills.scaleLabel')}>
			{#each LEVELS as lv (lv)}
				<span class="lv" class:mine={v.elo !== null && Math.abs(v.elo - lv) < 200}>
					<small>{lv === 2800 ? t('skills.eliteShort') : lv}</small>
					<b>{fmt(selected, valueAt(selected, lv))}</b>
				</span>
			{/each}
		</div>

		<!-- genau ein nächster Schritt; alles Erklärende steht unter „Mehr dazu“ -->
		<div class="next" data-testid="skill-next">
			<span class="mono-label">{t('skills.next')}</span>
			<p>
				{#if viaSafety}
					<span data-testid="skill-via-safety"
						>{t('skills.viaSafetyShort', { pct: blunderPct })}</span
					>
				{:else}
					{t(`skills.howShort.${selected}`)}
				{/if}
			</p>
			<div class="next-row">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- HREF wird hier aufgelöst -->
				<a class="btn" href={resolve(HREF[ctaSkill] as '/')}
					>{t(`skills.cta.${ctaSkill}`)} <ArrowRight size={16} /></a
				>
				{#if adv && adv.gain > 0}
					<span class="gain" data-testid="skill-gain"
						><TrendingUp size={16} /> {t('skills.gainShort', { gain: adv.gain })}</span
					>
				{/if}
			</div>
		</div>

		<details class="more">
			<summary>{t('skills.more')} <ChevronDown size={16} /></summary>
			<p>{t(`skills.what.${selected}`)}</p>
			{#if v.score !== null && v.value !== null}
				<p>{t('skills.you', { value: unit(selected, v.value), n: games })}</p>
			{/if}
			<h4>{t('skills.why')}</h4>
			<p>{t(`skills.whyText.${selected}`)}</p>
			{#if share && overall}
				<p>
					{t('skills.share', {
						name: t(`skills.name.${selected}`),
						pct: Math.round(share[selected] * 100),
						elo: overall.elo
					})}
				</p>
			{/if}
			<h4>{t('skills.how')}</h4>
			<p>
				{viaSafety ? t('skills.viaSafety', { pct: blunderPct }) : t(`skills.howText.${selected}`)}
			</p>
			{#if adv && adv.gain > 0}
				<p>
					{t('skills.gain', {
						name: t(`skills.name.${selected}`),
						target: adv.target,
						value: unit(selected, adv.targetValue),
						gain: adv.gain,
						points: adv.points.toLocaleString(undefined, { maximumFractionDigits: 1 })
					})}
				</p>
			{/if}
			{#if v.score === null}
				<p>
					{t('skills.needMore', {
						n: Math.max(1, Math.ceil(v.missing / MEAN_COUNT[selected])),
						what: t(`skills.sample.${selected}`, { n: MIN_SAMPLE[selected] })
					})}
				</p>
			{/if}
			<p class="note">{t('skills.note')}</p>
		</details>
	</div>
</section>

<style>
	.penta {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.ph {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.ph h2 {
		font-size: 1.25rem;
	}

	.muted {
		color: var(--text-2);
		font-size: 0.88rem;
	}

	.overall {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.05rem;
		flex: none;
	}

	.overall b {
		font-family: var(--font-num);
		font-size: 1.6rem;
		font-weight: 600;
	}

	.overall small {
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.overall span:last-child {
		font-family: var(--font-num);
		font-size: 0.82rem;
		color: var(--text-2);
	}

	.lever {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		width: 100%;
		padding: 0.75rem 0.9rem;
		border: 1.5px solid var(--c-coach);
		border-radius: 16px;
		background: color-mix(in srgb, var(--c-coach) 9%, transparent);
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.lever > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
	}

	.chips button {
		min-height: 44px;
		padding: 0.35rem 0.8rem;
		border: 1.5px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-2);
		font: inherit;
		font-size: 0.86rem;
		font-weight: 600;
		cursor: pointer;
	}

	.chips button b {
		font-family: var(--font-num);
		color: var(--text);
		margin-left: 0.2rem;
	}

	.chips button.on {
		border-color: var(--c-coach);
		color: var(--text);
		background: color-mix(in srgb, var(--c-coach) 10%, var(--surface));
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem;
	}

	.d-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.d-head h3 {
		font-size: 1.15rem;
	}

	.d-score {
		font-family: var(--font-num);
		color: var(--text-2);
	}

	.d-score b {
		font-size: 1.4rem;
		color: var(--text);
	}

	.d-you {
		font-family: var(--font-num);
		font-size: 1.25rem;
		font-weight: 700;
	}

	.d-elo {
		font-size: 0.9rem;
		margin-top: -0.35rem;
	}

	.scale {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.3rem;
		margin: 0.2rem 0;
	}

	.lv {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.4rem 0.2rem;
		border-radius: 10px;
		background: var(--surface-2);
		min-width: 0;
	}

	.lv small {
		font-size: 0.7rem;
		color: var(--text-2);
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lv b {
		font-family: var(--font-num);
		font-size: 0.95rem;
	}

	.lv.mine {
		outline: 2px solid var(--c-coach);
	}

	/* der eine nächste Schritt */
	.next {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.8rem 0.9rem;
		border-radius: 14px;
		background: color-mix(in srgb, var(--c-coach) 10%, transparent);
	}

	.next p {
		font-weight: 600;
		line-height: 1.35;
	}

	.next-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.9rem;
	}

	.gain {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--good-text);
		font-family: var(--font-num);
		font-weight: 700;
		white-space: nowrap;
	}

	.gain :global(svg) {
		flex-shrink: 0;
	}

	/* Erklärungen nur auf Wunsch */
	.more summary {
		list-style: none;
		gap: 0.3rem;
		cursor: pointer;
		font-weight: 600;
		color: var(--text-2);
		min-height: 44px;
		display: flex;
		align-items: center;
	}

	.more summary::-webkit-details-marker {
		display: none;
	}

	.more summary :global(svg) {
		transition: transform 0.2s;
	}

	.more[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	.more p {
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--text-2);
		margin-top: 0.45rem;
	}

	h4 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-3);
		margin-top: 0.7rem;
	}

	.more .note {
		font-size: 0.76rem;
		color: var(--text-3);
	}
</style>
