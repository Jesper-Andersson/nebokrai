<!-- The two doors at the head of /learn: flashcards and grammar, each with
     what it has waiting and its button, on one line. One not yet begun
     says so in place of a count of nothing. -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		cardsDue,
		wordsBegun,
		rulesDue,
		rulesBegun,
		onfirstwords
	}: {
		/** Cards on a learning step or due today, in the decks switched on. */
		cardsDue: number;
		wordsBegun: boolean;
		rulesDue: number;
		rulesBegun: boolean;
		/** Before /review?start: switch on a deck to begin with. */
		onfirstwords: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
</script>

<div class="doors">
	<a
		class="ui-card door"
		data-kind="cards"
		href={wordsBegun ? '/review' : '/review?start'}
		onclick={wordsBegun ? undefined : onfirstwords}
	>
		<span class="kind"><Icon name="cards" size={15} /> {m.learn.kind.cards}</span>
		<strong>
			{!wordsBegun ? m.learn.action.notStarted : cardsDue ? m.learn.action.cardsDue(cardsDue) : m.learn.action.cardsNone}
		</strong>
		<span class="go">
			{wordsBegun ? m.learn.action.cardsGo : m.learn.first.words.go} <Icon name="arrow-right" size={16} />
		</span>
	</a>
	<a class="ui-card door" data-kind="grammar" href="/practice">
		<span class="kind"><Icon name="book" size={15} /> {m.learn.kind.grammar}</span>
		<strong>
			{!rulesBegun ? m.learn.action.notStarted : rulesDue ? m.learn.action.rulesDue(rulesDue) : m.learn.action.rulesNone}
		</strong>
		<span class="go">{m.learn.action.rulesGo} <Icon name="arrow-right" size={16} /></span>
	</a>
</div>

<style>
	.doors {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	[data-kind='cards'] {
		--kind: var(--accent);
	}

	[data-kind='grammar'] {
		--kind: var(--pill-1-line);
	}

	/* The kind over what it has waiting, and the button beside both */
	.door {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'kind go' 'big go';
		align-items: center;
		gap: 0.1rem 0.75rem;
		padding: 0.6rem 0.8rem 0.65rem;
		border-left: 5px solid var(--kind);
		color: inherit;
		text-decoration: none;
	}

	/* The name of the kind, with a square of its colour before it, so that
	   the name itself stays ink */
	.kind {
		grid-area: kind;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.kind::before {
		content: '';
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 3px;
		background: var(--kind);
	}

	strong {
		grid-area: big;
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.go {
		grid-area: go;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.65rem;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	@media (hover: hover) {
		/* The door's own edge keeps its kind's colour */
		.door:hover {
			border-color: var(--accent);
			border-left-color: var(--kind);
		}

		.door:hover .go {
			background: var(--link-hover);
		}
	}

	@media (max-width: 640px) {
		.doors {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.75rem;
		}
	}
</style>
