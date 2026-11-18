<!-- The placement test (src/lib/placement.ts, GET and POST /api/placement),
     as the user picked it in Figma on 2026-11-17 ("Card A result B").

     A start screen says how long it takes and that some words are made up.
     Then 80 words one at a time, "I know it" (J) or "Not sure" (F), under a
     thin bar; then the grammar, a sentence at a time as /practice asks it
     (PracticeGap, PracticeMeaning), under the same bar. The words are scored
     by the server as soon as they are done; a result too unreliable to use
     ends the test there and changes nothing.

     The result is the placement record (review/progress.ts): where new
     common words start, and the lessons placed out. Nothing else is written:
     no card, no review, no day counted. Undo takes the result back, and the
     one before it, if any, is in force again. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import PracticeGap from '#lib/PracticeGap.svelte';
	import PracticeMeaning from '#lib/PracticeMeaning.svelte';
	import { Alphabet } from '#lib/alphabet.svelte.ts';
	import { stateOf as letterState } from '#lib/alphabet/drill.ts';
	import { APOSTROPHE, LETTERS } from '#lib/alphabet/letters.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import StageBar from '#lib/learn/StageBar.svelte';
	import { STAGE_IDS, learnerInput, pathOf, workingStage } from '#lib/path.ts';
	import { placeLessons, sizeRange, type GrammarResult, type WordAnswer, type WordScore } from '#lib/placement.ts';
	import { LESSONS } from '#lib/practice/lessons.ts';
	import { POINTS, pointOf } from '#lib/practice/points.ts';
	import type { Gap, Outcome } from '#lib/practice/round.ts';
	import { COMMON_DECKS } from '#lib/review/decks.ts';
	import { addResult, undoResult, type PlacementResult } from '#lib/review/progress.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	const review = useReview();
	const alphabet = new Alphabet();
	let m = $derived(messagesFor(settings.lang));
	const number = (n: number) => (settings.lang === 'uk' ? String(n) : n.toLocaleString('en'));

	type Stage = 'start' | 'loading' | 'failed' | 'unavailable' | 'words' | 'grammar' | 'scoring' | 'result' | 'unreliable';
	let stage = $state<Stage>('start');

	onMount(() => {
		void review.load();
		// For the path the result shows
		review.fetchDecks(COMMON_DECKS.map((deck) => deck.id));
		review.fetchFrequency();
		alphabet.load();
	});

	// --- The test ---

	interface Item {
		lesson: string;
		gap: Gap;
	}

	let words = $state.raw<string[]>([]);
	let items = $state.raw<Item[]>([]);
	let answers = $state.raw<WordAnswer[]>([]);
	/** Each lesson's items as answered, true when right without help. */
	let results = $state.raw<GrammarResult[]>([]);
	let at = $state(0);
	/** The sentence on show, once answered. */
	let answered = $state.raw<{ outcome: Outcome; given: string } | null>(null);
	/** The words' score, from the server, asked for as soon as the words are done. */
	let scored: Promise<WordScore | null> = Promise.resolve(null);
	let result = $state.raw<PlacementResult | null>(null);
	/** A test drawn after the one on show was left must not replace it. */
	let drawn = 0;

	async function begin() {
		stage = 'loading';
		const mine = ++drawn;
		try {
			const res = await fetch('/api/placement');
			if (res.status === 503) {
				if (mine === drawn) stage = 'unavailable';
				return;
			}
			if (!res.ok) throw new Error(String(res.status));
			const test: { words: string[]; grammar: { lesson: string; gaps: Gap[] }[] } = await res.json();
			if (mine !== drawn) return;
			words = test.words;
			items = test.grammar.flatMap(({ lesson, gaps }) => gaps.map((gap) => ({ lesson, gap })));
			answers = [];
			results = [];
			answered = null;
			result = null;
			at = 0;
			stage = 'words';
		} catch {
			if (mine === drawn) stage = 'failed';
		}
	}

	function stop() {
		drawn += 1;
		stage = 'start';
	}

	function sayWord(yes: boolean) {
		if (stage !== 'words' || at >= words.length) return;
		answers = [...answers, { word: words[at], yes }];
		at += 1;
		if (at < words.length) return;
		const sent = answers;
		scored = fetch('/api/placement', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ answers: sent })
		}).then((res) => (res.ok ? res.json() : null)).catch(() => null);
		at = 0;
		if (items.length) stage = 'grammar';
		else void finish();
		// An answer too unreliable to use needs no grammar to tell
		void scored.then((score) => {
			if (score && !score.reliable && stage === 'grammar') stage = 'unreliable';
		});
	}

	function onkeydown(event: KeyboardEvent) {
		if (stage !== 'words' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
		const key = event.key.toLowerCase();
		// J and F, and the letters at their place on a Ukrainian keyboard (о, а)
		if (key === 'j' || key === 'о') sayWord(true);
		else if (key === 'f' || key === 'а') sayWord(false);
		else return;
		event.preventDefault();
	}

	const GROUP = new Map(LESSONS.map((lesson) => [lesson.id, lesson.group]));

	/** The grammar so far: the lessons placed, and the groups stopped after two failed lessons in a row. */
	let sofar = $derived(placeLessons(results));
	/** The items still to ask: none of a group that has stopped. */
	let asked = $derived(items.filter((item) => !sofar.stopped.includes(GROUP.get(item.lesson) ?? 'preposition')));
	let item = $derived(items[at]);

	function answerItem(outcome: Outcome, given: string) {
		if (!item || answered) return;
		answered = { outcome, given };
		const right = outcome === 'right';
		const had = results.find((r) => r.lesson === item.lesson);
		results = had
			? results.map((r) => (r === had ? { lesson: r.lesson, right: [...r.right, right] } : r))
			: [...results, { lesson: item.lesson, right: [right] }];
	}

	function nextItem() {
		if (!answered) return;
		answered = null;
		// On to the next item of a group still being asked
		let next = at + 1;
		while (next < items.length && sofar.stopped.includes(GROUP.get(items[next].lesson) ?? 'preposition')) next += 1;
		if (next < items.length) at = next;
		else void finish();
	}

	async function finish() {
		stage = 'scoring';
		const score = await scored;
		if (!score) {
			stage = 'failed';
			return;
		}
		if (!score.reliable) {
			stage = 'unreliable';
			return;
		}
		const now = Date.now();
		result = { at: now, size: score.size, start: score.start, reliable: true, placed: placeLessons(results).placed };
		review.changeProgress('placement', addResult(review.progress.placement, result, now));
		stage = 'result';
	}

	function undo() {
		const record = review.progress.placement;
		if (record?.results.length) review.changeProgress('placement', undoResult(record, Date.now()));
		void goto('/learn');
	}

	// --- Where the result puts the learner ---

	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]).map((point) => point.id));
	const ALPHABET = LETTERS.filter(({ letter }) => letter !== APOSTROPHE);
	let letters = $derived({
		known: ALPHABET.filter(({ letter }) => letterState(alphabet.progress[letter]) === 'known').length,
		total: ALPHABET.length,
		skipped: alphabet.skipped
	});
	let path = $derived(pathOf(learnerInput({
		cards: review.cards, common: review.common, frequency: review.frequency, letters, start: review.start,
		offered, placed: review.placedLessons, now: Date.now()
	})));
	let working = $derived(workingStage(path));
	let reachedCount = $derived(path.stages.filter((s) => s.reached).length);
	let range = $derived(result ? sizeRange(result.size) : null);

	/** The thin bar over the words and over the grammar. */
	let progress = $derived(
		stage === 'words' ? at / Math.max(words.length, 1)
		: stage === 'grammar' ? Math.max(asked.indexOf(item), 0) / Math.max(asked.length, 1)
		: 0);
</script>

<svelte:window {onkeydown} />

<PageMeta title="{m.pageTitle.placement} · Nebokrai" description={m.meta.placement} />

<div class="ui-page page">
	{#if stage === 'start' || stage === 'loading' || stage === 'failed' || stage === 'unavailable'}
		<h1 class="ui-title">{m.placement.title}</h1>
		<p class="lead">{m.placement.lead}</p>
		<p class="muted">{m.placement.note}</p>
		{#if stage === 'failed'}<p role="alert">{m.placement.failed}</p>{/if}
		{#if stage === 'unavailable'}<p role="alert">{m.placement.unavailable}</p>{/if}
		<div class="actions">
			{#if stage !== 'unavailable'}
				<button type="button" class="ui-btn ui-btn-primary" disabled={stage === 'loading'} aria-busy={stage === 'loading'} onclick={begin}>
					{stage === 'failed' ? m.placement.retry : m.placement.start} <Icon name="arrow-right" size={16} />
				</button>
			{/if}
			<a class="link" href="/learn">{m.placement.notNow}</a>
		</div>
		{#if stage === 'loading'}<p class="muted" role="status">{m.placement.loading}</p>{/if}
	{:else if stage === 'words'}
		<div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={words.length} aria-valuenow={at} aria-label={m.placement.wordCount(at + 1, words.length)}>
			<i style:width="{progress * 100}%"></i>
		</div>
		<p class="muted count">{m.placement.wordCount(at + 1, words.length)}</p>
		<p class="word" lang="uk">{words[at]}</p>
		<div class="answers">
			<button type="button" class="ui-btn ui-btn-primary" onclick={() => sayWord(true)}>
				{m.placement.know} <kbd class="ui-kbd">J</kbd>
			</button>
			<button type="button" class="ui-btn" onclick={() => sayWord(false)}>
				{m.placement.notSure} <kbd class="ui-kbd">F</kbd>
			</button>
		</div>
		<button type="button" class="link stop" onclick={stop}>{m.placement.stop}</button>
	{:else if stage === 'grammar' && item}
		{@const point = pointOf(item.gap.point)}
		<div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={asked.length} aria-valuenow={asked.indexOf(item)} aria-label={m.placement.grammarCount(asked.indexOf(item) + 1, asked.length)}>
			<i style:width="{progress * 100}%"></i>
		</div>
		<p class="muted count">{m.placement.grammarCount(asked.indexOf(item) + 1, asked.length)}</p>
		{#if at === 0 && !answered}<p class="muted lead-in">{m.placement.grammarLead}</p>{/if}
		{#if point}
			{#key at}
				{#if item.gap.kind === 'where' || item.gap.kind === 'who'}
					<PracticeMeaning gap={item.gap} {point} first={false} result={answered} onanswer={answerItem} onnext={nextItem} />
				{:else}
					<PracticeGap gap={item.gap} {point} choice first={false} result={answered} onanswer={answerItem} onnext={nextItem} />
				{/if}
			{/key}
		{/if}
		<button type="button" class="link stop" onclick={stop}>{m.placement.stop}</button>
	{:else if stage === 'scoring'}
		<p class="muted" role="status">{m.placement.scoring}</p>
	{:else if stage === 'result' && result}
		<h1 class="ui-sr-only">{m.pageTitle.placement}</h1>
		<section class="ui-card result" role="status">
			<p class="muted">{range ? m.placement.knowRange(number(range.from), number(range.to)) : m.placement.knowFew}</p>
			<p class="stage">{m.path.stage[working.id]}</p>
			<StageBar reached={reachedCount} stages={STAGE_IDS.length} label={m.path.stage[working.id]} />
			<ul class="changes">
				<li>{result.start > 1 ? m.placement.startsFrom(number(result.start)) : m.placement.startsAtFirst}</li>
				{#if result.placed.length}<li>{m.placement.lessonsKnown(result.placed.length)}</li>{/if}
			</ul>
		</section>
		<div class="actions">
			<a class="ui-btn ui-btn-primary" href="/learn">{m.placement.goLearn} <Icon name="arrow-right" size={16} /></a>
			<button type="button" class="link" onclick={undo}>{m.placement.undo}</button>
		</div>
	{:else if stage === 'unreliable'}
		<h1 class="ui-title">{m.placement.unreliableTitle}</h1>
		<p class="lead">{m.placement.unreliableText}</p>
		<div class="actions">
			<button type="button" class="ui-btn ui-btn-primary" onclick={begin}>{m.placement.retry}</button>
			<a class="link" href="/learn">{m.placement.fromStart}</a>
		</div>
	{/if}
</div>

<style>
	.page {
		display: grid;
		align-content: start;
		gap: var(--gap-stack);
		max-width: var(--prose);
		padding-block: 1rem 2rem;
	}

	.page > p {
		margin: 0;
	}

	.ui-title {
		margin: 0;
	}

	.lead {
		font-size: var(--text-lg);
		line-height: 1.5;
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-stack);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		cursor: pointer;
	}

	.stop {
		justify-self: center;
		color: var(--muted);
	}

	/* The thin bar over the words and the grammar */
	.progress {
		display: flex;
		height: 0.4rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--border);
	}

	.progress i {
		background: var(--accent);
	}

	.count {
		text-align: center;
	}

	.word {
		padding-block: 2.5rem 2rem;
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: var(--headword-lg);
		font-weight: 800;
		line-height: 1.1;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.answers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-inline);
	}

	.answers .ui-btn {
		justify-content: center;
	}

	.answers kbd {
		opacity: 0.8;
	}

	/* The result: the range, the stage, the path's bar, and what changed */
	.result {
		display: grid;
		gap: 0.8rem;
		padding: 1.1rem 1.25rem;
	}

	.result p {
		margin: 0;
	}

	.stage {
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: var(--headword-md);
		line-height: 1.15;
	}

	.changes {
		display: grid;
		gap: var(--gap-tight);
		margin: 0;
		padding: 0;
		font-size: var(--text-sm);
		list-style: none;
	}

	.changes li::before {
		content: '· ';
		color: var(--muted);
	}
</style>
