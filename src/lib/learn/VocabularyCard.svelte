<!-- The words on /learn: how many are known out of every deck's words, and
     a chip for each deck, saying what is due in it today. A chip opens the
     flashcards on that deck alone (/review?deck=, ?list=); a dashed chip is
     a deck not switched on, and "Manage decks" leads to the switches. -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { stateOf } from '#lib/practice/round.ts';
	import { plan } from '#lib/review/cards.ts';
	import { COMMON_DECKS, SAVED_DECK, listDeck, listOfDeck, wordsOfDeck } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let { now, ready }: { now: number; ready: boolean } = $props();

	const settings = useSettings();
	const saved = useSaved();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	let savedWords = $derived(saved.items.map((item) => item.word));
	const wordsOf = (deck: string) => wordsOfDeck(deck, savedWords, saved.lists, review.common);

	// As /review lists them: the saved words, each list of them, the common words
	let allSaved = $derived(review.settings.decks.includes(SAVED_DECK));
	let decks = $derived(
		[SAVED_DECK, ...saved.lists.map((list) => listDeck(list.id)), ...COMMON_DECKS.map((deck) => deck.id as string)]
			.map((id) => {
				const listId = listOfDeck(id);
				// With every saved word switched on, each list is on too
				const on = review.settings.decks.includes(id) || (allSaved && listId !== null);
				const today = plan(review.cards, wordsOf(id), review.settings.new_per_day, now);
				return {
					id,
					name: listId ? (saved.lists.find((list) => list.id === listId)?.name ?? id) : m.review.deck[id],
					href: listId ? `/review?list=${listId}` : `/review?deck=${id}`,
					on,
					due: on ? today.learning.length + today.due.length : 0
				};
			})
	);

	// Every word of every deck, once, switched on or not. A deck of common
	// words not yet fetched is counted by its size until it comes.
	let counts = $derived.by(() => {
		const pool = new Set(decks.flatMap((deck) => wordsOf(deck.id)));
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

	// A thousand is written 1,000 in English and 1000 in Ukrainian
	const number = (n: number) => (settings.lang === 'uk' ? String(n) : n.toLocaleString('en'));
	const share = (n: number) => (counts.total ? Math.max(n ? 1.5 : 0, (n / counts.total) * 100) : 0);
</script>

<section class="part" aria-labelledby="learn-vocabulary">
	<div class="head">
		<h2 id="learn-vocabulary">{m.learn.vocabulary}</h2>
		<a class="more" href="/review#decks">{m.learn.manageDecks} <Icon name="arrow-right" size={16} /></a>
	</div>
	<div class="ui-card card">
		<div class="sum">
			<p>
				<span class="figure">{ready ? counts.known : '–'}</span>
				{#if ready}
					<span class="muted">{m.learn.wordsKnown(number(counts.total))} · {m.learn.learning(counts.learning)}</span>
				{/if}
			</p>
			<span class="bar" aria-hidden="true">
				{#if ready}
					<i class="known" style:width="{share(counts.known)}%"></i>
					<i class="learning" style:width="{share(counts.learning)}%"></i>
				{/if}
			</span>
		</div>
		<ul class="chips">
			{#each decks as deck (deck.id)}
				<li>
					<a
						class="chip"
						class:off={!deck.on}
						class:none={deck.on && !deck.due}
						href={deck.href}
						title={deck.on ? (deck.due ? m.learn.due(deck.due) : undefined) : m.learn.off}
					>
						{deck.name}
						{#if ready && deck.due}<em aria-hidden="true">{deck.due}</em>{/if}
						{#if !deck.on}<span class="ui-sr-only">({m.learn.off})</span>
						{:else if ready && deck.due}<span class="ui-sr-only">({m.learn.due(deck.due)})</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
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

	.more {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.card {
		display: grid;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
	}

	/* The figure and its words, and the bar beside them taking the rest of the line */
	.sum {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.4rem 1.25rem;
	}

	.sum p {
		margin: 0;
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

	.bar {
		display: flex;
		height: 0.45rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
	}

	.bar .known {
		background: var(--accent);
	}

	.bar .learning {
		background: color-mix(in srgb, var(--accent) 45%, var(--surface));
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A deck's name and, in a blue disc, what is due in it today */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.4rem 0.3rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}

	.chip em {
		min-width: 1.3rem;
		padding: 0 0.35rem;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: var(--text-xs);
		font-style: normal;
		font-weight: 700;
		line-height: 1.5;
		text-align: center;
	}

	/* Switched on, nothing due today */
	.chip.none {
		padding-right: 0.75rem;
		color: var(--ink-2);
	}

	/* Not switched on: dashed, and no figure */
	.chip.off {
		padding-right: 0.75rem;
		border-style: dashed;
		background: none;
		color: var(--muted);
	}

	@media (hover: hover) {
		.chip:hover {
			border-color: var(--accent);
		}
	}

	@media (max-width: 640px) {
		.sum {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
