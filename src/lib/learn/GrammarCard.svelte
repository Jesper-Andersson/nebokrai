<!-- The grammar on /learn: the lessons (lessons.ts) as a list, each by a
     short name, the words it teaches and a bar of one segment per rule,
     coloured by how well the rule is held (stateOf in round.ts); beside the
     list, the open lesson's rules as a table. The lesson open at first is
     the one last opened here or on /practice, or else the first not yet
     known (openLesson in lessons.ts); a click opens another. "Practise this"
     and each rule's "Practise" start a round on /practice (?lesson=, ?rule=). -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { lessonRows, openLesson, readOpenLesson, rememberOpenLesson } from '#lib/practice/lessons.ts';
	import { cardKey, meaningOfPoint, ruleOf, type Point } from '#lib/practice/points.ts';
	import { stateOf, type PointState } from '#lib/practice/round.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		offered,
		now,
		ready
	}: {
		/** Ids of the rules that have sentences: a rule without is never asked, and not shown. */
		offered: readonly string[];
		now: number;
		ready: boolean;
	} = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	const held = (point: Point): PointState => (ready ? stateOf(review.cards.get(cardKey(point.id)), now) : 'new');

	let lessons = $derived(lessonRows(offered, held, review.placedLessons));
	/** The two lists, each under its heading: the cases after prepositions, and the verbs' patterns. */
	let groups = $derived(
		[
			{ id: 'learn-cases', label: m.learn.cases, rows: lessons.filter((lesson) => lesson.group === 'preposition') },
			{ id: 'learn-verbs', label: m.learn.verbPatterns, rows: lessons.filter((lesson) => lesson.group === 'government') }
		].filter((group) => group.rows.length)
	);

	let chosen = $state<string | null>(null);
	let open = $derived(openLesson(lessons, chosen));
	// On a phone the lessons are a row that scrolls sideways: a lesson opened
	// on an earlier visit may be off its right end, so the row is brought to
	// it once. Only the row moves, never the page.
	let rows = $state<HTMLUListElement[]>([]);
	onMount(async () => {
		chosen = readOpenLesson();
		await tick();
		for (const row of rows) {
			const item = row?.querySelector<HTMLElement>('.lesson.open')?.parentElement;
			if (item) centre(row, item, 'auto');
		}
		measure();
	});

	// Which way the row can still go: an arrow stands at each such end. A
	// swipe alone was not to be guessed at, and a mouse in a narrow window
	// could not do it at all (user, 2026-11-16). Where the lessons are a
	// list, at full width, nothing overflows and there are no arrows.
	// Each list's row is measured apart, by its place in `groups`
	let canBack = $state<boolean[]>([]);
	let canMore = $state<boolean[]>([]);
	function measure() {
		rows.forEach((row, i) => {
			if (!row) return;
			canBack[i] = row.scrollLeft > 4;
			canMore[i] = row.scrollLeft + row.clientWidth < row.scrollWidth - 4;
		});
	}
	const nudge = (i: number, way: 1 | -1) =>
		rows[i]?.scrollBy({ left: way * rows[i].clientWidth * 0.8, behavior: 'smooth' });

	function choose(id: string, button: HTMLElement) {
		chosen = id;
		rememberOpenLesson(id);
		const row = button.closest('ul');
		if (row && button.parentElement) centre(row, button.parentElement, 'smooth');
	}

	// A lesson pressed comes to the middle of the row, which brings the next
	// one into reach: pressing lesson after lesson walks to the end of the
	// row with no swipe (user, 2026-11-16).
	function centre(row: HTMLElement, item: HTMLElement, behavior: ScrollBehavior) {
		row.scrollTo({ left: item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2, behavior });
	}

	const meaning = (point: Point) => meaningOfPoint(m.practice.meaning, point, settings.lang);

	const takes = (point: Point) =>
		m.grammar.terms[point.case].name.toLocaleLowerCase(settings.lang)
		+ (point.number ? ` ${m.practice.ofNumber[point.number]}` : '');
</script>

<svelte:window onresize={measure} />

<section class="part" aria-labelledby="learn-grammar">
	<h2 id="learn-grammar">{m.learn.grammar}</h2>
	{#if open}
		<div class="ui-card card">
			<div class="lessons">
				{#each groups as group, g (group.id)}
				<div class="set">
				<h3 class="group" id={group.id}>{group.label}</h3>
				<div class="row" class:more={canMore[g]}>
				<ul aria-labelledby={group.id} bind:this={rows[g]} onscroll={measure}>
					{#each group.rows as lesson (lesson.id)}
						<li>
							<button
								type="button"
								class="lesson"
								class:open={lesson.id === open.id}
								aria-pressed={lesson.id === open.id}
								onclick={(event) => choose(lesson.id, event.currentTarget)}
							>
								<span class="n">{lesson.n}</span>
								<b>{m.learn.short[lesson.id]}</b>
								<small lang="uk">{lesson.cues.join(' · ')}</small>
								<span class="segments" aria-hidden="true">
									{#each lesson.points as { point, state } (point.id)}<i data-state={state}></i>{/each}
								</span>
								<span class="ui-sr-only">{m.learn.rulesKnown(lesson.known, lesson.points.length)}</span>
								{#if lesson.placed}<span class="ui-sr-only">({m.path.knownFromTest})</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
				{#if canBack[g] || canMore[g]}
					<!-- Beside the heading, clear of the lessons themselves -->
					<span class="nudges">
						<button type="button" class="ui-icon-btn" disabled={!canBack[g]} aria-label={m.learn.lessonsBack} title={m.learn.lessonsBack} onclick={() => nudge(g, -1)}>
							<Icon name="arrow-left" size={18} />
						</button>
						<button type="button" class="ui-icon-btn" disabled={!canMore[g]} aria-label={m.learn.lessonsMore} title={m.learn.lessonsMore} onclick={() => nudge(g, 1)}>
							<Icon name="arrow-right" size={18} />
						</button>
					</span>
				{/if}
				</div>
				</div>
				{/each}
				</div>

				<div class="body">
				<div class="title">
					<div>
						<h3>{open.n} · {m.learn.short[open.id]}</h3>
						<span class="muted">
							{ready ? m.learn.rulesKnown(open.known, open.points.length) : ''}
							{#if ready && open.placed}· <span class="placed">{m.path.knownFromTest}</span>{/if}
						</span>
					</div>
					<a class="ui-btn ui-btn-primary" href="/practice?lesson={open.id}">
						{m.learn.practiseThis} <Icon name="arrow-right" size={16} />
					</a>
				</div>
				<!-- Wide: a phone scrolls the table, not the page -->
				<div class="scroll">
					<table>
						<thead>
							<tr>
								<th>{open.group === 'government' ? m.learn.column.verb : m.learn.column.after}</th>
								<th>{m.learn.column.takes}</th>
								<th>{m.learn.column.means}</th>
								<th>{m.learn.column.example}</th>
								<th>{m.learn.column.state}</th>
								<!-- Named for a screen reader by a label, not by hidden words: those
							     are set out of the flow and stood a pixel past the table's
							     right edge, which gave the table a scroll bar it had no use for -->
							<th aria-label={m.learn.practise}></th>
							</tr>
						</thead>
						<tbody>
							{#each open.points as { point, state } (point.id)}
								<tr>
									<td class="cue" lang="uk">{ruleOf(point)}</td>
									<td>{takes(point)}</td>
									<td>{meaning(point)}</td>
									<td class="example" lang="uk">{point.example}</td>
									<td>
										<!-- Not begun: the empty box alone says so, and the words
										     are left to a screen reader and the pointer. Written
										     out five times down a lesson (until 2026-11-16) they
										     pushed the Practise links off a phone's screen. -->
										<span class="state" data-state={state} title={state === 'new' ? m.learn.state[state] : undefined}>
											<i></i>
											{#if state === 'new'}<span class="ui-sr-only">{m.learn.state[state]}</span>{:else}{m.learn.state[state]}{/if}
										</span>
									</td>
									<td>
										<a class="practise" href="/practice?rule={point.id}">
											{m.learn.practise} <Icon name="arrow-right" size={16} />
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.part {
		display: grid;
		gap: 0.6rem;
	}

	h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.15;
	}

	/* The colours of how well a rule is held, in grammar's green: known in
	   full, being learnt a tint of it, shaky amber, not begun an empty box */
	[data-state='known'] {
		--state: var(--pill-1-line);
	}

	[data-state='learning'] {
		--state: color-mix(in srgb, var(--pill-1-line) 45%, var(--surface));
	}

	[data-state='weak'] {
		--state: var(--pill-3-line);
	}

	[data-state='new'] {
		--state: var(--surface-2);
	}

	/* The list beside the open lesson */
	.card {
		display: grid;
		grid-template-columns: 17rem minmax(0, 1fr);
		padding: 0;
		overflow: hidden;
	}

	.lessons {
		padding: 0.5rem;
		border-right: 1px solid var(--border);
	}

	.group {
		margin: 0;
		padding: 0.35rem 0.6rem 0.25rem;
		color: var(--ink-2);
		font-family: var(--font-heading);
		font-size: var(--text-md);
		font-weight: 700;
	}

	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.lesson {
		display: grid;
		grid-template-columns: 1.4rem minmax(0, 1fr);
		gap: 0.15rem 0.4rem;
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.lesson.open {
		background: var(--accent-soft);
	}

	.n {
		color: var(--muted);
		font-weight: 700;
	}

	.lesson b {
		font-weight: 600;
		line-height: 1.25;
	}

	.lesson.open b {
		font-weight: 700;
	}

	.lesson small {
		grid-column: 2;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.segments {
		display: flex;
		grid-column: 2;
		gap: 3px;
		margin-top: 0.2rem;
	}

	.segments i {
		flex: 1;
		height: 0.4rem;
		border-radius: 2px;
		background: var(--state);
	}

	.segments [data-state='new'] {
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}

	/* The open lesson */
	.body {
		display: grid;
		/* One column no wider than the card, so the table scrolls inside it */
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 1rem;
		min-width: 0;
		padding: 1rem 1.25rem;
	}

	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.title h3 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.3rem;
		font-weight: 700;
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* A lesson the placement test placed out (lessons.ts, placed) */
	.placed {
		color: var(--right);
	}

	.title .ui-btn {
		flex: none;
	}

	/* Positioned, so that the hidden column name (ui-sr-only, absolute) is
	   held inside it and does not widen the page */
	.scroll {
		position: relative;
		overflow-x: auto;
	}

	/* No frame round the table: rules between the rows only */
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th {
		padding: 0 0.75rem 0.4rem 0;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
	}

	td {
		padding: 0.5rem 0.75rem 0.5rem 0;
		border-top: 1px solid var(--border);
		vertical-align: middle;
	}

	td:last-child,
	th:last-child {
		padding-right: 0;
		text-align: right;
	}

	.cue {
		font-family: var(--font-headword);
		font-size: 1rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.example {
		font-family: var(--font-headword);
		font-weight: 600;
		white-space: nowrap;
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.state i {
		flex: none;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 2px;
		background: var(--state);
	}

	.state[data-state='new'] i {
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}

	.practise {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	@media (hover: hover) {
		.lesson:not(.open):hover {
			background: var(--surface-2);
		}

		.practise:hover {
			color: var(--link-hover);
		}
	}

	/* A phone: the list over the open lesson */
	@media (max-width: 640px) {
		.card {
			grid-template-columns: minmax(0, 1fr);
		}

		.lessons {
			border-right: 0;
			border-bottom: 1px solid var(--border);
		}

		/* The eight lessons in a row that scrolls sideways, so that the open
		   one is right under them: listed one under another (until
		   2026-11-16) they pushed it two screens down. The row fades at its
		   right end, where more of it waits. */
		ul {
			/* Positioned, so that the row also clips what is set out of the flow
			   in a lesson scrolled off its end (the words for a screen reader):
			   otherwise those widen the whole page */
			position: relative;
			display: flex;
			gap: 0.25rem;
			overflow-x: auto;
			scroll-snap-type: x proximity;
			scrollbar-width: none;
		}

		/* More to the right: the row fades out at that end */
		.more ul {
			mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
		}

		/* The two arrows stand at the right of their list's heading */
		.set {
			position: relative;
		}

		.nudges {
			position: absolute;
			top: 0.3rem;
			right: 0.5rem;
			display: flex;
			gap: 0.25rem;
		}

		/* The heading's line is as tall as the arrows beside it */
		.group {
			display: flex;
			align-items: center;
			min-height: 2.1rem;
		}

		.nudges button {
			width: 2rem;
			height: 2rem;
			border: 1px solid var(--border-strong);
		}

		.nudges button:disabled {
			border-color: var(--border);
			color: var(--muted);
			opacity: 0.5;
			cursor: default;
		}

		li {
			flex: none;
			width: 9.5rem;
			/* The middle, where a lesson pressed is brought to */
			scroll-snap-align: center;
		}

		.lesson {
			height: 100%;
			align-content: start;
		}

		/* The prepositions on one line, cut off at its end */
		.lesson small {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.body {
			padding: 0.9rem 0.9rem 1rem;
		}

		.title {
			flex-wrap: wrap;
		}
	}
</style>
