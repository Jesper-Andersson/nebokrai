<!-- The words on /learn, as one card (user's pick in Figma, "B4a merged",
     2026-11-18): on top the cards due today, with the first few words and
     the button that reviews them; under them how many words are known out
     of every deck's words, how much of everyday Ukrainian the known words
     cover (src/lib/coverage.ts), and the way to new words. The decks are
     chosen on /review ("Choose decks"); the card no longer lists them. -->
<script lang="ts">
	import { coverage, percent } from '#lib/coverage.ts';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { stateOf } from '#lib/practice/round.ts';
	import type { Plan } from '#lib/review/cards.ts';
	import { COMMON_DECKS, SAVED_DECK, listDeck, wordsOfDeck } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import Tip from '#lib/Tip.svelte';

	let {
		now,
		ready,
		today,
		onlearnnew
	}: {
		now: number;
		ready: boolean;
		/** Today's reviews, as /review and the header count them (plan in review/cards.ts). */
		today: Plan;
		/** Before /review?start: makes sure there is a deck new words come from. */
		onlearnnew: () => void;
	} = $props();

	const settings = useSettings();
	const saved = useSaved();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	/** The words due, soonest first: those on a learning step come back within minutes. */
	let dueCards = $derived([...today.learning, ...today.due]);
	const SHOWN_WORDS = 3;
	let dueLine = $derived(m.learn.vocab.dueWords(
		dueCards.slice(0, SHOWN_WORDS).map((card) => card.word).join(', '), Math.max(0, dueCards.length - SHOWN_WORDS)));

	let savedWords = $derived(saved.items.map((item) => item.word));
	const wordsOf = (deck: string) => wordsOfDeck(deck, savedWords, saved.lists, review.common);

	// Every word of every deck, once, switched on or not. A deck of common
	// words not yet fetched is counted by its size until it comes.
	let counts = $derived.by(() => {
		const decks = [SAVED_DECK, ...saved.lists.map((list) => listDeck(list.id)), ...COMMON_DECKS.map((deck) => deck.id as string)];
		const pool = new Set(decks.flatMap(wordsOf));
		let total = pool.size;
		for (const deck of COMMON_DECKS) if (!review.common.has(deck.id)) total += deck.to - deck.from + 1;
		let known = 0;
		let learning = 0;
		for (const word of pool) {
			const state = stateOf(review.cards.get(word), now);
			if (state === 'known') known += 1;
			else if (state !== 'new') learning += 1;
		}
		return { known, learning, total };
	});

	// The table for the coverage figure is fetched only once there is a word
	// card to weigh; grammar cards weigh nothing.
	let hasWordCard = $derived([...review.cards.keys()].some((key) => !key.startsWith('grammar:')));
	$effect(() => {
		if (ready && hasWordCard) review.fetchFrequency();
	});
	let covered = $derived(ready && review.frequency ? coverage(review.frequency, review.cards, now) : null);
	let coveredKnown = $derived(covered ? percent(covered.known) : 0);
	// What the words being learnt add once they are known too
	let coveredGain = $derived(covered ? percent(covered.known + covered.learning) - coveredKnown : 0);
	// The line split before its last word, which stays on one line with the
	// help icon, so on a phone the icon never wraps alone («… ~12% | української ?»)
	let coverageLine = $derived.by(() => {
		const text = m.learn.coverage(coveredKnown) + (coveredGain > 0 ? ` · ${m.learn.coverageLearning(coveredGain)}` : '');
		const cut = text.lastIndexOf(' ') + 1;
		return { head: text.slice(0, cut), tail: text.slice(cut) };
	});

	// A thousand is written 1,000 in English and 1000 in Ukrainian
	const number = (n: number) => (settings.lang === 'uk' ? String(n) : n.toLocaleString('en'));
	const share = (n: number) => (counts.total ? Math.max(n ? 1.5 : 0, (n / counts.total) * 100) : 0);
</script>

<section class="part" aria-labelledby="learn-vocabulary">
	<div class="head">
		<h2 id="learn-vocabulary">{m.learn.vocabulary}</h2>
		<a class="more" href="/review#decks">{m.learn.vocab.chooseDecks}</a>
	</div>
	<div class="ui-card card">
		<div class="due">
			<span class="mark" aria-hidden="true"><Icon name="cards" size={24} /></span>
			<div class="due-text">
				<p class="due-count">
					{#if !ready}–{:else if dueCards.length}{m.learn.action.cardsDue(dueCards.length)}{:else}{m.learn.action.cardsNone}{/if}
				</p>
				{#if ready && dueCards.length}<p class="muted">{dueLine}</p>{/if}
			</div>
			{#if ready && dueCards.length}
				<a class="ui-btn ui-btn-primary" href="/review">{m.learn.vocab.reviewNow} <Icon name="arrow-right" size={16} /></a>
			{/if}
		</div>
		<div class="known">
			<div class="sum">
				<p>
					<span class="figure">{ready ? counts.known : '–'}</span>
					{#if ready}
						<span class="muted">{m.learn.wordsKnown(number(counts.total))} · {m.learn.learning(counts.learning)}</span>
					{/if}
				</p>
				<span class="bar" aria-hidden="true">
					{#if ready}
						<i class="known-part" style:width="{share(counts.known)}%"></i>
						<i class="learning-part" style:width="{share(counts.learning)}%"></i>
					{/if}
				</span>
				{#if covered?.knownWords}
					<p class="muted">
						{coverageLine.head}<span class="tail">{coverageLine.tail}<Tip label={m.learn.coverageNote}>
								{#snippet trigger(props)}
									<button type="button" class="ui-icon-btn" aria-label={m.learn.coverageNote} {...props}><Icon name="help" size={16} /></button>
								{/snippet}
							</Tip></span>
					</p>
				{/if}
				{#if ready && review.start > 1}
					<!-- The placement test moved where the common words start -->
					<p class="muted">
						<span title={m.path.startingNote}>{m.path.startingFrom(number(review.start))}</span> ·
						<a href="/placement">{m.path.retakeTest}</a>
					</p>
				{/if}
			</div>
			<div class="actions">
				{#if review.settings.new_per_day > 0}
					<a class="ui-btn" href="/review?start" onclick={onlearnnew}>
						{m.learn.vocab.learnNew(review.settings.new_per_day)} <Icon name="arrow-right" size={16} />
					</a>
				{/if}
				<a class="browse" href="/common-words">{m.learn.vocab.browse}</a>
			</div>
		</div>
	</div>
</section>

<style>
	.part {
		display: grid;
		gap: 0.6rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.15;
	}

	.more,
	.browse {
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		white-space: nowrap;
	}

	.card {
		display: grid;
		padding: 0;
	}

	/* The cards due: the one thing to do now, on top */
	.due {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
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

	.due-text p {
		margin: 0;
	}

	.due-count {
		font-family: var(--font-heading);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1.25;
	}

	/* The words known, and the way to new ones beside them */
	.known {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem 2rem;
		padding: 1rem 1.25rem 1.1rem;
	}

	.sum {
		display: grid;
		gap: 0.5rem;
	}

	.sum p {
		margin: 0;
	}

	/* The last word and the help icon, kept on one line */
	.tail {
		white-space: nowrap;
	}

	.tail .ui-icon-btn {
		margin-block: -0.75rem;
		vertical-align: middle;
	}

	.figure {
		font-family: var(--font-headword);
		font-size: 1.5rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.muted a {
		color: var(--accent);
	}

	.bar {
		display: flex;
		height: 0.45rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
	}

	.known-part {
		background: var(--accent);
	}

	.learning-part {
		background: color-mix(in srgb, var(--accent) 45%, var(--surface));
	}

	.actions {
		display: grid;
		justify-items: start;
		gap: 0.6rem;
	}

	@media (max-width: 640px) {
		.due {
			grid-template-columns: auto minmax(0, 1fr);
			padding: 0.9rem 1rem;
		}

		.due .ui-btn {
			grid-column: 1 / -1;
			justify-content: center;
		}

		.known {
			grid-template-columns: minmax(0, 1fr);
			padding: 0.9rem 1rem 1rem;
		}
	}
</style>
