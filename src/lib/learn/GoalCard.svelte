<!-- The weekly goal at the head of /learn's rail, in place of the streak
     (2026-11-15). A ring fills one part for each day practised this week,
     Monday to Sunday, against the days the visitor set on /review; it
     closes green with a tick once the goal is met, and stays closed however
     many days come after. A dot for each day of the week, and the days
     practised this month, under it. A missed day takes nothing away: the
     research behind the goal found that a broken streak lowers later
     practice, and that one missed day barely slows a habit. -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { keyOfDay, weekProgress, weekStart } from '#lib/review/days.ts';
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
		const n = weekStart(today) + i;
		return { n, count: n <= today ? (review.days[keyOfDay(n)] ?? 0) : 0 };
	}));
	let progress = $derived(weekProgress(review.days, today));
	let goal = $derived(review.settings.goal_days);
	let met = $derived(ready && goal > 0 && progress.week >= goal);

	// The ring: r = 23 in a 56-unit box, drawn from the top, clockwise
	const R = 23;
	const ROUND = 2 * Math.PI * R;
	let filled = $derived(ready && goal ? (Math.min(progress.week, goal) / goal) * ROUND : 0);

	const said = (day: { n: number; count: number }) =>
		day.count ? m.review.heatmap.reviewed(day.count, dayName(locale, day.n)) : m.review.heatmap.none(dayName(locale, day.n));
</script>

<section class="ui-card card" aria-labelledby="learn-goal">
	{#if goal}
		<div class="top">
			<svg class="ring" class:met viewBox="0 0 56 56" aria-hidden="true">
				<circle class="track" cx="28" cy="28" r={R} />
				{#if met}
					<path class="tick" d="M19 29l6 6 12-13" />
				{:else if filled}
					<circle class="fill" cx="28" cy="28" r={R} stroke-dasharray="{filled} {ROUND}" transform="rotate(-90 28 28)" />
				{/if}
			</svg>
			<h2 id="learn-goal">
				<span class="label">{m.review.goal.thisWeek}</span>
				<span class="figure">
					{#if !ready}–{:else if met}{m.review.heatmap.days(progress.week)}{:else}{m.review.goal.ofDays(progress.week, goal)}{/if}
				</span>
				{#if met}<span class="met-line">{m.review.goal.met(goal)}</span>{/if}
			</h2>
		</div>
		{#if review.settings.plan}<p class="plan">“{review.settings.plan}”</p>{/if}
	{:else}
		<h2 class="heading" id="learn-goal">{m.review.goal.practised}</h2>
	{/if}

	<ol class="week">
		{#each week as day (day.n)}
			<li class:lit={ready && day.count > 0} class:today={day.n === today} title={said(day)}>
				<span class="dot" aria-hidden="true"></span>
				<span aria-hidden="true">{weekday(locale, day.n, 'narrow')}</span>
				<span class="ui-sr-only">{said(day)}</span>
			</li>
		{/each}
	</ol>

	<p class="month">
		{#if ready}<b>{m.review.heatmap.days(progress.month)}</b> {m.review.goal.thisMonth}{:else}–{/if}
		{#if !goal}<br /><a href="/review#weekly-goal">{m.review.goal.set} →</a>{/if}
	</p>

	<!-- To where the goal and the plan are set, on /review -->
	<a class="ui-icon-btn cog" href="/review#weekly-goal" aria-label={m.review.goal.settings} title={m.review.goal.settings}>
		<Icon name="cog" size={16} />
	</a>
</section>

<style>
	.card {
		position: relative;
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem 0.9rem 0.9rem;
	}

	/* A small cog in the card's lower right corner, beside the month's line */
	.cog {
		position: absolute;
		right: 0.4rem;
		bottom: 0.35rem;
		width: 2rem;
		height: 2rem;
		color: var(--muted);
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.ring {
		flex: none;
		width: 3.5rem;
		height: 3.5rem;
		fill: none;
		stroke-width: 7;
	}

	.track {
		stroke: var(--surface-2);
	}

	.fill {
		stroke: var(--accent);
		stroke-linecap: round;
	}

	/* The goal met: the whole ring and a tick, in the colour of a right answer */
	.ring.met .track {
		stroke: var(--right);
	}

	.tick {
		stroke: var(--right);
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	h2 {
		display: grid;
		margin: 0;
		font-weight: 400;
	}

	.label {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.figure {
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: var(--text-xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
	}

	.met-line {
		color: var(--right);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.heading {
		font-family: var(--font-heading);
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.plan {
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
		font-style: italic;
		overflow-wrap: anywhere;
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

	.dot {
		box-sizing: border-box;
		width: 1.35rem;
		height: 1.35rem;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-pill);
	}

	.lit .dot {
		border-color: var(--accent);
		background: var(--accent);
	}

	.week .today {
		color: var(--ink);
		font-weight: 700;
	}

	/* Today, nothing yet: still open */
	.week .today:not(.lit) .dot {
		border-color: var(--ink-2);
		border-style: dashed;
	}

	.month {
		margin: 0;
		padding-top: 0.6rem;
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.month b {
		color: var(--ink);
		font-weight: 600;
	}

	.month a {
		font-weight: 600;
	}

	/* A phone: the week on one line, a smaller ring and its figure on the left
	   and the seven days on the right, with the month under them. Stacked as
	   in the rail (until 2026-11-16) the card was a fifth of the screen. */
	@media (max-width: 640px) {
		.card {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.45rem 0.75rem;
			padding: 0.6rem 0.8rem 0.65rem;
		}

		.top,
		.heading {
			grid-row: 1;
			grid-column: 1;
			gap: 0.55rem;
		}

		.week {
			grid-row: 1;
			grid-column: 2;
			gap: 0.35rem;
		}

		.plan,
		.month {
			grid-column: 1 / -1;
		}

		.ring {
			width: 2.25rem;
			height: 2.25rem;
		}

		.figure {
			font-size: var(--text-lg);
		}

		.week li {
			gap: 0.15rem;
		}

		.dot {
			width: 1rem;
			height: 1rem;
		}

		.month {
			padding-top: 0.45rem;
		}
	}
</style>
