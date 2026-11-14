<!-- Grammar practice: real sentences with a noun left out after a
     preposition, to be put in the case the preposition asks for (без цукру,
     на столі), and nouns to be put in the form a number asks for. A round is
     ten sentences (PracticeRound.svelte) over a few rules: those whose day
     has come, and up to two not met before.

     Each rule is scheduled as a flashcard is (FSRS, src/lib/review/fsrs.ts)
     and kept with the flashcards (review.svelte.ts), so an account holds it
     and a sentence answered counts towards the day's reviews and the streak.

     Before a round: a toolbar (how to answer, Weak spots, Start), then a row
     per lesson laid out as the Learn page's Grammar card lays them out
     (lessonRows in lessons.ts): its short name, the words it teaches, a bar
     of one segment per rule coloured by how well it is held, and a button
     for a round of that lesson. One lesson is open and shows its rules,
     each of which starts a round of that rule alone. The lesson open is the
     one last opened here or on /learn, or else the first not yet known. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import PracticeRound from '#lib/PracticeRound.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { LESSONS, lessonRows, openLesson, readOpenLesson, rememberOpenLesson } from '#lib/practice/lessons.ts';
	import { POINTS, cardKey, pointOf, type Point } from '#lib/practice/points.ts';
	import { stateOf, type PointState } from '#lib/practice/round.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	/** Ids of the rules that have sentences, in the order they are best met. */
	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]).map((point) => point.id));
	let met = $derived(offered.filter((id) => review.cards.has(cardKey(id))).length);
	/** When the lessons were last drawn: how well a rule is held depends on the day. */
	let now = $state(Date.now());

	const held = (point: Point): PointState =>
		review.ready ? stateOf(review.cards.get(cardKey(point.id)), now) : 'new';

	// How to answer is this browser's to remember, as the alphabet trainer's choices are
	const ANSWER_KEY = 'practice-answer';
	let byChoice = $state(true);
	/** The lesson last opened, here or on /learn. */
	let chosen = $state<string | null>(null);

	onMount(() => {
		void review.load();
		chosen = readOpenLesson();
		try {
			byChoice = localStorage.getItem(ANSWER_KEY) !== 'type';
		} catch {
			// Storage blocked: answers are chosen
		}
	});

	function setAnswer(value: string) {
		byChoice = value !== 'type';
		try {
			localStorage.setItem(ANSWER_KEY, byChoice ? 'choice' : 'type');
		} catch {
			// Storage blocked: the choice lasts until the page is closed
		}
	}

	// --- The lessons ---

	let lessons = $derived(lessonRows(offered, held));
	let open = $derived(openLesson(lessons, chosen));

	function choose(id: string) {
		chosen = id;
		rememberOpenLesson(id);
	}

	const takes = (point: Point) =>
		m.grammar.terms[point.case].name.toLocaleLowerCase(settings.lang)
		+ (point.number ? ` ${m.practice.ofNumber[point.number]}` : '');

	// --- A round ---

	/** The round being answered: of rules chosen, of the weak spots, or of whatever is due. */
	let round = $state.raw<{ only?: readonly string[]; weak?: boolean } | null>(null);

	// /practice?rule=<id> and ?lesson=<id>, where /learn's lessons lead: a
	// round of that rule or that lesson starts at once. Not before the cards
	// are read: a round grades from them, and an empty map would make every
	// rule new again. Once only: stopping must not start it over.
	let linked = $derived.by(() => {
		const rule = page.url.searchParams.get('rule');
		if (rule) return pointOf(rule) ? [rule] : null;
		const lesson = LESSONS.find((each) => each.id === page.url.searchParams.get('lesson'));
		return lesson ? lesson.points : null;
	});
	let begin = true;
	$effect(() => {
		if (!begin || !review.ready || !linked) return;
		begin = false;
		round = { only: linked };
	});

	function stop() {
		round = null;
		now = Date.now();
	}
</script>

<PageMeta title="{m.pageTitle.practice} · Nebokrai" description={m.meta.practice} />

<div class="ui-page page" class:in-round={round}>
	<h1 class="ui-title">{m.pageTitle.practice}</h1>

	{#if !offered.length}
		<p class="note">{m.practice.none}</p>
	{:else if round}
		<PracticeRound {offered} {...round} choice={byChoice} onstop={stop} />
	{:else}
		<section class="ui-card toolbar" aria-busy={!review.ready}>
			<div class="answer">
				<span class="label" id="practice-answer">{m.practice.answerLabel}</span>
				<RadioGroup.Root
					class="ui-segmented"
					orientation="horizontal"
					aria-labelledby="practice-answer"
					value={byChoice ? 'choice' : 'type'}
					onValueChange={setAnswer}
				>
					<RadioGroup.Item class="ui-segment" value="choice">
						<Icon name="list" size={16} />
						{m.practice.answer.choice}
					</RadioGroup.Item>
					<RadioGroup.Item class="ui-segment" value="type">
						<Icon name="keyboard" size={16} />
						{m.practice.answer.type}
					</RadioGroup.Item>
				</RadioGroup.Root>
			</div>
			<div class="go">
				{#if review.ready}<span class="muted met">{m.practice.met(met, offered.length)}</span>{/if}
				{#if met}
					<button type="button" class="ui-btn" title={m.practice.weakTitle} onclick={() => (round = { weak: true })}>
						<Icon name="target" size={16} />
						{m.practice.weak}
					</button>
				{/if}
				<button type="button" class="ui-btn ui-btn-primary" disabled={!review.ready} onclick={() => (round = {})}>
					<Icon name="play" size={16} filled />
					{m.practice.start}
				</button>
			</div>
		</section>

		<section class="ui-card rows" aria-label={m.learn.cases}>
			{#each lessons as lesson (lesson.id)}
				{@const isOpen = lesson.id === open?.id}
				{@const name = m.learn.short[lesson.id]}
				<div class="row" class:open={isOpen}>
					<div class="head">
						<button
							type="button"
							class="toggle"
							aria-expanded={isOpen}
							aria-controls="lesson-{lesson.id}"
							onclick={() => choose(lesson.id)}
						>
							<span class="chevron"><Icon name="chevron-right" size={16} /></span>
							<span class="n">{lesson.n}</span>
							<span class="names">
								<b>{name}</b>
								<small lang="uk">{lesson.cues.join(' · ')}</small>
							</span>
							<span class="segments" aria-hidden="true">
								{#each lesson.points as { point, state } (point.id)}<i data-state={state}></i>{/each}
							</span>
							{#if review.ready}
								<span class="muted count" aria-hidden="true">{m.practice.ofTotal(lesson.known, lesson.points.length)}</span>
								<span class="ui-sr-only">{m.learn.rulesKnown(lesson.known, lesson.points.length)}</span>
							{/if}
						</button>
						<button
							type="button"
							class="ui-btn small"
							aria-label={m.practice.practiseLesson(name)}
							title={m.practice.practiseLesson(name)}
							disabled={!review.ready}
							onclick={() => (round = { only: lesson.points.map(({ point }) => point.id) })}
						>
							<Icon name="play" size={14} filled />
							<span class="wide" aria-hidden="true">{m.learn.practise}</span>
						</button>
					</div>

					{#if isOpen}
						<div class="fold" id="lesson-{lesson.id}">
							<!-- Wide: the table, as on /learn -->
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
									{#each lesson.points as { point, state } (point.id)}
										<tr>
											<td class="cue" lang="uk">{point.cue}</td>
											<td>{takes(point)}</td>
											<td>{m.practice.meaning[point.id]}</td>
											<td class="example" lang="uk">{point.example}</td>
											<td><span class="state" data-state={state}><i></i>{m.learn.state[state]}</span></td>
											<td>
												<button
													type="button"
													class="practise"
													title={m.practice.only}
													disabled={!review.ready}
													onclick={() => (round = { only: [point.id] })}
												>
													{m.learn.practise} <Icon name="arrow-right" size={16} />
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>

							<!-- A phone: one line a rule, the whole line starting its round -->
							<ul class="list">
								{#each lesson.points as { point, state } (point.id)}
									<li>
										<button
											type="button"
											title={m.practice.only}
											disabled={!review.ready}
											onclick={() => (round = { only: [point.id] })}
										>
											<span class="cue" lang="uk">{point.cue}</span>
											<span class="mid">
												<span>{takes(point)}</span>
												<small>
													{m.practice.meaning[point.id]} · <b lang="uk">{point.example}</b>
												</small>
											</span>
											<span class="state" data-state={state}>
												<i></i><span class="ui-sr-only">{m.learn.state[state]}</span>
											</span>
											<Icon name="chevron-right" size={16} />
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/each}
		</section>

		<p class="kept">{m.practice.kept}</p>
	{/if}
</div>

<style>
	.page {
		display: grid;
		/* One column, never wider than the screen: something too wide inside it
		   wraps or shrinks instead of pushing the card past the edge */
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		max-width: var(--prose);
		padding-top: 1.75rem;
	}

	/* In a round, what goes on and what is chosen are in the flag's yellow, as
	   on the alphabet page (--flag in app.css); before one, Start is the
	   Learn page's blue */
	.page.in-round :global(.ui-btn.ui-btn-primary) {
		border-color: var(--flag-line);
		background: var(--flag);
		color: var(--flag-ink);
	}

	@media (hover: hover) {
		.page.in-round :global(.ui-btn.ui-btn-primary:hover:not(:disabled)) {
			border-color: var(--flag-line);
			background: color-mix(in srgb, var(--flag) 86%, var(--flag-ink));
		}
	}

	p,
	ul {
		margin: 0;
	}

	ul {
		padding: 0;
		list-style: none;
	}

	.note,
	.kept {
		color: var(--on-page);
	}

	.kept {
		font-size: var(--text-sm);
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* The colours of how well a rule is held, as on /learn (GrammarCard.svelte):
	   known in full, being learnt a tint of it, shaky amber, not begun an empty box */
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

	/* --- The toolbar: how to answer on the left, what to start on the right --- */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		padding: 0.75rem 1rem;
	}

	.answer,
	.go {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.label {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	/* --- A row per lesson --- */
	.rows {
		padding: 0.25rem 0;
		overflow: hidden;
	}

	.row + .row {
		border-top: 1px solid var(--border);
	}

	.row.open {
		background: color-mix(in srgb, var(--accent-soft) 45%, transparent);
	}

	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.6rem;
		padding-right: 1rem;
	}

	/* The row opens its lesson: chevron, number, names, bar and count */
	.toggle {
		display: grid;
		grid-template-columns: 1rem 1.2rem minmax(0, 1fr) 9rem 3.5rem;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0 0.7rem 1rem;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.chevron {
		display: flex;
		color: var(--muted);
		transition: transform var(--duration);
	}

	.open .chevron {
		transform: rotate(90deg);
	}

	.n {
		color: var(--muted);
		font-weight: 700;
	}

	.names {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}

	.names b {
		font-weight: 650;
	}

	.names small {
		/* In a column on a phone it would otherwise keep its full width and run under the bar */
		max-width: 100%;
		overflow: hidden;
		color: var(--muted);
		font-size: var(--text-sm);
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.segments {
		display: flex;
		gap: 3px;
	}

	.segments i {
		flex: 1;
		height: 0.4rem;
		border-radius: 2px;
		background: var(--state);
	}

	.segments [data-state='new'],
	.state[data-state='new'] i {
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}

	.count {
		text-align: right;
		white-space: nowrap;
	}

	.ui-btn.small {
		padding: 0.3rem 0.65rem;
	}

	/* --- The open lesson's rules --- */
	.fold {
		padding: 0 1rem 0.9rem 3.6rem;
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

	.cue {
		font-family: var(--font-headword);
		font-weight: 800;
		white-space: nowrap;
	}

	/* No frame round the table: rules between the rows only, as on /learn */
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

	td.cue {
		font-size: 1rem;
	}

	.example {
		font-weight: 600;
		white-space: nowrap;
	}

	.practise {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	.practise:disabled,
	.list button:disabled {
		cursor: default;
	}

	/* On a phone the list takes the table's place */
	.list {
		display: none;
	}

	.list button {
		display: grid;
		grid-template-columns: 4.6rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.6rem 0;
		border: 0;
		border-top: 1px solid var(--border);
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.list .cue {
		font-size: 1rem;
		white-space: normal;
	}

	.mid {
		display: grid;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.mid small {
		color: var(--muted);
		font-weight: 400;
	}

	.mid b {
		color: var(--ink);
		white-space: nowrap;
	}

	.list button > :global(svg) {
		color: var(--muted);
	}

	@media (hover: hover) {
		.toggle:hover b {
			color: var(--accent);
		}

		.practise:hover:not(:disabled) {
			color: var(--link-hover);
		}
	}

	/* A phone: the toolbar stacked, the rows without their count, the rules as a list */
	@media (max-width: 640px) {
		.page {
			gap: 0.8rem;
			padding-top: 1rem;
		}

		.toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 0.7rem;
			padding: 0.8rem;
		}

		.answer {
			justify-content: space-between;
		}

		.answer :global(.ui-segmented) {
			flex: 1;
		}

		.go {
			flex-wrap: wrap;
			gap: 0.6rem;
		}

		.met {
			flex-basis: 100%;
		}

		.go .ui-btn {
			flex: 1;
			justify-content: center;
		}

		.head {
			padding-right: 0.8rem;
		}

		.toggle {
			grid-template-columns: 1rem 1rem minmax(0, 1fr) 4.5rem;
			gap: 0.5rem;
			padding: 0.65rem 0 0.65rem 0.8rem;
		}

		.count,
		.wide {
			display: none;
		}

		.names {
			flex-direction: column;
			gap: 0;
		}

		.fold {
			padding: 0 0.8rem 0.6rem;
		}

		table {
			display: none;
		}

		.list {
			display: grid;
		}
	}
</style>
