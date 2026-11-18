<!-- /learn, as the user picked it in Figma on 2026-11-18 ("B" for a
     newcomer, "B4a merged" for the dashboard).

     A newcomer, who has reviewed nothing and taken no placement test, is
     asked where they start from: three answers, each a whole row that leads
     where that learner should begin (the letters, the first words, the
     placement test).

     The dashboard: a narrow rail for what is about the learner (the week
     and the last fortnight's reviews), and a wide column for what to do.
     Vocabulary opens with the cards due; Grammar points open with the lesson
     to practise next, then the points themselves, each a link to its page.
     The levelled path is there only for a learner who asks for it (a choice
     kept in this browser): some learn in their own order.

     Nothing new is stored but that choice: words and rules are flashcards
     (review.svelte.ts), the letters are the alphabet drill's boxes
     (alphabet.svelte.ts), and all of it is in the browser, so the server
     renders the frame and the figures arrive when the page has loaded. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import LoginButton from '#lib/LoginButton.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { Alphabet } from '#lib/alphabet.svelte.ts';
	import { stateOf as letterState } from '#lib/alphabet/drill.ts';
	import { APOSTROPHE, LETTERS } from '#lib/alphabet/letters.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import ActivityCard from '#lib/learn/ActivityCard.svelte';
	import GoalCard from '#lib/learn/GoalCard.svelte';
	import GrammarPoints from '#lib/learn/GrammarPoints.svelte';
	import PathCard from '#lib/learn/PathCard.svelte';
	import ReferenceTiles from '#lib/learn/ReferenceTiles.svelte';
	import VocabularyCard from '#lib/learn/VocabularyCard.svelte';
	import { POINTS, cardKey, isPointKey } from '#lib/practice/points.ts';
	import { plan } from '#lib/review/cards.ts';
	import { COMMON_DECKS, newWords, reviewWords } from '#lib/review/decks.ts';
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

	/** Whether the learner asked for the levelled path: kept in this browser alone. */
	const FOLLOW_KEY = 'path-follow';
	let following = $state(false);

	onMount(() => {
		void review.load();
		// All three, switched on or not: the words known count them all
		review.fetchDecks(COMMON_DECKS.map((deck) => deck.id));
		alphabet.load();
		try {
			following = localStorage.getItem(FOLLOW_KEY) === 'on';
		} catch {
			// Storage blocked: the path stays away, and can be shown for this visit
		}
		const tick = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(tick);
	});

	function follow(on: boolean) {
		following = on;
		try {
			if (on) localStorage.setItem(FOLLOW_KEY, 'on');
			else localStorage.removeItem(FOLLOW_KEY);
		} catch {
			// Kept for this visit only
		}
	}

	// Until then every figure would be a nought that is not true
	let ready = $derived(review.ready && saved.ready && alphabet.ready);

	// --- Flashcards: the words ---

	let savedWords = $derived(saved.items.map((item) => item.word));
	/** As /review counts them, and the header: reviews from every deck not paused, new words from the ones ticked. */
	let cardsToday = $derived(plan(
		review.cards, reviewWords(review.settings, savedWords, saved.lists, review.common), review.settings.new_per_day, now,
		newWords(review.settings, savedWords, saved.lists, review.common, review.start)));
	let wordsBegun = $derived([...review.cards.keys()].some((key) => !isPointKey(key)));

	// --- Grammar: the rules ---

	// A rule with no sentences is never asked (/practice leaves it out too)
	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]).map((point) => point.id));
	let rulesBegun = $derived(offered.map(cardKey).some((key) => review.cards.has(key)));

	// --- The letters ---

	// The 33 a learner has heard of: the drill also asks the apostrophe, which
	// is a sign and no letter, and "34 letters" sent a newcomer to check.
	const ALPHABET = LETTERS.filter(({ letter }) => letter !== APOSTROPHE);

	let letters = $derived.by(() => {
		const counts = { new: 0, learning: 0, known: 0 };
		for (const { letter } of ALPHABET) counts[letterState(alphabet.progress[letter])] += 1;
		return counts;
	});

	// A newcomer has reviewed nothing: no card, no rule, no day, no placement
	// test. The test counts (2026-11-18): the third answer below leads to it,
	// and a learner it has placed has somewhere to start. The letters do not
	// count, being where a newcomer starts.
	let placed = $derived((review.progress.placement?.results.length ?? 0) > 0);
	let started = $derived(wordsBegun || rulesBegun || placed || Object.keys(review.days).length > 0);

	const FIRST_DECK = COMMON_DECKS[0].id;

	/**
	 * Before following a link to /review?start: switch on the deck of the 500
	 * commonest words, so that there the first card comes up with no deck to
	 * find and no second button. The decks keep the order /review lists them in.
	 */
	function firstWords() {
		const on = review.settings.decks;
		const paused = review.settings.paused;
		if (on.includes(FIRST_DECK) && !paused.includes(FIRST_DECK)) return;
		const common = COMMON_DECKS.map((deck) => deck.id as string);
		review.change({
			decks: [...on.filter((id) => !common.includes(id)), ...common.filter((id) => id === FIRST_DECK || on.includes(id))],
			paused: paused.filter((id) => id !== FIRST_DECK)
		});
	}

	/** The second answer: the letters are read already, so straight to the first words. */
	function readsCyrillic() {
		alphabet.skip(true);
		firstWords();
	}
</script>

<PageMeta title="{m.pageTitle.learn} · Nebokrai" description={m.meta.learn} />

<!-- Where the reviews are kept, and the Log in button that keeps them in an
     account (user, 2026-11-16). Where accounts are not set up there is no
     button, and the note does not ask the visitor to log in. -->
{#snippet keptHere()}
	{#if !saved.signedIn}
		<div class="kept">
			{#if data.providers?.length}
				<p>{m.account.keptReviews}</p>
				<LoginButton />
			{:else}
				<p>{m.review.kept}</p>
			{/if}
		</div>
	{/if}
{/snippet}

<!-- One answer to "where are you starting from?": the whole row is the link -->
{#snippet choice(href: string, name: string, text: string, mark: 'letters' | 'cards' | 'list', onclick?: () => void)}
	<li>
		<a class="choice" {href} {onclick}>
			<span class="mark" data-mark={mark} aria-hidden="true">
				{#if mark === 'letters'}<span class="letters" lang="uk">АБВ</span>{:else}<Icon name={mark} size={22} />{/if}
			</span>
			<span class="choice-text">
				<b>{name}</b>
				<span>{text}</span>
			</span>
			<Icon name="arrow-right" size={22} />
		</a>
	</li>
{/snippet}

<div class={['ui-page page', { waiting: !ready, newcomer: !started }]}>
	{#if !started}
		<div class="main start">
			<div>
				<h1 class="title">{m.learn.start.title}</h1>
				<p class="lead">{m.learn.start.lead}</p>
			</div>
			<ul class="choices">
				{@render choice('/alphabet', m.learn.start.fresh.name, m.learn.start.fresh.text(ALPHABET.length), 'letters')}
				{@render choice('/review?start', m.learn.start.reads.name, m.learn.start.reads.text, 'cards', readsCyrillic)}
				{@render choice('/placement', m.learn.start.knows.name, m.learn.start.knows.text, 'list')}
			</ul>
			<p class="browse">
				{m.learn.start.browse}
				<!-- "flashcards, a grammar round or a story", or with no stories "flashcards or a grammar round" -->
				<a href="/review">{m.learn.start.flashcards}</a>{data.stories ? ', ' : ` ${m.learn.start.or} `}<a
					href="/practice">{m.learn.start.round}</a>{data.stories ? ` ${m.learn.start.or} ` : ''}{#if data.stories}<a
						href="/read">{m.learn.start.story}</a>{/if}.
			</p>
			<ReferenceTiles lettersKnown={letters.known} letters={ALPHABET.length} stories={data.stories} {ready} />
			{@render keptHere()}
		</div>
	{:else}
		<!-- No heading on show: the lit tab says where this is. Kept for those
		     who move about by headings. -->
		<h1 class="ui-sr-only">{m.pageTitle.learn}</h1>
		<aside class="rail">
			<!-- Where all this is kept, for someone who has no account to keep it
			     in: first in the rail, and first on a phone (user, 2026-11-16) -->
			{@render keptHere()}
			<div class="goal-slot"><GoalCard {now} {ready} /></div>
			<div class="activity-slot"><ActivityCard {now} {ready} /></div>
		</aside>

		<div class="main">
			{#if following}
				<div class="path-slot">
					<PathCard {now} {ready} {offered} letters={{ known: letters.known, total: ALPHABET.length, skipped: alphabet.skipped }}
						onskipletters={() => alphabet.skip(true)} onhide={() => follow(false)} />
				</div>
			{:else}
				<p class="plan path-slot">
					{m.learn.plan.ask}
					<button type="button" class="link" onclick={() => follow(true)}>{m.learn.plan.follow}</button>:
					{m.learn.plan.about}
				</p>
			{/if}
			<div class="vocab-slot"><VocabularyCard {now} {ready} today={cardsToday} onlearnnew={firstWords} /></div>
			<div class="grammar-slot"><GrammarPoints {offered} {now} {ready} /></div>
			<div class="reference-slot">
				<ReferenceTiles lettersKnown={letters.known} letters={ALPHABET.length} stories={data.stories} {ready} />
			</div>
		</div>
	{/if}
</div>

<style>
	/* As wide as the header: the rail, and the column of what to do */
	.page {
		display: grid;
		grid-template-columns: 16rem minmax(0, 1fr);
		align-items: start;
		gap: 1.5rem 2.25rem;
		max-width: var(--frame-width);
		padding-block: 1rem 2rem;
	}

	/* A newcomer's page is one column, at a width for reading */
	.newcomer {
		grid-template-columns: minmax(0, 48rem);
		justify-content: center;
	}

	.main,
	.rail {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 1.75rem;
	}

	.rail {
		gap: 1rem;
	}

	/* Which of the two faces to show, the newcomer's question or the
	   dashboard, is known only when the browser's progress has been read:
	   until then neither is shown, so that a learner of months does not see
	   the question flash by. Shown after two seconds whatever happens, for a
	   browser where the script never runs. */
	.waiting > :not(h1) {
		opacity: 0;
		animation: appear 0s 2s forwards;
	}

	@keyframes appear {
		to {
			opacity: 1;
		}
	}

	/* The note with a small Log in button beside it, on one line where there
	   is room (user, 2026-11-16); in the narrow rail the button wraps under */
	.kept {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.9rem;
		padding-inline: 0.25rem;
	}

	.kept :global(.ui-btn) {
		padding-block: 0.3rem;
		font-size: var(--text-sm);
	}

	.kept p {
		flex: 1 1 14rem;
		margin: 0;
		color: var(--on-page);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	/* --- A newcomer: where are you starting from? --- */

	.start {
		gap: 1.5rem;
	}

	/* The newcomer's note goes to the foot, under a rule */
	.start .kept {
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.title {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: var(--title);
		font-weight: 700;
		line-height: 1.2;
	}

	.lead {
		max-width: 38rem;
		margin: 0.5rem 0 0;
		color: var(--on-page);
		font-size: var(--text-lg);
		line-height: 1.5;
	}

	.choices {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A whole row to press: what the answer leads to, and an arrow */
	.choice {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		min-height: 4.5rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--ink);
		text-decoration: none;
		transition: border-color var(--duration);
	}

	/* The first answer is the commonest: drawn out a little */
	.choices li:first-child .choice {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	@media (hover: hover) {
		.choice:hover {
			border-color: var(--accent);
		}

		.choice:hover b {
			color: var(--accent);
		}
	}

	.choice:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.choice > :global(svg:last-child) {
		color: var(--muted);
	}

	.choice-text {
		display: grid;
		gap: 0.15rem;
	}

	.choice-text b {
		font-size: var(--text-lg);
		line-height: 1.3;
	}

	.choice-text span {
		color: var(--ink-2);
		line-height: 1.45;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-md);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.mark[data-mark='list'] {
		background: var(--surface-2);
		color: var(--ink-2);
	}

	.letters {
		font-family: var(--font-headword);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.browse,
	.plan {
		margin: 0;
		color: var(--on-page);
		line-height: 1.5;
	}

	.browse a,
	.link {
		color: var(--accent);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	/* "Follow the path": a button, as it changes the page and goes nowhere */
	.link {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
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
			gap: 1.25rem;
			padding-top: 0.9rem;
		}

		/* The two boxes dissolve, so that their cards are ordered as one
		   column: the note first, then what to do, the week, the activity,
		   and the pages for reading at the foot */
		.rail,
		.main:not(.start) {
			display: contents;
		}

		.kept {
			order: -3;
		}

		.path-slot,
		.vocab-slot,
		.grammar-slot {
			order: -2;
		}

		.goal-slot {
			order: -1;
		}

		.activity-slot {
			order: 1;
		}

		.reference-slot {
			order: 2;
		}

		.start .kept {
			order: 0;
		}

		.choice {
			gap: 0.75rem;
			padding: 0.85rem 0.9rem;
		}

		.lead {
			font-size: var(--text-md);
		}
	}
</style>
