<!-- The grammar on /learn: the lessons (lessons.ts) as a list, each by a
     short name, the words it teaches and a bar of one segment per rule,
     coloured by how well the rule is held (stateOf in round.ts); beside the
     list, the open lesson's rules as a table. The lesson open at first is
     the first not yet known; a click opens another, and nothing of it is
     kept. "Practise this" and each rule's "Practise" start a round on
     /practice (?lesson=, ?rule=). -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { LESSONS } from '#lib/practice/lessons.ts';
	import { cardKey, pointOf, type Point } from '#lib/practice/points.ts';
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

	// What a number's rule is about, in the list: the numbers themselves
	const NUMBER_CUE: Record<string, string> = { 'one-nom': '1', 'few-nom': '2–4', 'many-gen': '5+' };

	let lessons = $derived(
		LESSONS.map((lesson, i) => {
			const points = lesson.points
				.filter((id) => offered.includes(id))
				.map(pointOf)
				.filter((point): point is Point => point !== undefined)
				.map((point) => ({ point, state: held(point) }));
			// The words it teaches, each once: у · на, з · від (the first spelling of у / в)
			const cues = [...new Set(points.map(({ point }) => NUMBER_CUE[point.id] ?? point.cue.split(' / ')[0]))];
			const known = points.filter(({ state }) => state === 'known').length;
			return { id: lesson.id, n: i + 1, points, cues, known };
		}).filter((lesson) => lesson.points.length)
	);

	let chosen = $state<string | null>(null);
	let open = $derived(
		lessons.find((lesson) => lesson.id === chosen)
			?? lessons.find((lesson) => lesson.known < lesson.points.length)
			?? lessons[0]
	);

	const takes = (point: Point) =>
		m.grammar.terms[point.case].name.toLocaleLowerCase(settings.lang)
		+ (point.number ? ` ${m.practice.ofNumber[point.number]}` : '');
</script>

<section class="part" aria-labelledby="learn-grammar">
	<h2 id="learn-grammar">{m.learn.grammar}</h2>
	{#if open}
		<div class="ui-card card">
			<div class="lessons">
				<h3 class="group" id="learn-cases">{m.learn.cases}</h3>
				<ul aria-labelledby="learn-cases">
					{#each lessons as lesson (lesson.id)}
						<li>
							<button
								type="button"
								class="lesson"
								class:open={lesson.id === open.id}
								aria-pressed={lesson.id === open.id}
								onclick={() => (chosen = lesson.id)}
							>
								<span class="n">{lesson.n}</span>
								<b>{m.learn.short[lesson.id]}</b>
								<small lang="uk">{lesson.cues.join(' · ')}</small>
								<span class="segments" aria-hidden="true">
									{#each lesson.points as { point, state } (point.id)}<i data-state={state}></i>{/each}
								</span>
								<span class="ui-sr-only">{m.learn.rulesKnown(lesson.known, lesson.points.length)}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>

			<div class="body">
				<div class="title">
					<div>
						<h3>{open.n} · {m.learn.short[open.id]}</h3>
						<span class="muted">{ready ? m.learn.rulesKnown(open.known, open.points.length) : ''}</span>
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
								<th>{m.learn.column.after}</th>
								<th>{m.learn.column.takes}</th>
								<th>{m.learn.column.means}</th>
								<th>{m.learn.column.example}</th>
								<th>{m.learn.column.state}</th>
								<th><span class="ui-sr-only">{m.learn.practise}</span></th>
							</tr>
						</thead>
						<tbody>
							{#each open.points as { point, state } (point.id)}
								<tr>
									<td class="cue" lang="uk">{point.cue}</td>
									<td>{takes(point)}</td>
									<td>{m.practice.meaning[point.id]}</td>
									<td class="example" lang="uk">{point.example}</td>
									<td><span class="state" data-state={state}><i></i>{m.learn.state[state]}</span></td>
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
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
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

		.body {
			padding: 0.9rem 0.9rem 1rem;
		}

		.title {
			flex-wrap: wrap;
		}
	}
</style>
