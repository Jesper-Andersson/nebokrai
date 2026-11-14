<!-- The streak at the head of /learn's rail: how many days in a row, and the
     last seven days, today at the right. A flame burns where something was
     reviewed, and is an outline where nothing was. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { keyOfDay, reviewStats } from '#lib/review/days.ts';
	import { dayNumber } from '#lib/review/fsrs.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import { dayName, weekday } from './days.ts';

	let { now, ready }: { now: number; ready: boolean } = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));
	let locale = $derived(settings.lang === 'uk' ? 'uk' : 'en-GB');

	let today = $derived(dayNumber(now));
	let week = $derived(Array.from({ length: 7 }, (_, i) => {
		const n = today - 6 + i;
		return { n, count: review.days[keyOfDay(n)] ?? 0 };
	}));
	let stats = $derived(reviewStats(review.days, today));

	const said = (day: { n: number; count: number }) =>
		day.count ? m.review.heatmap.reviewed(day.count, dayName(locale, day.n)) : m.review.heatmap.none(dayName(locale, day.n));
</script>

<section class="ui-card card" aria-labelledby="learn-streak">
	<h2 class="streak" id="learn-streak">
		<span class="figure">{ready ? stats.streak : '–'}</span>
		<span>{m.review.heatmap.streak}</span>
	</h2>
	<!-- The colours are drawn once here, red at the tip and amber below, and
	     each flame takes them by name -->
	<svg class="defs" aria-hidden="true">
		<defs>
			<linearGradient id="learn-flame" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" style="stop-color: var(--flame-tip)" />
				<stop offset="70%" style="stop-color: var(--flame)" />
			</linearGradient>
		</defs>
	</svg>
	<ol class="week">
		{#each week as day (day.n)}
			<li class:lit={ready && day.count > 0} class:today={day.n === today} title={said(day)}>
				<!-- The header's flame (Header.svelte), one for each day -->
				<svg class="flame" viewBox="1 -2 22 26" aria-hidden="true">
					<path
						class="body"
						fill="url(#learn-flame)"
						d="M13 1c.6 3.2 3 4.9 4.7 7.2 1.4 1.9 2.3 4 2.3 6.3A8 8 0 0 1 4 14.5c0-2.6 1.1-4.9 2.7-6.6.3 1.6 1 2.7 2.2 3.3C8.6 7.6 10 3.6 13 1z"
					/>
				</svg>
				<span aria-hidden="true">{weekday(locale, day.n, 'short')}</span>
				<span class="ui-sr-only">{said(day)}</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.card {
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem 0.9rem 0.9rem;
	}

	.streak {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	.figure {
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: 1.6rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.week {
		display: flex;
		justify-content: space-between;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.week li {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	/* Holds the flames' colours and takes no room */
	.defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	.flame {
		width: 1.5rem;
		height: 1.77rem;
		overflow: visible;
	}

	/* A day with no review: the flame's outline, as in the header */
	.week li:not(.lit) .body {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	.week .today {
		color: var(--ink);
		font-weight: 700;
	}

	/* Today, not yet kept: still to be lit */
	.week .today:not(.lit) .body {
		stroke: var(--muted);
		stroke-dasharray: 3 2.5;
	}

	/* Today's flame flickers, swaying from its foot; the days behind it
	   burn still, or seven of them would be a distraction */
	.week .today.lit .body {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: flame-sway 1.7s ease-in-out infinite alternate;
	}

	@keyframes flame-sway {
		from {
			transform: scale(1, 0.96) skewX(-2.5deg);
		}

		50% {
			transform: scale(0.97, 1.04) skewX(1.5deg);
		}

		to {
			transform: scale(1.02, 0.98) skewX(3deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.week .today.lit .body {
			animation: none;
		}
	}
</style>
