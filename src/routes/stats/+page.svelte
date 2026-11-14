<!-- How many people use the site, for its owner only (+page.server.ts says
     who). The layout is "D", signed off in Figma on 2026-11-14 (file
     "Nebokrai design – Stats"): the day chart with its switch from C, and from
     C2 the "where people go" bar, the found / nothing bar and the side column
     (a 13-week calendar, the signed-in share, accounts as narrowing bars and
     the words not found). The top pages and searches are plain tables.

     Everything comes from src/lib/server/stats.ts and accountStats() in
     users.ts; nothing here is stored in the browser. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import PageMeta from '#lib/PageMeta.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import type { DayRow } from '#lib/server/stats.ts';
	import { useSettings } from '#lib/settings.ts';
	import { SECTION_NAMES } from '#lib/stats-sections.ts';

	let { data } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let s = $derived(m.stats);

	const number = $derived(new Intl.NumberFormat(settings.lang));
	const shortDate = $derived(new Intl.DateTimeFormat(settings.lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }));
	const dateOf = (day: string) => shortDate.format(new Date(`${day}T12:00:00Z`));
	const percent = (part: number, whole: number) => (whole ? Math.round((100 * part) / whole) : 0);

	type Measure = 'visitors' | 'views' | 'searches';
	let measure = $state<Measure>('visitors');
	const MEASURES: Measure[] = ['visitors', 'views', 'searches'];

	let report = $derived(data.report);
	let days = $derived(report?.days ?? []);
	let highest = $derived(Math.max(1, ...days.map((d) => d[measure])));
	let views = $derived(days.reduce((sum, d) => sum + d.views, 0));
	let visitorDays = $derived(days.reduce((sum, d) => sum + d.visitors, 0));
	let signedIn = $derived(days.reduce((sum, d) => sum + d.signed_in_visitors, 0));
	let searches = $derived(days.reduce((sum, d) => sum + d.searches, 0));
	let empty = $derived(days.reduce((sum, d) => sum + d.empty_searches, 0));
	let best = $derived(days.reduce<DayRow | null>((top, d) => (!top || d.visitors > top.visitors ? d : top), null));

	let sectionTotal = $derived(report ? SECTION_NAMES.reduce((sum, name) => sum + report.sections[name], 0) : 0);

	// The calendar: one column a week, Monday at the top. Its shade is a
	// fifth of the busiest day per step, and none for a day without visitors.
	let busiest = $derived(Math.max(1, ...(report?.calendar ?? []).map((d) => d.visitors)));
	const level = (visitors: number) => (visitors ? Math.ceil((4 * visitors) / busiest) : 0);

	let funnel = $derived(
		data.accounts
			? (['users', 'withSavedWords', 'reviewed30', 'reviewed7'] as const).map((key) => ({
					key,
					count: data.accounts![key]
				}))
			: []
	);
</script>

<PageMeta title="{m.pageTitle.stats} · Nebokrai" description={m.meta.stats} />

<div class="ui-page page">
	<h1 class="ui-title">{m.pageTitle.stats}</h1>

	{#if !report}
		<p class="note">{s.off}</p>
	{:else}
		<div class="columns">
			<div class="main">
				<div class="controls">
					<RadioGroup.Root
						class="ui-segmented"
						orientation="horizontal"
						aria-label={s.measure}
						value={measure}
						onValueChange={(value) => (measure = value as Measure)}
					>
						{#each MEASURES as name (name)}
							<RadioGroup.Item class="ui-segment" value={name}>{s[name]}</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
					<nav class="ranges" aria-label={s.days(data.days)}>
						{#each data.ranges as range (range)}
							<a href="?days={range}" aria-current={range === data.days ? 'page' : undefined}>{s.days(range)}</a>
						{/each}
					</nav>
				</div>

				<div class="chart" role="img" aria-label={s.chart(s[measure], data.days)}>
					{#each days as day (day.day)}
						<div class="column" title="{dateOf(day.day)}: {number.format(day[measure])}">
							<div class="bar" style:height="{(100 * day[measure]) / highest}%"></div>
						</div>
					{/each}
				</div>
				{#if days.length}
					<div class="axis" aria-hidden="true">
						<span>{dateOf(days[0].day)}</span>
						<span>{dateOf(days[Math.floor(days.length / 2)].day)}</span>
						<span>{dateOf(days[days.length - 1].day)}</span>
					</div>
				{/if}
				{#if best?.visitors}
					<p class="summary">
						{s.summary(
							data.days,
							number.format(views),
							number.format(Math.round(visitorDays / Math.max(1, days.length))),
							dateOf(best.day),
							number.format(best.visitors)
						)}
					</p>
				{/if}

				<div class="pair">
					<section aria-labelledby="stats-where">
						<h2 id="stats-where">{s.whereGo}</h2>
						<div class="split" aria-hidden="true">
							{#each SECTION_NAMES as name (name)}
								{#if report.sections[name]}
									<div class="part {name}" style:flex-grow={report.sections[name]}></div>
								{/if}
							{/each}
						</div>
						<ul class="key">
							{#each SECTION_NAMES as name (name)}
								<li>
									<span class="swatch {name}" aria-hidden="true"></span>
									{s.sections[name]} {percent(report.sections[name], sectionTotal)}%
								</li>
							{/each}
						</ul>
						{#if report.pages.length}
							<table>
								<thead><tr><th>{s.page}</th><th class="n">{s.views}</th></tr></thead>
								<tbody>
									{#each report.pages.slice(0, 8) as row (row.key)}
										<tr>
											<td>
												{#if row.key.startsWith('/')}<a href={row.key}>{decodeURIComponent(row.key)}</a>
												{:else}{row.key}{/if}
											</td>
											<td class="n">{number.format(row.count)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{:else}
							<p class="note">{s.none}</p>
						{/if}
					</section>

					<section aria-labelledby="stats-searches">
						<h2 id="stats-searches">{s.searches}</h2>
						<div class="split" aria-hidden="true">
							{#if searches - empty}<div class="part found" style:flex-grow={searches - empty}></div>{/if}
							{#if empty}<div class="part nothing" style:flex-grow={empty}></div>{/if}
						</div>
						<div class="ends">
							<span>{s.found} {percent(searches - empty, searches)}%</span>
							<span>{s.nothing} {percent(empty, searches)}%</span>
						</div>
						{#if report.searches.length}
							<table>
								<thead><tr><th>{s.search}</th><th class="n">{s.times}</th></tr></thead>
								<tbody>
									{#each report.searches.slice(0, 8) as row (row.key)}
										<tr>
											<td><a href="/?q={encodeURIComponent(row.key)}" lang="uk">{row.key}</a></td>
											<td class="n">{number.format(row.count)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{:else}
							<p class="note">{s.none}</p>
						{/if}
					</section>
				</div>
			</div>

			<aside>
				<section aria-labelledby="stats-weeks">
					<h2 id="stats-weeks">{s.weeks(13)}</h2>
					<div class="calendar">
						{#each report.calendar as day (day.day)}
							<span
								class="cell level-{level(day.visitors)}"
								title={s.dayVisitors(dateOf(day.day), number.format(day.visitors))}
							></span>
						{/each}
					</div>
					<div class="scale" aria-hidden="true">
						<span>{s.fewer}</span>
						{#each [0, 1, 2, 3, 4] as l (l)}<span class="cell level-{l}"></span>{/each}
						<span>{s.more}</span>
					</div>
				</section>

				<section aria-labelledby="stats-accounts">
					<h2 id="stats-accounts">{s.accounts}</h2>
					<p class="share"><b>{percent(signedIn, visitorDays)}%</b> {s.signedIn}</p>
					<div class="split thin" aria-hidden="true">
						{#if signedIn}<div class="part signed" style:flex-grow={signedIn}></div>{/if}
						<div class="part rest" style:flex-grow={Math.max(1, visitorDays - signedIn)}></div>
					</div>
					{#if data.accounts}
						<ul class="funnel">
							{#each funnel as step (step.key)}
								<li>
									<span>{s.funnel[step.key]}</span>
									<b>{number.format(step.count)}</b>
									<span class="track" aria-hidden="true">
										<span class="fill" style:width="{percent(step.count, data.accounts.users)}%"></span>
									</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="note">{s.noAccounts}</p>
					{/if}
				</section>

				<section aria-labelledby="stats-missing">
					<h2 id="stats-missing">{s.notFound}</h2>
					<p class="note">{s.notFoundNote}</p>
					{#if report.missing.length}
						<ul class="chips">
							{#each report.missing as row (row.key)}
								<li>
									<a class="ui-chip" href="/?q={encodeURIComponent(row.key)}" lang="uk">
										{row.key}&nbsp;<span class="count">{number.format(row.count)}</span>
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="note">{s.none}</p>
					{/if}
				</section>
			</aside>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-wide);
		padding-block: var(--gap-block) var(--gap-section);
	}

	h2 {
		margin: 0 0 var(--gap-stack);
		font-family: var(--font-heading);
		font-size: var(--text-xl);
	}

	.note {
		margin: 0 0 var(--gap-stack);
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19rem;
		gap: var(--gap-section);
		margin-top: var(--gap-block);
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: var(--gap-block);
		padding-left: var(--gap-block);
		border-left: 1px solid var(--border);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-stack) var(--gap-stack);
		margin-bottom: var(--gap-stack);
	}

	.ranges {
		display: flex;
		gap: var(--gap-stack);
		font-size: var(--text-sm);
	}

	.ranges a {
		color: var(--muted);
		text-decoration: none;
	}

	.ranges a[aria-current='page'] {
		color: var(--ink);
		font-weight: 700;
	}

	/* The day chart */
	.chart {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 12.5rem;
	}

	.column {
		display: flex;
		flex: 1;
		align-items: flex-end;
		height: 100%;
	}

	.bar {
		width: 100%;
		/* a day without visits still shows where it stands */
		min-height: 2px;
		border-radius: calc(var(--radius-sm) / 2) calc(var(--radius-sm) / 2) 0 0;
		background: var(--accent);
	}

	.axis,
	.ends {
		display: flex;
		justify-content: space-between;
		margin-top: var(--gap-inline);
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.ends {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.summary {
		margin: var(--gap-stack) 0 0;
		color: var(--ink-2);
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-block);
		margin-top: var(--gap-section);
	}

	/* A bar split into parts: where people go, found or not, signed in or not */
	.split {
		display: flex;
		gap: 2px;
		height: 14px;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
	}

	.split.thin {
		height: 10px;
	}

	.part {
		flex-basis: 0;
	}

	.words,
	.found {
		background: var(--accent);
	}
	.search {
		background: color-mix(in srgb, var(--accent) 55%, var(--surface));
	}
	.learn,
	.nothing,
	.signed {
		background: var(--gold);
	}
	.saved {
		background: var(--pill-3-line);
	}
	.other {
		background: var(--pill-4-line);
	}
	.rest {
		background: var(--surface-2);
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-tight) var(--gap-stack);
		margin: var(--gap-stack) 0 0;
		padding: 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
		list-style: none;
	}

	.swatch {
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: var(--gap-tight);
		border-radius: calc(var(--radius-sm) / 3);
	}

	table {
		width: 100%;
		margin-top: var(--gap-block);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	th {
		padding: var(--gap-tight) 0;
		border-bottom: 1px solid var(--border);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		text-align: left;
	}

	td {
		padding: var(--gap-inline) 0;
		border-bottom: 1px solid var(--surface-2);
		overflow-wrap: anywhere;
	}

	.n {
		padding-left: var(--gap-stack);
		text-align: right;
	}

	td a {
		color: inherit;
		text-decoration: none;
	}

	@media (hover: hover) {
		td a:hover {
			color: var(--link-hover);
			text-decoration: underline;
		}
	}

	/* The 13-week calendar */
	.calendar {
		display: grid;
		grid-template-rows: repeat(7, 14px);
		grid-auto-flow: column;
		grid-auto-columns: 14px;
		gap: 3px;
	}

	.cell {
		display: block;
		width: 14px;
		height: 14px;
		border-radius: calc(var(--radius-sm) / 2);
	}

	.level-0 {
		background: var(--surface-2);
	}
	.level-1 {
		background: color-mix(in srgb, var(--accent) 20%, var(--surface-2));
	}
	.level-2 {
		background: color-mix(in srgb, var(--accent) 40%, var(--surface-2));
	}
	.level-3 {
		background: color-mix(in srgb, var(--accent) 70%, var(--surface-2));
	}
	.level-4 {
		background: var(--accent);
	}

	.scale {
		display: flex;
		align-items: center;
		gap: var(--gap-tight);
		margin-top: var(--gap-inline);
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.scale .cell {
		width: 11px;
		height: 11px;
	}

	.share {
		margin: 0 0 var(--gap-inline);
		color: var(--ink-2);
	}

	.share b {
		color: var(--ink);
		font-size: var(--text-xl);
	}

	.funnel {
		margin: var(--gap-block) 0 0;
		padding: 0;
		list-style: none;
	}

	.funnel li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--gap-tight) var(--gap-inline);
		margin-bottom: var(--gap-stack);
	}

	.track {
		grid-column: 1 / -1;
		height: 10px;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: var(--radius-pill);
		background: var(--accent);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-inline);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.count {
		color: var(--muted);
	}

	@media (max-width: 860px) {
		.columns {
			grid-template-columns: minmax(0, 1fr);
		}

		aside {
			padding-left: 0;
			padding-top: var(--gap-block);
			border-left: 0;
			border-top: 1px solid var(--border);
		}
	}

	@media (max-width: 600px) {
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}

		.chart {
			gap: 1px;
			height: 9rem;
		}
	}
</style>
