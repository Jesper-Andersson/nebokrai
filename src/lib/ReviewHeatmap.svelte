<!-- Reviews by day as a calendar, in the manner of Anki's Review Heatmap
     add-on: a column a week, Monday at the top, the darker the square the
     more cards were reviewed that day. The weeks after today show, in grey,
     how many cards fall due. Above it the streak and the other counts made
     from the same days (src/lib/review/days.ts). -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { keyOfDay, reviewStats, type DayCounts } from '#lib/review/days.ts';
	import { DAY } from '#lib/review/fsrs.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		days,
		forecast,
		today
	}: {
		/** Reviews done, by day. */
		days: DayCounts;
		/** Cards that fall due, by day, for the days after today. */
		forecast: DayCounts;
		/** Today's day number (dayNumber in fsrs.ts). */
		today: number;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let locale = $derived(settings.lang === 'uk' ? 'uk' : 'en-GB');

	const PAST = 34; // weeks before this one: about eight months
	const FUTURE = 8;
	const COLUMNS = PAST + 1 + FUTURE;
	const SIZE = 11;
	const STEP = 14;
	const LEFT = 30; // room for the names of the days
	const TOP = 18; // and of the months
	const LEVELS = 4;

	// Day numbers count from a Thursday (1 January 1970); Monday is 0 here.
	const weekday = (n: number) => (n + 3) % 7;
	const date = (n: number) => new Date(n * DAY);

	let stats = $derived(reviewStats(days, today));
	let start = $derived(today - weekday(today) - PAST * 7);

	interface Cell {
		n: number;
		x: number;
		y: number;
		count: number;
		future: boolean;
		level: number;
	}

	let cells = $derived.by(() => {
		const list: Cell[] = [];
		let most = 1;
		let mostDue = 1;
		for (let i = 0; i < COLUMNS * 7; i++) {
			const n = start + i;
			const future = n > today;
			const count = (future ? forecast : days)[keyOfDay(n)] ?? 0;
			if (future) mostDue = Math.max(mostDue, count);
			else most = Math.max(most, count);
			list.push({ n, future, count, level: 0, x: LEFT + Math.floor(i / 7) * STEP, y: TOP + (i % 7) * STEP });
		}
		// Four steps up to the busiest day on show; any review at all reaches the first.
		for (const cell of list) {
			cell.level = cell.count ? Math.max(1, Math.ceil((cell.count / (cell.future ? mostDue : most)) * LEVELS)) : 0;
		}
		return list;
	});

	// The month's name over the first week that begins in it.
	let months = $derived.by(() => {
		const labels: { x: number; name: string }[] = [];
		let before = -1;
		for (let column = 0; column < COLUMNS; column++) {
			const first = date(start + column * 7);
			if (first.getUTCMonth() !== before && column < COLUMNS - 2) {
				labels.push({
					x: LEFT + column * STEP,
					name: first.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })
				});
			}
			before = first.getUTCMonth();
		}
		return labels;
	});

	// Monday, Wednesday, Friday: every other row, as on a wall calendar.
	let dayNames = $derived([0, 2, 4].map((row) => ({
		y: TOP + row * STEP + SIZE - 1,
		name: date(start + row).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
	})));

	const describe = (cell: Cell) => {
		const when = date(cell.n).toLocaleDateString(locale, {
			weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
		});
		if (cell.future) return cell.count ? m.review.heatmap.due(cell.count, when) : m.review.heatmap.noneDue(when);
		return cell.count ? m.review.heatmap.reviewed(cell.count, when) : m.review.heatmap.none(when);
	};

	// One tooltip for the whole calendar, moved to the square under the pointer
	// or the finger: three hundred squares each with their own would be heavy.
	let tip = $state<{ text: string; x: number; y: number } | null>(null);

	function hover(svg: SVGSVGElement) {
		const show = (event: PointerEvent) => {
			const index = (event.target as Element).getAttribute?.('data-i');
			if (index === null || index === undefined) return (tip = null);
			const cell = cells[Number(index)];
			tip = { text: describe(cell), x: cell.x + SIZE / 2, y: cell.y };
		};
		const hide = () => (tip = null);
		svg.addEventListener('pointermove', show);
		svg.addEventListener('pointerdown', show);
		svg.addEventListener('pointerleave', hide);
		return () => {
			svg.removeEventListener('pointermove', show);
			svg.removeEventListener('pointerdown', show);
			svg.removeEventListener('pointerleave', hide);
		};
	}

	// On a phone the calendar is wider than the page: begin at today, not eight months back.
	function toToday(box: HTMLElement) {
		box.scrollLeft = box.scrollWidth;
	}

	const whole = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
</script>

<section class="ui-card heatmap">
	<dl>
		<div><dt>{m.review.heatmap.streak}</dt><dd>{m.review.heatmap.days(stats.streak)}</dd></div>
		<div><dt>{m.review.heatmap.longest}</dt><dd>{m.review.heatmap.days(stats.longest)}</dd></div>
		<div><dt>{m.review.heatmap.average}</dt><dd>{m.review.heatmap.cards(whole(stats.average))}</dd></div>
		<div><dt>{m.review.heatmap.learned}</dt><dd>{Math.round(stats.share * 100)}%</dd></div>
	</dl>

	<div class="scroll" {@attach toToday}>
		<div class="plot" style:width="{LEFT + COLUMNS * STEP}px">
			<svg
				width={LEFT + COLUMNS * STEP}
				height={TOP + 7 * STEP}
				role="img"
				aria-label={m.review.heatmap.label(stats.total, stats.daysLearned)}
				{@attach hover}
			>
				{#each months as month (month.x)}
					<text class="axis" x={month.x} y={TOP - 7}>{month.name}</text>
				{/each}
				{#each dayNames as day (day.y)}
					<text class="axis" x="0" y={day.y}>{day.name}</text>
				{/each}
				{#each cells as cell, i (cell.n)}
					<rect
						class={cell.future ? 'due' : 'done'}
						class:today={cell.n === today}
						data-level={cell.level}
						data-i={i}
						x={cell.x}
						y={cell.y}
						width={SIZE}
						height={SIZE}
						rx="2.5"
					/>
				{/each}
			</svg>
			{#if tip}
				<span class="ui-tooltip tip" style:left="{tip.x}px" style:top="{tip.y}px">{tip.text}</span>
			{/if}
		</div>
	</div>

	<p class="legend">
		<span>{m.review.heatmap.less}</span>
		<svg width={(LEVELS + 1) * STEP} height={SIZE} aria-hidden="true">
			{#each { length: LEVELS + 1 } as _, level (level)}
				<rect class="done" data-level={level} x={level * STEP} y="0" width={SIZE} height={SIZE} rx="2.5" />
			{/each}
		</svg>
		<span>{m.review.heatmap.more}</span>
		<svg class="gap" width={SIZE} height={SIZE} aria-hidden="true">
			<rect class="due" data-level="3" x="0" y="0" width={SIZE} height={SIZE} rx="2.5" />
		</svg>
		<span>{m.review.heatmap.dueLegend}</span>
	</p>
</section>

<style>
	.heatmap {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}

	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: 0.75rem 1.5rem;
		margin: 0;
	}

	dt {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	dd {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.scroll {
		overflow-x: auto;
		/* Room for the tooltip over the top row */
		padding-top: 1.75rem;
		margin-top: -1.75rem;
	}

	.plot {
		position: relative;
		margin-inline: auto;
	}

	svg {
		display: block;
	}

	.axis {
		fill: var(--muted);
		font-size: 10px;
	}

	/* Reviews done: one hue, from the page's grey to the full accent */
	.done {
		fill: var(--surface-2);
	}

	.done[data-level='1'] {
		fill: color-mix(in oklab, var(--accent) 30%, var(--surface-2));
	}

	.done[data-level='2'] {
		fill: color-mix(in oklab, var(--accent) 52%, var(--surface-2));
	}

	.done[data-level='3'] {
		fill: color-mix(in oklab, var(--accent) 76%, var(--surface-2));
	}

	.done[data-level='4'] {
		fill: var(--accent);
	}

	/* Cards to come: grey, and an outline where nothing is due, so the days
	   ahead never read as days missed */
	.due {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
	}

	.due:not([data-level='0']) {
		stroke: none;
	}

	.due[data-level='1'] {
		fill: color-mix(in oklab, var(--muted) 22%, var(--surface-2));
	}

	.due[data-level='2'] {
		fill: color-mix(in oklab, var(--muted) 42%, var(--surface-2));
	}

	.due[data-level='3'] {
		fill: color-mix(in oklab, var(--muted) 64%, var(--surface-2));
	}

	.due[data-level='4'] {
		fill: color-mix(in oklab, var(--muted) 88%, var(--surface-2));
	}

	.today {
		stroke: var(--ink);
		stroke-width: 1.5;
	}

	.tip {
		position: absolute;
		z-index: 1;
		transform: translate(-50%, calc(-100% - 6px));
		white-space: nowrap;
		pointer-events: none;
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
		margin: 0;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.legend .gap {
		margin-left: 0.75rem;
	}
</style>
