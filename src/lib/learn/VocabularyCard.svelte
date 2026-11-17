<!-- The words on /learn: how many are known out of every deck's words, and
     a chip for each deck, saying what is due in it today. A chip opens the
     flashcards on that deck alone (/review?deck=, ?list=); a dashed chip is
     a deck no new words come from, whose started words still come back
     unless it is paused, and "Manage decks" leads to the choice. Under the
     figure, once a word is known: how much of everyday Ukrainian the known
     words cover (src/lib/coverage.ts). -->
<script lang="ts">
	import { coverage, percent } from '#lib/coverage.ts';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { stateOf } from '#lib/practice/round.ts';
	import { plan } from '#lib/review/cards.ts';
	import { COMMON_DECKS, SAVED_DECK, listDeck, listOfDeck, wordsOfDeck } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import Tip from '#lib/Tip.svelte';

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
				// A list waits with the saved words when they are paused
				const paused = review.settings.paused.includes(listId ? SAVED_DECK : id);
				// With every saved word ticked, each list is ticked too
				const on = !paused && (review.settings.decks.includes(id) || (allSaved && listId !== null));
				const today = plan(review.cards, wordsOf(id), review.settings.new_per_day, now);
				return {
					id,
					name: listId ? (saved.lists.find((list) => list.id === listId)?.name ?? id) : m.review.deck[id],
					href: listId ? `/review?list=${listId}` : `/review?deck=${id}`,
					on,
					paused,
					// Ticked or not, its started words come back unless it is paused
					due: paused ? 0 : today.learning.length + today.due.length
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
			{#if covered?.knownWords}
				<p class="muted coverage">
					{coverageLine.head}<span class="tail">{coverageLine.tail}<Tip label={m.learn.coverageNote}>
							{#snippet trigger(props)}
								<button type="button" class="ui-icon-btn" aria-label={m.learn.coverageNote} {...props}><Icon name="help" size={16} /></button>
							{/snippet}
						</Tip></span>
				</p>
			{/if}
		</div>
		<ul class="chips">
			{#each decks as deck (deck.id)}
				<li>
					<a
						class="chip"
						class:off={!deck.on}
						class:none={deck.on && !deck.due}
						href={deck.href}
						title={deck.paused ? m.review.paused
							: [deck.due ? m.learn.due(deck.due) : '', deck.on ? '' : m.learn.off].filter(Boolean).join(' · ') || undefined}
					>
						{deck.name}
						{#if ready && deck.due}<em aria-hidden="true">{deck.due}</em>{/if}
						{#if ready && deck.due}<span class="ui-sr-only">({m.learn.due(deck.due)})</span>{/if}
						{#if !deck.on}<span class="ui-sr-only">({deck.paused ? m.review.paused : m.learn.off})</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
		{#if ready && review.start > 1}
			<!-- The placement test moved where the common words start -->
			<p class="muted start">
				<span title={m.path.startingNote}>{m.path.startingFrom(number(review.start))}</span> ·
				<a href="/placement">{m.path.retakeTest}</a>
			</p>
		{/if}
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

	/* The coverage line, under the figure and the bar */
	.coverage {
		grid-column: 1 / -1;
	}

	/* The last word and the help icon, kept on one line */
	.tail {
		white-space: nowrap;
	}

	/* Full-size to tap, but not stretching its line apart from the others */
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

	.start {
		margin: 0;
	}

	.start a {
		color: var(--accent);
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
