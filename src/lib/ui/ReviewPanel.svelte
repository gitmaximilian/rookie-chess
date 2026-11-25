<script lang="ts" module>
	export interface LiveLine {
		/** Bewertung aus Sicht von Weiß */
		score: { cp?: number; mate?: number };
		/** SAN-Züge (mit Figurensymbolen) */
		san: string[];
		/** UCI-Züge, für Pfeile */
		uci: string[];
	}
</script>

<script lang="ts">
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import { formatScore } from '#lib/engine/uci.js';
	import { KIND_GLYPH, KIND_ICON, kindColor, type Kind } from '#lib/analysis/kinds.js';
	import { t } from '#lib/i18n/i18n.svelte.js';

	interface Props {
		kind: Kind | null;
		headline: string;
		text: string;
		/** z. B. „Zug von Hikaru“ */
		who?: string;
		/** Einordnung der Stellung nach dem Zug */
		verdict?: string;
		score?: { cp?: number; mate?: number } | null;
		lines: LiveLine[];
		thinking: boolean;
		depth?: number;
		selected: number | null;
		onselect: (i: number | null) => void;
		/** Zeilennummer des ersten Zugs der Varianten (z. B. „12.“ oder „12…“) */
		moveNo: string;
	}

	let {
		kind,
		headline,
		text,
		who,
		verdict,
		score,
		lines,
		thinking,
		depth,
		selected,
		onselect,
		moveNo
	}: Props = $props();

	const Icon = $derived(kind ? KIND_ICON[kind] : undefined);
</script>

<section class="rp card" style:--k={kind ? kindColor(kind) : 'var(--c-learn)'} aria-live="polite">
	<div class="coach">
		<span class="avatar" aria-hidden="true">
			{#if kind}
				{#if Icon}<Icon size={17} strokeWidth={3} />{:else}{KIND_GLYPH[kind]}{/if}
			{:else}
				<GraduationCap size={18} />
			{/if}
		</span>
		<div class="bubble">
			{#if who}<span class="who">{who}</span>{/if}
			<p class="head">{headline}</p>
			<p class="text">{text}</p>
		</div>
	</div>

	<!-- Bewertung und Varianten sind immer da (notfalls leer), damit die Karte beim
	     Durchklicken gleich hoch bleibt und nichts darunter springt -->
	<div class="eval-row">
		{#if score}<span class="chip" class:neg={(score.mate ?? score.cp ?? 0) < 0}
				>{formatScore(score)}</span
			>{/if}
		{#if verdict}<span class="verdict">{verdict}</span>{/if}
	</div>

	<div class="lines" role="group" aria-label={t('review.lines')}>
		<div class="l-head">
			<span>{t('review.lines')}</span>
			<span class="depth" class:busy={thinking}>
				{thinking ? t('review.thinking') : depth ? t('review.depth', { d: depth }) : ''}
			</span>
		</div>
		{#each [0, 1, 2] as i (i)}
			{@const l = lines[i]}
			{#if l}
				<button
					class="line"
					class:on={selected === i}
					class:top={i === 0}
					onclick={() => onselect(selected === i ? null : i)}
					aria-pressed={selected === i}
				>
					<span class="ev" class:neg={(l.score.mate ?? l.score.cp ?? 0) < 0}
						>{formatScore(l.score)}</span
					>
					<span class="pv"><span class="no">{moveNo}</span> {l.san.join(' ')}</span>
				</button>
			{:else if thinking}
				<div class="line ph" aria-hidden="true">
					<span class="ev skeleton"></span><span class="pv skeleton"></span>
				</div>
			{:else}
				<!-- leerer Platz in voller Höhe (nur zwei Züge möglich oder Partie zu Ende) -->
				<div class="line empty" aria-hidden="true"></div>
			{/if}
		{/each}
	</div>
</section>

<style>
	.rp {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.85rem 0.9rem 0.8rem;
		border-top: 3px solid var(--k);
		transition: border-color var(--dur) var(--ease-out);
	}

	.coach {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		/* feste Höhe (Absender, eine Zeile Überschrift, drei Zeilen Text):
		   die Karte bleibt beim Durchklicken gleich hoch, nichts darunter springt */
		min-height: 6.9rem;
	}

	.avatar {
		flex: none;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--k);
		color: #fff;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.95rem;
		letter-spacing: -0.04em;
		transition: background-color var(--dur) var(--ease-out);
	}

	.bubble {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.who {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.head {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: var(--font-display);
		font-weight: 720;
		font-size: 1.05rem;
		line-height: 1.25;
		color: color-mix(in srgb, var(--k) 70%, var(--text));
	}

	.text {
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--text-2);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.eval-row {
		min-height: 1.6rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.chip,
	.ev {
		flex: none;
		display: inline-grid;
		place-items: center;
		min-width: 3.1rem;
		padding: 0.15rem 0.4rem;
		border-radius: 7px;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 700;
		background: #f4f1ea;
		color: #1c1a17;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
	}

	.chip.neg,
	.ev.neg {
		background: #2a2724;
		color: #f4f1ea;
	}

	.lines {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--line);
	}

	.l-head {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
		margin-bottom: 0.1rem;
	}

	.depth {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 600;
	}

	.depth.busy {
		animation: breathe 1.4s ease-in-out infinite;
	}

	@keyframes breathe {
		50% {
			opacity: 0.45;
		}
	}

	.line {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 36px;
		padding: 0.2rem 0.4rem;
		border: none;
		border-radius: 9px;
		background: none;
		font: inherit;
		color: var(--text-2);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.line.top {
		color: var(--text);
	}

	.line.on {
		background: color-mix(in srgb, var(--c-learn) 14%, var(--surface));
		color: var(--text);
	}

	@media (hover: hover) {
		.line:not(.ph):hover {
			background: var(--surface-2);
		}
	}

	.pv {
		flex: 1;
		min-width: 0;
		font-size: 0.88rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-variant-numeric: tabular-nums;
	}

	.line.top .pv {
		font-weight: 650;
	}

	.no {
		color: var(--text-3);
		font-weight: 500;
	}

	.line.empty {
		cursor: default;
	}

	.ph .ev {
		height: 22px;
		box-shadow: none;
	}

	.ph .pv {
		height: 14px;
		max-width: 70%;
	}

	/* Handy: der Kommentar steht über dem Brett (CommentBar), hier bleiben Bewertung und Varianten */
	@media (max-width: 767px) {
		.coach {
			display: none;
		}
		/* die Farbe der Zugart steht oben im Kommentar – hier eine ruhige Karte */
		.rp {
			border-top: 1px solid var(--line);
			padding-top: 0.75rem;
		}
	}
</style>
