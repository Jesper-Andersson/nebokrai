<!-- Grammar practice: real sentences with a noun left out after a
     preposition, to be put in the case the preposition asks for (без цукру,
     на столі), and nouns to be put in the form a number asks for. A round is
     ten sentences (PracticeRound.svelte) over a few rules: those whose day
     has come, and up to two not met before.

     Each rule is scheduled as a flashcard is (FSRS, src/lib/review/fsrs.ts)
     and kept with the flashcards (review.svelte.ts), so an account holds it
     and a sentence answered counts towards the day's reviews and the streak.

     Before a round the rules are laid out in lessons (lessons.ts), in the
     order they are best met: a tile for each rule (PracticeTile.svelte),
     marked by how well it is held (stateOf in round.ts). A tile starts a
     round of its rule alone, and "Weak spots" a round of the rules held
     least well. The rules can be searched, and those known put out of
     sight. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import PageMeta from '#lib/PageMeta.svelte';
	import PracticeRound from '#lib/PracticeRound.svelte';
	import PracticeTile from '#lib/PracticeTile.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { LESSONS } from '#lib/practice/lessons.ts';
	import { POINTS, cardKey, pointOf, type Point } from '#lib/practice/points.ts';
	import { stateOf, type PointState } from '#lib/practice/round.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { plain } from '#lib/search/normalize.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	/** The rules that have sentences, in the order they are best met. */
	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]));
	let met = $derived(offered.filter((point) => review.cards.has(cardKey(point.id))).length);
	/** When the map was last drawn: how well a rule is held depends on the day. */
	let now = $state(Date.now());

	const held = (point: Point): PointState =>
		review.ready ? stateOf(review.cards.get(cardKey(point.id)), now) : 'new';

	// How to answer and what to hide are this browser's to remember, as the alphabet trainer's choices are
	const ANSWER_KEY = 'practice-answer';
	const HIDE_KEY = 'practice-hide-known';
	let byChoice = $state(true);
	let hideKnown = $state(false);

	onMount(() => {
		void review.load();
		try {
			byChoice = localStorage.getItem(ANSWER_KEY) !== 'type';
			hideKnown = localStorage.getItem(HIDE_KEY) === 'yes';
		} catch {
			// Storage blocked: answers are chosen, and every rule is shown
		}
	});

	function remember(key: string, value: string) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Storage blocked: the choice lasts until the page is closed
		}
	}

	function setAnswer(value: string) {
		byChoice = value !== 'type';
		remember(ANSWER_KEY, byChoice ? 'choice' : 'type');
	}

	function toggleKnown() {
		hideKnown = !hideKnown;
		remember(HIDE_KEY, hideKnown ? 'yes' : 'no');
	}

	// --- The lessons ---

	let query = $state('');

	/**
	 * Each lesson with its rules that have sentences, and those of them to
	 * show: a search looks in the preposition, the case, what the rule says
	 * and the lesson's title (без, genitive, without).
	 */
	let lessons = $derived.by(() => {
		const wanted = plain(query.trim());
		return LESSONS.map((lesson, i) => {
			const title = m.practice.lessons[lesson.id];
			const points = lesson.points
				.map(pointOf)
				.filter((point): point is Point => point !== undefined && offered.includes(point));
			const shown = points.filter((point) => {
				if (hideKnown && held(point) === 'known') return false;
				if (!wanted) return true;
				const text = [point.cue, m.grammar.terms[point.case].name, m.practice.meaning[point.id], title].join(' ');
				return plain(text).includes(wanted);
			});
			const known = points.filter((point) => held(point) === 'known').length;
			return { id: lesson.id, n: i + 1, title, points, shown, known };
		}).filter((lesson) => lesson.points.length);
	});
	let anyShown = $derived(lessons.some((lesson) => lesson.shown.length));

	// --- A round ---

	/** The round being answered: of rules chosen, of the weak spots, or of whatever is due. */
	let round = $state.raw<{ only?: readonly string[]; weak?: boolean } | null>(null);

	// /practice?rule=<id> and ?lesson=<id>, where /learn's lessons lead: a
	// round of that rule or that lesson starts at once. Not before the cards
	// are read: a round grades from them, and an empty map would make every
	// rule new again. Once only: stopping must not start it over.
	let chosen = $derived.by(() => {
		const rule = page.url.searchParams.get('rule');
		if (rule) return pointOf(rule) ? [rule] : null;
		const lesson = LESSONS.find((each) => each.id === page.url.searchParams.get('lesson'));
		return lesson ? lesson.points : null;
	});
	let begin = true;
	$effect(() => {
		if (!begin || !review.ready || !chosen) return;
		begin = false;
		round = { only: chosen };
	});

	function stop() {
		round = null;
		now = Date.now();
	}
</script>

<PageMeta title="{m.pageTitle.practice} · Nebokrai" description={m.meta.practice} />

<div class="ui-page page">
	<h1 class="ui-title">{m.pageTitle.practice}</h1>

	{#if !offered.length}
		<p class="lead">{m.practice.none}</p>
	{:else if round}
		<PracticeRound offered={offered.map((point) => point.id)} {...round} choice={byChoice} onstop={stop} />
	{:else}
		<p class="lead">{m.practice.lead}</p>

		<section class="ui-card setup" aria-busy={!review.ready}>
			<div class="choice">
				<h2 class="name" id="practice-answer">{m.practice.answerLabel}</h2>
				<RadioGroup.Root
					class="ui-segmented"
					orientation="horizontal"
					aria-labelledby="practice-answer"
					value={byChoice ? 'choice' : 'type'}
					onValueChange={setAnswer}
				>
					<RadioGroup.Item class="ui-segment" value="choice">{m.practice.answer.choice}</RadioGroup.Item>
					<RadioGroup.Item class="ui-segment" value="type">{m.practice.answer.type}</RadioGroup.Item>
				</RadioGroup.Root>
			</div>
			<div class="go">
				{#if review.ready}<span class="muted">{m.practice.met(met, offered.length)}</span>{/if}
				{#if met}
					<button type="button" class="ui-btn" title={m.practice.weakTitle} onclick={() => (round = { weak: true })}>
						{m.practice.weak}
					</button>
				{/if}
				<button type="button" class="ui-btn ui-btn-primary" disabled={!review.ready} onclick={() => (round = {})}>
					{m.practice.start}
				</button>
			</div>
		</section>

		<section class="rules">
			<h2 class="ui-label">{m.practice.rules}</h2>
			<p class="muted">{m.practice.map}</p>
			<div class="find">
				<input
					type="search"
					class="ui-field"
					bind:value={query}
					placeholder={m.practice.search}
					aria-label={m.practice.search}
					autocomplete="off"
					spellcheck="false"
				/>
				<button type="button" class="ui-chip" aria-pressed={hideKnown} onclick={toggleKnown}>
					{m.practice.hideKnown}
				</button>
			</div>

			{#each lessons as lesson (lesson.id)}
				{#if lesson.shown.length}
					<details class="ui-card lesson" open>
						<summary>
							<h3><span class="n">{m.practice.lessonN(lesson.n)}</span> {lesson.title}</h3>
							{#if review.ready}
								<span class="ui-badge">{m.practice.knownOf(lesson.known, lesson.points.length)}</span>
							{/if}
						</summary>
						<ul>
							{#each lesson.shown as point (point.id)}
								<li>
									<PracticeTile
										{point}
										held={held(point)}
										disabled={!review.ready}
										onselect={() => (round = { only: [point.id] })}
									/>
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			{/each}
			{#if !anyShown}
				<p class="muted" role="status">{query.trim() ? m.practice.noMatch : m.practice.allKnown}</p>
			{/if}
		</section>

		<p class="muted kept">{m.practice.kept}</p>
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

	/* What starts a round and what is chosen are in the flag's yellow, as on
	   the alphabet page (--flag in app.css), not the blue of a link */
	.page :global(.ui-btn.ui-btn-primary) {
		border-color: var(--flag-line);
		background: var(--flag);
		color: var(--flag-ink);
	}

	@media (hover: hover) {
		.page :global(.ui-btn.ui-btn-primary:hover:not(:disabled)) {
			border-color: var(--flag-line);
			background: color-mix(in srgb, var(--flag) 86%, var(--flag-ink));
		}
	}

	.setup :global(.ui-segment[data-state='checked']) {
		background: var(--flag);
		color: var(--flag-ink);
	}

	p,
	h2,
	h3,
	ul {
		margin: 0;
	}

	ul {
		padding: 0;
		list-style: none;
	}

	.lead,
	.kept,
	.rules > .muted {
		color: var(--on-page);
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.kept {
		font-size: var(--text-sm);
	}

	/* How to answer on the left, Start on the right; on a phone one under the other */
	.setup {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		padding: 1rem 1.25rem;
	}

	.choice {
		display: grid;
		gap: 0.35rem;
		min-width: min(100%, 15rem);
	}

	/* A choice's name: as .ui-label is set, without its rule running to the edge */
	.name {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.go {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
		margin-left: auto;
	}

	/* The lessons stand straight on the page, each a card of its own */
	.rules {
		display: grid;
		gap: 0.75rem;
	}

	/* The search takes the row, and the switch beside it keeps its width */
	.find {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.find .ui-field {
		flex: 1;
		min-width: 0;
	}

	.find .ui-chip {
		flex: none;
	}

	.lesson {
		padding: 0.75rem 1.25rem;
	}

	.lesson[open] {
		padding-bottom: 1.25rem;
	}

	/* A lesson's heading opens and shuts it: a marker, the title, and how much of the lesson is known at the far end */
	summary {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::before {
		content: '';
		flex: none;
		width: 0.4rem;
		height: 0.4rem;
		border-right: 2px solid var(--muted);
		border-bottom: 2px solid var(--muted);
		transform: rotate(-45deg);
		transition: transform var(--duration);
	}

	.lesson[open] > summary::before {
		transform: rotate(45deg);
	}

	summary h3 {
		flex: 1;
		min-width: 0;
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	summary .n {
		margin-right: 0.35rem;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		font-weight: 700;
	}

	/* The rules of one lesson, as tiles side by side: two across on a phone */
	.lesson ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.lesson li {
		display: grid;
	}

	@media (max-width: 26rem) {
		.lesson {
			padding-inline: 0.9rem;
		}

		.lesson ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
