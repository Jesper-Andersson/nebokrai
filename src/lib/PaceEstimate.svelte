<!-- Where the chosen number of new words a day takes the visitor through the
     2,000 commonest words (review/pace.ts), under "Your pace" on /review. On a
     wide screen a chart of words begun over the coming months; on a phone a
     line of milestones with their dates. Both are drawings: the same dates are
     said in a list for screen readers. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import type { Pace, PaceBasis } from '#lib/review/pace.ts';
	import { useSettings } from '#lib/settings.ts';

	let { pace, newPerDay, perWeek, basis, now }: {
		pace: Pace; newPerDay: number; perWeek: number; basis: PaceBasis; now: number;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// "Feb 2027": a month is as near as an estimate like this can honestly say
	let month = $derived(new Intl.DateTimeFormat(settings.lang === 'uk' ? 'uk' : 'en-GB', { month: 'short', year: 'numeric' }));
	const when = (at: number | null) => (at === null ? m.review.pace.never : at === 0 ? m.review.pace.done : month.format(at));

	let ahead = $derived(pace.milestones.filter((mark) => mark.at !== 0));
	let reachable = $derived(ahead.length > 0 && ahead.every((mark) => mark.at !== null));
	// Days a week as said: 3.4 is "3", but never "0"
	let days = $derived(Math.max(1, Math.round(perWeek)));

	// --- The chart ---
	// As wide as its column, in pixels, so that its labels stay the size of the text around them
	let width = $state(460);
	let W = $derived(Math.max(240, Math.round(width)));
	let RIGHT = $derived(W - 12);
	const LEFT = 44, TOP = 14, BOTTOM = 136;
	let end = $derived(Math.max(now + 30 * 86_400_000, ...ahead.map((mark) => mark.at ?? 0)));
	const x = (t: number) => LEFT + ((t - now) / (end - now)) * (RIGHT - LEFT);
	const y = (v: number) => BOTTOM - (v / pace.total) * (BOTTOM - TOP);
	let points = $derived([
		[x(now), y(pace.started)],
		...ahead.map((mark) => [x(mark.at ?? end), y(mark.count)])
	]);
	let line = $derived(points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' '));
	let area = $derived(`${line} L${points.at(-1)![0].toFixed(1)} ${BOTTOM} L${LEFT} ${BOTTOM} Z`);
	/** The first of each month along the way, at most five of them labelled */
	let months = $derived.by(() => {
		const out: number[] = [];
		const d = new Date(now);
		d.setDate(1);
		d.setHours(12, 0, 0, 0);
		for (d.setMonth(d.getMonth() + 1); d.getTime() <= end; d.setMonth(d.getMonth() + 1)) out.push(d.getTime());
		const step = Math.ceil(out.length / 5);
		return out.filter((_, i) => i % step === 0);
	});
	let monthName = $derived(new Intl.DateTimeFormat(settings.lang === 'uk' ? 'uk' : 'en-GB', { month: 'short' }));
</script>

<div class="pace">
	{#if newPerDay <= 0}
		<p class="muted">{m.review.pace.none}</p>
	{:else if !ahead.length}
		<p class="muted">{m.review.pace.allBegun(pace.total)}</p>
	{:else}
		<p class="lead">{m.review.pace.lead(newPerDay, days, basis)}</p>

		{#if reachable}
			<div class="chart" bind:clientWidth={width}>
				<svg viewBox="0 0 {W} 160" aria-hidden="true">
					{#each pace.milestones as mark (mark.count)}
						<line class="grid" x1={LEFT} x2={RIGHT} y1={y(mark.count)} y2={y(mark.count)} />
						<text class="axis" x={LEFT - 8} y={y(mark.count) + 4} text-anchor="end">{m.review.pace.mark(mark.count)}</text>
					{/each}
					<line class="base" x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />
					{#each months as t (t)}
						<text class="axis" x={x(t)} y={BOTTOM + 18} text-anchor="middle">{monthName.format(t)}</text>
					{/each}
					<path class="area" d={area} />
					<path class="line" d={line} />
					<circle class="now" cx={x(now)} cy={y(pace.started)} r="4" />
					{#each ahead as mark (mark.count)}
						<circle class="mark" cx={x(mark.at ?? end)} cy={y(mark.count)} r="4.5" />
						<text class="when" x={x(mark.at ?? end) - 8} y={y(mark.count) - 9} text-anchor="end">{when(mark.at)}</text>
					{/each}
				</svg>
			</div>
		{/if}

		<div class="track" aria-hidden="true">
			<span class="rail"><i style:width="{(pace.started / pace.total) * 100}%"></i></span>
			{#each pace.milestones as mark, i (mark.count)}
				{@const left = (mark.count / pace.total) * 100}
				<span class="stop" class:reached={mark.at === 0} style:left="{left}%"></span>
				<span class="cap" class:last={i === pace.milestones.length - 1} style:left="{left}%">
					<b>{m.review.pace.mark(mark.count)}</b>{when(mark.at)}
				</span>
			{/each}
		</div>

		<ul class="ui-sr-only">
			{#each pace.milestones as mark (mark.count)}
				<li>{m.review.pace.reached(mark.count, when(mark.at))}</li>
			{/each}
		</ul>
		<p class="muted">{m.review.pace.begun(pace.started, pace.total)}</p>
	{/if}
</div>

<style>
	.pace {
		display: grid;
		gap: 0.6rem;
	}

	.lead {
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.muted {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* A phone: the marks on one line, each with its date under it */
	.track {
		position: relative;
		height: 3.4rem;
		margin-inline: 0.5rem;
	}

	.rail {
		position: absolute;
		inset: 0.6rem 0 auto;
		height: 0.4rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		/* The ink, faint: shows on a plain page and over a photo, in every theme */
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.rail i {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.stop {
		position: absolute;
		top: 0.3rem;
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		transform: translateX(-50%);
	}

	.stop.reached {
		border-color: var(--accent);
		background: var(--accent);
	}

	.cap {
		position: absolute;
		top: 1.6rem;
		display: grid;
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1.25;
		text-align: center;
		white-space: nowrap;
		transform: translateX(-50%);
	}

	/* The last mark sits at the far end: its words end there too */
	.cap.last {
		text-align: end;
		transform: translateX(-100%);
	}

	.cap b {
		color: var(--ink-2);
		font-weight: 600;
	}

	/* A wide screen: the chart, and no line of marks */
	.chart {
		display: none;
	}

	.chart svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	@media (min-width: 60rem) {
		.chart {
			display: block;
		}

		.track {
			display: none;
		}
	}

	.grid {
		stroke: var(--border);
		stroke-dasharray: 3 4;
	}

	.base {
		stroke: var(--border-strong);
	}

	.axis {
		fill: var(--muted);
		font-size: var(--text-xs);
	}

	.area {
		fill: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.now {
		fill: var(--accent);
	}

	.mark {
		fill: var(--surface);
		stroke: var(--accent);
		stroke-width: 2;
	}

	.when {
		fill: var(--ink);
		font-size: var(--text-xs);
		font-weight: 600;
	}
</style>
