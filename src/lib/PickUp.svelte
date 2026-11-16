<!-- "Pick up where you left off", under the word of the day on the search
     page: a line each for the flashcards, the grammar rules and the saved
     words, with what is waiting there and the way in.

       Flashcards        12 cards to review     Review →
       Grammar           3 rules to practise    Practise →
       Saved words       34 words               Open →

     Only for someone who has been here before: a line is shown once its part
     has been begun, and with none begun there is no heading either, so a
     newcomer's page is the search box and the word of the day as before.

     Nothing is asked of the server for it. The counts are the ones the header
     and /learn show, from what this browser holds (review.svelte.ts,
     saved.svelte.ts), so they arrive when the page has loaded. Ruled lines on
     the page, with no frame: the word of the day above is the page's one card. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { isPointKey } from '#lib/practice/points.ts';
	import { plan } from '#lib/review/cards.ts';
	import { reviewWords } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	const review = useReview();
	const saved = useSaved();
	let m = $derived(messagesFor(settings.lang));

	// Set in the browser only: the server knows of no card, and a time of its
	// own would not match the browser's
	let now = $state(0);
	onMount(() => {
		now = Date.now();
	});

	let keys = $derived([...review.cards.keys()]);
	let wordsBegun = $derived(keys.some((key) => !isPointKey(key)));
	let rules = $derived(keys.filter(isPointKey));

	/** As the header counts them: on a learning step or due, in every deck not paused. New words wait and are not counted. */
	let cardsDue = $derived.by(() => {
		if (!now || !wordsBegun || !saved.ready) return 0;
		const words = reviewWords(review.settings, saved.items.map((item) => item.word), saved.lists, review.common);
		const today = plan(review.cards, words, 0, now);
		return today.learning.length + today.due.length;
	});
	let rulesDue = $derived(rules.filter((key) => (review.cards.get(key)?.due ?? Infinity) <= now).length);
	let savedCount = $derived(saved.ready ? saved.items.length : 0);

	let shown = $derived(now > 0 && (wordsBegun || rules.length > 0 || savedCount > 0));
</script>

{#if shown}
	<section class="ui-page" aria-labelledby="pick-up">
		<h2 class="ui-label" id="pick-up">{m.home.pickUp}</h2>
		<!-- Each line is one link from edge to edge: the name, what waits, and
		     where it goes. Only "Review →" was a link until 2026-11-16, a small
		     thing to hit at the far end of a wide line. -->
		<ul>
			{#if wordsBegun}
				<li>
					<a href="/review">
						<b>{m.learn.kind.cards}</b>
						<span class="waits">{cardsDue ? m.learn.action.cardsDue(cardsDue) : m.learn.action.cardsNone}</span>
						<span class="go">{m.learn.action.cardsGo} <Icon name="arrow-right" size={16} /></span>
					</a>
				</li>
			{/if}
			{#if rules.length}
				<li>
					<a href="/practice">
						<b>{m.learn.kind.grammar}</b>
						<span class="waits">{rulesDue ? m.learn.action.rulesDue(rulesDue) : m.learn.action.rulesNone}</span>
						<span class="go">{m.learn.action.rulesGo} <Icon name="arrow-right" size={16} /></span>
					</a>
				</li>
			{/if}
			{#if savedCount}
				<li>
					<a href="/saved">
						<b>{m.pageTitle.saved}</b>
						<span class="waits">{m.home.savedCount(savedCount)}</span>
						<span class="go">{m.home.savedGo} <Icon name="arrow-right" size={16} /></span>
					</a>
				</li>
			{/if}
		</ul>
	</section>
{/if}

<style>
	/* As wide as the search box and the word of the day above it */
	section {
		max-width: var(--search);
		margin-top: 1.5rem;
	}

	/* No rule after the heading here: a rule in this list stands between two
	   entries and nowhere else. With the heading's and the first entry's, one
	   entry alone had two lines over it and nothing to part (user, 2026-11-16). */
	h2::after {
		content: none;
	}

	ul {
		margin: 0.15rem 0 0;
		padding: 0;
		list-style: none;
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	a {
		display: flex;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		padding: 0.7rem 0;
		color: inherit;
		text-decoration: none;
	}

	/* The three names in one column, so what waits lines up under them */
	b {
		min-width: 11rem;
	}

	.waits {
		flex: 1;
		color: var(--ink-2);
	}

	.go {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	@media (hover: hover) {
		a:hover .go {
			color: var(--link-hover);
		}

		a:hover b {
			color: var(--accent);
		}
	}

	/* On a phone: the name and the way in on one line, what waits under them */
	@media (max-width: 600px) {
		a {
			flex-wrap: wrap;
		}

		b {
			flex: 1;
			min-width: 0;
		}

		.waits {
			order: 1;
			flex-basis: 100%;
			font-size: var(--text-sm);
		}
	}
</style>
