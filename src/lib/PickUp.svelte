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
		<ul>
			{#if wordsBegun}
				<li>
					<b>{m.learn.kind.cards}</b>
					<span>{cardsDue ? m.learn.action.cardsDue(cardsDue) : m.learn.action.cardsNone}</span>
					<a href="/review">{m.learn.action.cardsGo} <Icon name="arrow-right" size={16} /></a>
				</li>
			{/if}
			{#if rules.length}
				<li>
					<b>{m.learn.kind.grammar}</b>
					<span>{rulesDue ? m.learn.action.rulesDue(rulesDue) : m.learn.action.rulesNone}</span>
					<a href="/practice">{m.learn.action.rulesGo} <Icon name="arrow-right" size={16} /></a>
				</li>
			{/if}
			{#if savedCount}
				<li>
					<b>{m.pageTitle.saved}</b>
					<span>{m.home.savedCount(savedCount)}</span>
					<a href="/saved">{m.home.savedGo} <Icon name="arrow-right" size={16} /></a>
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

	ul {
		margin: 0.4rem 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		padding: 0.7rem 0;
		border-top: 1px solid var(--border);
	}

	/* The three names in one column, so what waits lines up under them */
	b {
		min-width: 11rem;
	}

	span {
		flex: 1;
		color: var(--ink-2);
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	a:hover {
		color: var(--link-hover);
	}

	/* On a phone: the name and the way in on one line, what waits under them */
	@media (max-width: 600px) {
		li {
			flex-wrap: wrap;
		}

		b {
			flex: 1;
			min-width: 0;
		}

		span {
			order: 1;
			flex-basis: 100%;
			font-size: var(--text-sm);
		}
	}
</style>
