<!-- The learner's dashboard, as the user signed it off in Figma on
     2026-11-14 ("C9"). A narrow rail for what is about the learner: the
     streak and the last fortnight's reviews. A wide column for what to do:
     the two doors (flashcards and grammar), then Vocabulary (the words known,
     and a chip per deck), Grammar (the lessons beside the open one) and
     Reference (the pages for reading). Each part is its own component in
     src/lib/learn/.

     A newcomer, who has reviewed nothing, sees three steps instead: a
     dashboard of noughts says nothing.

     Nothing new is stored for any of it: words and rules are flashcards
     (review.svelte.ts), the letters are the alphabet drill's boxes
     (alphabet.svelte.ts), and all of it is in the browser, so the server
     renders the frame and the figures arrive when the page has loaded. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { Alphabet } from '#lib/alphabet.svelte.ts';
	import { stateOf as letterState } from '#lib/alphabet/drill.ts';
	import { APOSTROPHE, LETTERS } from '#lib/alphabet/letters.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import ActivityCard from '#lib/learn/ActivityCard.svelte';
	import Doors from '#lib/learn/Doors.svelte';
	import GrammarCard from '#lib/learn/GrammarCard.svelte';
	import ReferenceTiles from '#lib/learn/ReferenceTiles.svelte';
	import StreakCard from '#lib/learn/StreakCard.svelte';
	import VocabularyCard from '#lib/learn/VocabularyCard.svelte';
	import { POINTS, cardKey, isPointKey } from '#lib/practice/points.ts';
	import { plan } from '#lib/review/cards.ts';
	import { COMMON_DECKS, wordsOfDeck } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	const saved = useSaved();
	const review = useReview();
	// This page's own: the alphabet's progress is shared through no context
	const alphabet = new Alphabet();
	let m = $derived(messagesFor(settings.lang));

	let now = $state(Date.now());

	onMount(() => {
		void review.load();
		// All three, switched on or not: the chips show each, and the words known count them all
		review.fetchDecks(COMMON_DECKS.map((deck) => deck.id));
		alphabet.load();
		const tick = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(tick);
	});

	// Until then every figure would be a nought that is not true
	let ready = $derived(review.ready && saved.ready && alphabet.ready);

	// --- Flashcards: the words ---

	let savedWords = $derived(saved.items.map((item) => item.word));
	/** The words of the decks switched on: the ones /review shows, and the header counts. */
	let deckWords = $derived(
		review.settings.decks.flatMap((deck) => wordsOfDeck(deck, savedWords, saved.lists, review.common)));
	let cardsToday = $derived(plan(review.cards, deckWords, review.settings.new_per_day, now));
	let cardsDue = $derived(cardsToday.learning.length + cardsToday.due.length);
	let wordsBegun = $derived([...review.cards.keys()].some((key) => !isPointKey(key)));

	// --- Grammar: the rules ---

	// A rule with no sentences is never asked (/practice leaves it out too)
	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]).map((point) => point.id));
	let ruleKeys = $derived(offered.map(cardKey));
	let rulesBegun = $derived(ruleKeys.some((key) => review.cards.has(key)));
	let rulesDue = $derived(ruleKeys.filter((key) => (review.cards.get(key)?.due ?? Infinity) <= now).length);

	// --- The letters ---

	// The 33 a learner has heard of: the drill also asks the apostrophe, which
	// is a sign and no letter, and "34 letters" sent a newcomer to check.
	const ALPHABET = LETTERS.filter(({ letter }) => letter !== APOSTROPHE);

	let letters = $derived.by(() => {
		const counts = { new: 0, learning: 0, known: 0 };
		for (const { letter } of ALPHABET) counts[letterState(alphabet.progress[letter])] += 1;
		return counts;
	});
	let lettersDone = $derived(alphabet.skipped || letters.known === ALPHABET.length);

	// A newcomer has reviewed nothing: no card, no rule, no day. The letters
	// do not count, being the first of the newcomer's three steps.
	let started = $derived(wordsBegun || rulesBegun || Object.keys(review.days).length > 0);

	const FIRST_DECK = COMMON_DECKS[0].id;

	/**
	 * Before following a link to /review?start: switch on the deck of the 500
	 * commonest words, so that there the first card comes up with no deck to
	 * find and no second button. The decks keep the order /review lists them in.
	 */
	function firstWords() {
		const on = review.settings.decks;
		if (on.includes(FIRST_DECK)) return;
		const common = COMMON_DECKS.map((deck) => deck.id as string);
		review.change({
			decks: [...on.filter((id) => !common.includes(id)), ...common.filter((id) => id === FIRST_DECK || on.includes(id))]
		});
	}

	const share = (n: number, total: number) => (total ? (n / total) * 100 : 0);
</script>

<PageMeta title="{m.pageTitle.learn} · Nebokrai" description={m.meta.learn} />

<div class="ui-page page" class:waiting={!ready} class:newcomer={!started}>
	<!-- No heading on show: the lit tab says where this is, and the doors are
	     the page's first line. Kept for those who move about by headings. -->
	<h1 class="ui-sr-only">{m.pageTitle.learn}</h1>

	{#if !started}
		<div class="main">
			<!-- A newcomer: three steps in the order to take them. The step to
			     take now is the one with the filled button. -->
			<section class="ui-card first" aria-labelledby="learn-first">
				<div>
					<h2 id="learn-first">{m.learn.first.title}</h2>
					<p class="first-lead">{m.learn.first.lead}</p>
				</div>
				<ol class="path">
					<li data-kind="alphabet" class:done={lettersDone}>
						<span class="number" aria-hidden="true">
							{#if lettersDone}<Icon name="check" size={18} />{:else}1{/if}
						</span>
						<div class="path-text">
							<h3>{m.learn.first.letters.name}</h3>
							{#if lettersDone}
								<p>
									{m.learn.first.letters.done}
									{#if alphabet.skipped}
										<button type="button" class="skip" onclick={() => alphabet.skip(false)}>
											{m.learn.first.letters.undo}
										</button>
									{/if}
								</p>
							{:else}
								<p>{m.learn.first.letters.text(ALPHABET.length)}</p>
								{#if letters.known + letters.learning > 0}
									<p class="count">{m.learn.tile.letters(letters.known, ALPHABET.length)}</p>
									<span class="bar" aria-hidden="true">
										<i data-state="known" style:width="{share(letters.known, ALPHABET.length)}%"></i>
										<i data-state="learning" style:width="{share(letters.learning, ALPHABET.length)}%"></i>
									</span>
								{/if}
							{/if}
						</div>
						{#if !lettersDone}
							<div class="path-go">
								<a class="ui-btn ui-btn-primary" href="/alphabet">
									{m.learn.first.letters.go} <Icon name="arrow-right" size={16} />
								</a>
								<button type="button" class="skip" onclick={() => alphabet.skip(true)}>
									{m.learn.first.letters.skip}
								</button>
							</div>
						{/if}
					</li>
					<li data-kind="cards">
						<span class="number" aria-hidden="true">2</span>
						<div class="path-text">
							<h3>{m.learn.first.words.name}</h3>
							<p>{m.learn.first.words.text}</p>
						</div>
						<div class="path-go">
							<a class="ui-btn" class:ui-btn-primary={lettersDone} href="/review?start" onclick={firstWords}>
								{m.learn.first.words.go} <Icon name="arrow-right" size={16} />
							</a>
						</div>
					</li>
					<li data-kind="grammar">
						<span class="number" aria-hidden="true">3</span>
						<div class="path-text">
							<h3>{m.learn.first.grammar.name}</h3>
							<p>{m.learn.first.grammar.text}</p>
						</div>
						<div class="path-go">
							<a class="ui-btn" href="/practice">{m.learn.first.grammar.go} <Icon name="arrow-right" size={16} /></a>
						</div>
					</li>
				</ol>
			</section>
			<ReferenceTiles lettersKnown={letters.known} letters={ALPHABET.length} {ready} />
			{#if !saved.signedIn}<p class="kept">{m.review.kept}</p>{/if}
		</div>
	{:else}
		<aside class="rail">
			<StreakCard {now} {ready} />
			<ActivityCard {now} {ready} />
			<!-- Where all this is kept, for someone who has no account to keep it in -->
			{#if !saved.signedIn}<p class="kept">{m.review.kept}</p>{/if}
		</aside>

		<div class="main">
			<Doors {cardsDue} {wordsBegun} {rulesDue} {rulesBegun} onfirstwords={firstWords} />
			<VocabularyCard {now} {ready} />
			<GrammarCard {offered} {now} {ready} />
			<ReferenceTiles lettersKnown={letters.known} letters={ALPHABET.length} {ready} />
		</div>
	{/if}
</div>

<style>
	/* As wide as the header: the rail, and the column of what to do */
	.page {
		display: grid;
		grid-template-columns: 16rem minmax(0, 1fr);
		align-items: start;
		gap: 1.5rem;
		max-width: var(--frame-width);
		padding-block: 1rem 2rem;
	}

	.newcomer {
		grid-template-columns: minmax(0, 1fr);
	}

	.main,
	.rail {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 1.25rem;
	}

	.rail {
		gap: 1rem;
	}

	/* Which of the two faces to show, the newcomer's steps or the dashboard,
	   is known only when the browser's progress has been read: until then
	   neither is shown, so that a learner of months does not see "Start here"
	   flash by. Shown after two seconds whatever happens, for a browser
	   where the script never runs. */
	.waiting > :not(h1) {
		opacity: 0;
		animation: appear 0s 2s forwards;
	}

	@keyframes appear {
		to {
			opacity: 1;
		}
	}

	.kept {
		margin: 0;
		padding-inline: 0.25rem;
		color: var(--on-page);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	/* --- The newcomer's three steps --- */

	[data-kind='cards'] {
		--kind: var(--accent);
	}

	[data-kind='grammar'] {
		--kind: var(--pill-1-line);
	}

	[data-kind='alphabet'] {
		--kind: var(--pill-3-line);
	}

	.first {
		display: grid;
		gap: 1rem;
		padding: 1.2rem 1.25rem 1.25rem;
	}

	.first h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: var(--title);
		font-weight: 700;
		line-height: 1.25;
	}

	.first-lead {
		max-width: 38rem;
		margin: 0.35rem 0 0;
		color: var(--ink-2);
		font-size: var(--text-lg);
		line-height: 1.45;
	}

	.path {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A number in the kind's colour, what the step is, and its button */
	.path > li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.6rem 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		border-left: 5px solid var(--kind);
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}

	.number {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--kind);
		border-radius: 50%;
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.path-text {
		display: grid;
		gap: 0.25rem;
	}

	.path h3 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.path p {
		margin: 0;
		color: var(--ink-2);
		line-height: 1.45;
	}

	.path .count {
		font-size: var(--text-xs);
	}

	/* How far the letters have got: known in the alphabet's colour, being learnt a tint of it */
	.bar {
		display: flex;
		height: 0.45rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.bar [data-state='known'] {
		background: var(--kind);
	}

	.bar [data-state='learning'] {
		background: color-mix(in srgb, var(--kind) 42%, var(--surface-2));
	}

	.path-go {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
	}

	/* Done: put back, its number a tick */
	.path > .done {
		background: none;
	}

	.path > .done h3 {
		color: var(--muted);
	}

	.skip {
		position: relative;
		padding: 0.1rem 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	@media (hover: hover) {
		.skip:hover {
			color: var(--ink);
		}
	}

	/* Too narrow for the rail beside the column: it goes under it, its two
	   cards side by side while there is room for that */
	@media (max-width: 980px) {
		.page {
			grid-template-columns: minmax(0, 1fr);
		}

		.rail {
			grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
			order: 1;
		}
	}

	/* A phone: everything one under another */
	@media (max-width: 640px) {
		.page {
			gap: 1rem;
			padding-top: 0.9rem;
		}

		.first {
			padding: 0.8rem 0.8rem 0.9rem;
		}

		/* The button under what it is for */
		.path > li {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.path-go {
			grid-column: 2;
			justify-items: start;
		}
	}
</style>
