<!-- A round of grammar practice: ten sentences (PracticeGap.svelte) over the
     rules round.ts picks, then what was missed. The round begins as soon as
     this is shown: it plans its rules, asks /api/practice for the sentences,
     and after each answer gives the rule's card to the flashcards
     (review.svelte.ts), where a round is one review of each of its rules.

     The page that shows it decides what the round is over: every rule on
     offer, one rule or one lesson's (`only`), or the rules held least well
     (`weak`). -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import PracticeGap from '#lib/PracticeGap.svelte';
	import PracticeMeaning from '#lib/PracticeMeaning.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { cardKey, pointOf, ruleOf, type Point } from '#lib/practice/points.ts';
	import { askWhere, gradePoint, planRound, planWeak, split, type Gap, type Outcome } from '#lib/practice/round.ts';
	import { introPath, lessonName, lessonOfPoint } from '#lib/practice/intros.ts';
	import { introduces } from '#lib/practice/rules.ts';
	import { whereAnswer } from '#lib/practice/where.ts';
	import type { ReviewCard } from '#lib/review/fsrs.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		offered,
		only,
		weak = false,
		choice,
		onstop
	}: {
		/** Ids of the rules that have sentences, in the order they are best met. */
		offered: readonly string[];
		/** The rules the round is of, chosen by the learner: one rule, or a lesson's. */
		only?: readonly string[];
		/** A round of the rules held least well. */
		weak?: boolean;
		/** Answered by choosing among four forms; otherwise by typing. */
		choice: boolean;
		/** The round was stopped, or left when it was over. */
		onstop: () => void;
	} = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	let stage = $state<'loading' | 'failed' | 'round' | 'summary'>('loading');
	let gaps = $state.raw<Gap[]>([]);
	let outcomes = $state.raw<Outcome[]>([]);
	let result = $state.raw<{ outcome: Outcome; given: string } | null>(null);
	/** Each rule's card as the round found it: a round is one review, worked out from here. */
	let before = new Map<string, ReviewCard | undefined>();
	/** Sentences asked for before the last "Another round" must not be shown when they arrive. */
	let asked = 0;

	let at = $derived(outcomes.length - (result ? 1 : 0));
	let gap = $derived(gaps[at]);
	/** The first sentence of a rule that had no card when the round began: its rule's card opens over it. */
	let first = $derived(introduces(gaps.map((g) => g.point), at, (point) => before.get(point) !== undefined));

	async function start() {
		const plan = weak
			? planWeak(offered, review.cards, Date.now(), Math.random)
			: planRound(offered, review.cards, Date.now(), Math.random, only);
		if (!plan.length) return onstop();
		stage = 'loading';
		const mine = ++asked;
		try {
			// Some sentences of у, на and під rules already met are asked as де? or куди?
			const res = await fetch(`/api/practice?points=${askWhere(plan, review.cards, Math.random).join(',')}`);
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

	onMount(() => {
		void start();
		// While a round runs, a phone's header slims down (Header.svelte)
		document.documentElement.dataset.practising = '';
		return () => {
			// Sentences that arrive after the round was left are dropped
			asked += 1;
			delete document.documentElement.dataset.practising;
		};
	});

	function answer(outcome: Outcome, given: string) {
		if (!gap || result) return;
		const point = gap.point;
		outcomes = [...outcomes, outcome];
		result = { outcome, given };
		// Every sentence of this rule answered so far says how the rule's one review went
		const sofar = outcomes.filter((_, i) => gaps[i].point === point);
		review.record(gradePoint(point, before.get(point), sofar, Date.now()));
	}

	/** How far the round has come: the next sentence is brought back to it if it was scrolled past. */
	let bar: HTMLElement | undefined = $state();

	async function goOn() {
		if (stage !== 'round' || !result) return;
		result = null;
		if (outcomes.length >= gaps.length) stage = 'summary';
		await tick();
		// On a phone Next may sit below the sentence's first screen: the next
		// sentence must not start out of sight above it, under the sticky header
		if (!bar) return;
		const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
		const off = bar.getBoundingClientRect().top - header - 8;
		if (off < 0) {
			const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
			window.scrollBy({ top: off, behavior: still ? 'instant' : 'smooth' });
		}
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
	/** The pages of the lessons that had a miss, once each: the moment an explanation is most wanted. */
	let toRead = $derived([...new Set(missed.map(([point]) => lessonOfPoint(point.id)).filter((id) => id !== undefined))]);
</script>

{#if stage === 'loading' || stage === 'failed'}
	<section class="ui-card wait">
		{#if stage === 'failed'}
			<p role="alert">{m.practice.failed}</p>
			<div class="answers">
				<button type="button" class="ui-btn" onclick={onstop}>{m.practice.back}</button>
				<button type="button" class="ui-btn ui-btn-primary" onclick={start}>{m.practice.retry}</button>
			</div>
		{:else}
			<p class="muted" role="status">{m.practice.loading}</p>
		{/if}
	</section>
{:else if stage === 'round' && gap}
	{@const point = pointOf(gap.point)}
	<div class="bar" bind:this={bar}>
		<span class="ui-badge">{m.practice.count(Math.min(at + 1, gaps.length), gaps.length)}</span>
		<button type="button" class="ui-btn" onclick={onstop}>{m.practice.stop}</button>
	</div>
	{#if point}
		{#key at}
			{#if gap.kind === 'where' || gap.kind === 'who'}
				<PracticeMeaning {gap} {point} {first} {result} onanswer={answer} onnext={goOn} />
			{:else}
				<PracticeGap {gap} {point} {choice} {first} {result} onanswer={answer} onnext={goOn} />
			{/if}
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
							{#if point.ask}
								<!-- A verb's pattern: дякувати + кому?, and its case -->
								<b lang="uk">{ruleOf(point)}</b> <Term id={point.case} />
							{:else}
								<b lang="uk">{point.cue}</b> + <Term id={point.case} />
								{#if point.number}{m.practice.ofNumber[point.number]}{/if}
							{/if}
							{#if HINTS[point.case] && !point.ask}<span class="question" lang="uk">{HINTS[point.case]}</span>{/if}
						</p>
						{#each sentences as g (g.tatoeba_id + ':' + g.start + ':' + g.uk)}
							{#if g.kind === 'who' && g.roles}
								<!-- Who does what to whom: the one who does it, and the one done to as the sentence has it -->
								<p class="pair">
									<span class="phrase" lang="uk"><Stressed text={g.roles.doer.headword} /></span>
									<Icon name="arrow-right" size={16} />
									<span class="phrase" lang="uk"><Stressed text={g.answer} /></span>
								</p>
							{:else if g.kind === 'where'}
								<!-- Asked as де? or куди?: the phrase, and the question it answers -->
								<p class="pair">
									<span class="phrase" lang="uk"
										>{split(g).before.trim().split(/\s+/).at(-1)?.toLowerCase()} <Stressed text={g.answer} /></span
									>
									<Icon name="arrow-right" size={16} />
									<b lang="uk">{whereAnswer(g.point) === 'where' ? 'де?' : 'куди?'}</b>
								</p>
							{:else}
								<p class="pair">
									<Headword text={g.headword} size="sm" href={wordPath(g.word)} />
									<Icon name="arrow-right" size={16} />
									<Headword text={g.answer} size="sm" />
								</p>
							{/if}
						{/each}
					</li>
				{/each}
			</ul>
			{#if toRead.length}
				<p class="read">
					{m.intro.readMissed}
					{#each toRead as id, i (id)}{#if i}{' · '}{/if}<a href={introPath(id)}>{lessonName(id)}</a>{/each}
				</p>
			{/if}
		{:else}
			<p class="muted">{m.practice.allRight}</p>
		{/if}
		<div class="answers">
			<button type="button" class="ui-btn" onclick={onstop}>{m.practice.back}</button>
			<button type="button" class="ui-btn ui-btn-primary" onclick={start}>{m.practice.again}</button>
		</div>
	</section>
{/if}

<style>
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

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* How far the round has come, and the way out of it */
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.wait,
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

	.read {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.read a {
		color: var(--accent);
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

	.question {
		margin-left: 0.5rem;
		color: var(--ink-2);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	.pair {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem 0.5rem;
		color: var(--muted);
	}

	.phrase,
	.pair b {
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
		font-weight: 800;
	}

	.answers {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}
</style>
