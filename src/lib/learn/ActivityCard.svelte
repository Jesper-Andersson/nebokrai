<!-- What was done on each of the last fourteen days, as columns, today at
     the right. One colour: a day's count is kept for words and rules
     together (review.days), not by kind. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { keyOfDay } from '#lib/review/days.ts';
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
	let done = $derived(Array.from({ length: 14 }, (_, i) => {
		const n = today - 13 + i;
		return { n, count: review.days[keyOfDay(n)] ?? 0 };
	}));
	let most = $derived(Math.max(1, ...done.map((day) => day.count)));
	let sum = $derived(done.reduce((total, day) => total + day.count, 0));

	const said = (day: { n: number; count: number }) =>
		day.count ? m.review.heatmap.reviewed(day.count, dayName(locale, day.n)) : m.review.heatmap.none(dayName(locale, day.n));
</script>

<section class="ui-card card" aria-labelledby="learn-activity">
	<div class="head">
		<h2 id="learn-activity">{m.learn.activity}</h2>
		<span class="sum">{ready ? m.learn.inDays(sum) : ''}</span>
	</div>
	<ol class="chart">
		{#each done as day (day.n)}
			<li title={said(day)}>
				<span class="column">
					{#if ready && day.count}<i style:height="{(day.count / most) * 100}%"></i>{/if}
				</span>
				<span class="tick" class:today={day.n === today} aria-hidden="true">{weekday(locale, day.n, 'narrow')}</span>
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

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.sum {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* Columns standing on one line, a day each, the taller the more; the
	   days' letters under a hairline */
	.chart {
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chart li {
		display: grid;
		gap: 0.3rem;
	}

	.column {
		display: flex;
		align-items: flex-end;
		height: 4.25rem;
		border-bottom: 1px solid var(--border);
	}

	.column i {
		width: 100%;
		min-height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--accent);
	}

	.tick {
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1;
		text-align: center;
	}

	.tick.today {
		color: var(--ink);
		font-weight: 700;
	}
</style>
