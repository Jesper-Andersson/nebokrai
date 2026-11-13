<!-- Grammar practice: real sentences with a noun left out after a
     preposition, to be put in the case the preposition asks for (без цукру,
     на столі). A round is ten sentences (PracticeGap.svelte) over a few
     rules: those whose day has come, and up to two not met before. The rules
     of a round are in src/lib/practice/round.ts; the sentences come from
     /api/practice.

     Each rule is scheduled as a flashcard is (FSRS, src/lib/review/fsrs.ts)
     and kept with the flashcards (review.svelte.ts), so an account holds it
     and a sentence answered counts towards the day's reviews and the streak.
     A round is one review of each of its rules. -->
<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { onMount } from 'svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import PracticeGap from '#lib/PracticeGap.svelte';
	import Term from '#lib/Term.svelte';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { POINTS, POINT_CASES, cardKey, pointOf, type Point } from '#lib/practice/points.ts';
	import { gradePoint, planRound, stateOf, type Gap, type Outcome } from '#lib/practice/round.ts';
	import type { ReviewCard } from '#lib/review/fsrs.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	/** The rules that have sentences, in the order they are best met. */
	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]));
	let met = $derived(offered.filter((point) => review.cards.has(cardKey(point.id))).length);

	// How to answer is this browser's to remember, as the alphabet trainer's choices are
	const ANSWER_KEY = 'practice-answer';
	let byChoice = $state(true);

	onMount(() => {
		void review.load();
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

	// --- A round ---

	let stage = $state<'setup' | 'loading' | 'failed' | 'round' | 'summary'>('setup');
	/** The rule a round was asked for alone, to ask for it again. */
	let only = $state<string | undefined>();
	let gaps = $state.raw<Gap[]>([]);
	let outcomes = $state.raw<Outcome[]>([]);
	let result = $state.raw<{ outcome: Outcome; given: string } | null>(null);
	/** Each rule's card as the round found it: a round is one review, worked out from here. */
	let before = new Map<string, ReviewCard | undefined>();
	/** A round begun and stopped must not be shown when its sentences arrive. */
	let asked = 0;

	let at = $derived(outcomes.length - (result ? 1 : 0));
	let gap = $derived(gaps[at]);

	async function start(point?: string) {
		only = point;
		const plan = planRound(offered.map((p) => p.id), review.cards, Date.now(), Math.random, point);
		if (!plan.length) return;
		stage = 'loading';
		const mine = ++asked;
		try {
			const res = await fetch(`/api/practice?points=${plan.join(',')}`);
			if (!res.ok) throw new Error(String(res.status));
			const found: Gap[] = (await res.json()).gaps;
			if (mine !== asked) return;
			if (!found.length) throw new Error('empty');
			gaps = found;
			outcomes = [];
			result = null;
			before = new Map(found.map((g) => [g.point, review.cards.get(cardKey(g.point))]));
			stage = 'round';
		} catch {
			if (mine === asked) stage = 'failed';
		}
	}

	function stop() {
		asked += 1;
		stage = 'setup';
		result = null;
	}

	function answer(outcome: Outcome, given: string) {
		if (!gap || result) return;
		const point = gap.point;
		outcomes = [...outcomes, outcome];
		result = { outcome, given };
		// Every sentence of this rule answered so far says how the rule's one review went
		const sofar = outcomes.filter((_, i) => gaps[i].point === point);
		review.record(gradePoint(point, before.get(point), sofar, Date.now()));
	}

	function goOn() {
		if (stage !== 'round' || !result) return;
		result = null;
		if (outcomes.length >= gaps.length) stage = 'summary';
	}

	let right = $derived(outcomes.filter((outcome) => outcome !== 'missed').length);
	/** The sentences missed, under their rules. */
	let missed = $derived.by(() => {
		const by = new Map<Point, Gap[]>();
		gaps.forEach((g, i) => {
			const point = pointOf(g.point);
			if (outcomes[i] === 'missed' && point) by.set(point, [...(by.get(point) ?? []), g]);
		});
		return [...by];
	});
</script>

<PageMeta title="{m.pageTitle.practice} · Nebokrai" description={m.meta.practice} />

<div class="ui-page page">
	<header>
		<h1 class="ui-title">{m.pageTitle.practice}</h1>
		{#if stage === 'round'}
			<span class="ui-badge">{m.practice.count(Math.min(at + 1, gaps.length), gaps.length)}</span>
			<button type="button" class="ui-btn stop" onclick={stop}>{m.practice.stop}</button>
		{/if}
	</header>

	{#if !offered.length}
		<p class="lead">{m.practice.none}</p>
	{:else if stage === 'setup' || stage === 'loading' || stage === 'failed'}
		<p class="lead">{m.practice.lead}</p>

		<section class="ui-card setup" aria-busy={!review.ready || stage === 'loading'}>
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
				{#if stage === 'failed'}
					<span class="muted" role="alert">{m.practice.failed}</span>
				{:else if stage === 'loading'}
					<span class="muted" role="status">{m.practice.loading}</span>
				{:else if review.ready}
					<span class="muted">{m.practice.met(met, offered.length)}</span>
				{/if}
				<button
					type="button"
					class="ui-btn ui-btn-primary"
					disabled={!review.ready || stage === 'loading'}
					onclick={() => start(stage === 'failed' ? only : undefined)}
				>
					{stage === 'failed' ? m.practice.retry : m.practice.start}
				</button>
			</div>
		</section>

		<section class="ui-card rules">
			<h2 class="ui-label">{m.practice.rules}</h2>
			{#each POINT_CASES as kase (kase)}
				{@const points = offered.filter((point) => point.case === kase)}
				{#if points.length}
					<div class="case">
						<h3>
							<Term id={kase}>{m.grammar.terms[kase].name}</Term>
							{#if HINTS[kase]}<span class="question" lang="uk">{HINTS[kase]}</span>{/if}
						</h3>
						<ul>
							{#each points as point (point.id)}
								{@const state = review.ready ? stateOf(review.cards.get(cardKey(point.id))) : 'new'}
								<li>
									<button
										type="button"
										class="rule"
										title={m.practice.only}
										disabled={!review.ready || stage === 'loading'}
										onclick={() => start(point.id)}
									>
										<b lang="uk">{point.preposition}</b>
										<span class="meaning">{m.practice.meaning[point.id]}</span>
										<span class="state" data-state={state}>{m.practice.state[state]}</span>
										<!-- Says the line can be pressed, where nothing hovers to say so -->
										<span class="open"><Icon name="chevron-right" size={16} /></span>
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/each}
		</section>

		<p class="muted kept">{m.practice.kept}</p>
	{:else if stage === 'round' && gap}
		{@const point = pointOf(gap.point)}
		{#if point}
			{#key at}
				<PracticeGap {gap} {point} choice={byChoice} {result} onanswer={answer} onnext={goOn} />
			{/key}
		{/if}
	{:else}
		<section class="ui-card end" role="status">
			<h2>{m.practice.done}</h2>
			<p>{m.practice.score(right, outcomes.length)}</p>
			{#if missed.length}
				<h3 class="ui-label">{m.practice.missed}</h3>
				<ul class="missed">
					{#each missed as [point, sentences] (point.id)}
						<li>
							<p class="takes">
								<b lang="uk">{point.preposition}</b> + <Term id={point.case} />
								{#if HINTS[point.case]}<span class="question" lang="uk">{HINTS[point.case]}</span>{/if}
							</p>
							{#each sentences as g (g.tatoeba_id + ':' + g.start)}
								<p class="pair">
									<Headword text={g.headword} size="sm" href={wordPath(g.word)} />
									<Icon name="arrow-right" size={16} />
									<Headword text={g.answer} size="sm" />
								</p>
							{/each}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">{m.practice.allRight}</p>
			{/if}
			<div class="answers">
				<button type="button" class="ui-btn" onclick={stop}>{m.practice.back}</button>
				<button type="button" class="ui-btn ui-btn-primary" onclick={() => start(only)}>{m.practice.again}</button>
			</div>
		</section>
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

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.6rem;
	}

	.stop {
		margin-left: auto;
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
	.kept {
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

	.rules {
		display: grid;
		gap: 1rem;
		padding: 1rem 1.25rem 1.25rem;
	}

	.case {
		display: grid;
		gap: 0.35rem;
	}

	.case h3 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	.question {
		color: var(--ink-2);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	/* A rule: the preposition, what it says, and how well it is held. The
	   whole line is the button that starts a round of it. */
	.rule {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr) auto auto;
		align-items: baseline;
		gap: 0.75rem;
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

	.rule:disabled {
		cursor: default;
	}

	@media (hover: hover) {
		.rule:hover:not(:disabled) {
			background: var(--surface-2);
		}
	}

	.rule b {
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.rule .meaning {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	/* How well a rule is held: a mark that fills as it is learnt, with the word beside it */
	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
		font-size: var(--text-xs);
		white-space: nowrap;
	}

	.state::before {
		content: '';
		width: 0.6rem;
		height: 0.6rem;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
	}

	.state[data-state='learning']::before {
		border-color: var(--flag-line);
		background: linear-gradient(to top, var(--flag) 50%, transparent 50%);
	}

	.state[data-state='known']::before {
		border-color: var(--flag-line);
		background: var(--flag);
	}

	.open {
		display: inline-flex;
		align-self: center;
		color: var(--muted);
	}

	/* On a phone the meaning goes under the preposition, and the mark stays on the right */
	@media (max-width: 30rem) {
		.rule {
			grid-template-columns: minmax(0, 1fr) auto auto;
			gap: 0.1rem 0.5rem;
		}

		.rule .meaning {
			grid-row: 2;
		}

		.state,
		.open {
			grid-row: 1 / span 2;
			align-self: center;
		}

		.state {
			grid-column: 2;
		}

		.open {
			grid-column: 3;
		}
	}

	.end {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		justify-items: center;
		text-align: center;
	}

	.end h2 {
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	.end .ui-label {
		width: 100%;
	}

	.missed {
		display: grid;
		gap: 0.9rem;
	}

	.missed li {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
	}

	.takes {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.takes b {
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.takes .question {
		margin-left: 0.5rem;
	}

	.pair {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem 0.5rem;
		color: var(--muted);
	}

	.answers {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}
</style>
