<!-- One search result. The headword and the arrow both lead to the word's
     page; the meanings stay plain text so they can be selected and copied.
     How common the word is stands at the right end of the grammar line, as
     it does on the word's own page. A result found through an inflected form
     says which form along its lower edge:

       Form found: руки́ genitive singular · ру́ки nominative, accusative, vocative plural -->
<script lang="ts">
	import { groupMatched } from '#lib/forms.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import type { SearchResult } from '#lib/search/search.ts';
	import type { Suggestion } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';
	import { mergeProps } from 'bits-ui';
	import FrequencyMeter from './FrequencyMeter.svelte';
	import Grammar from './Grammar.svelte';
	import Headword from './Headword.svelte';
	import Icon from './Icon.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import SaveButton from './SaveButton.svelte';
	import Stressed from './Stressed.svelte';
	import Tip from './Tip.svelte';

	let { entry }: { entry: SearchResult | Suggestion } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let shown = $derived(entry.glosses.slice(0, 3));
	// A VESUM-only word has no entry, so nothing to save or open.
	let vesumOnly = $derived('vesum_only' in entry && entry.vesum_only === true);
	// Present when the query was an inflected form of this word. Empty when
	// only VESUM knew that: it tells the word, not which of its forms.
	let matched = $derived('matched_forms' in entry && entry.matched_forms ? groupMatched(entry.matched_forms) : null);

	function speak() {
		const utterance = new SpeechSynthesisUtterance(entry.word);
		utterance.lang = 'uk-UA';
		speechSynthesis.speak(utterance);
	}
</script>

<article class="ui-card" class:plain={vesumOnly}>
	<div class="word">
		<Headword text={entry.headword} href={vesumOnly ? undefined : wordPath(entry.word)} />
		<Tip label={m.card.play}>
			{#snippet trigger(props)}
				<button
					{...mergeProps(props, { onclick: speak })}
					type="button"
					class="ui-icon-btn play"
					aria-label={m.card.play}
				>
					<Icon name="speaker" size={20} />
				</button>
			{/snippet}
		</Tip>
	</div>

	<div class="meta"><Grammar pos={entry.pos} tags={entry.tags} headForms={entry.head_forms} brief /></div>

	<div class="glosses">
		{#if vesumOnly}
			<i>{m.card.noEntry}</i>
		{:else}
			<!-- The semicolons are text, the numerals are not: copied, the line
			     reads "coffee; coffee tree" -->
			<ol class="ui-senses inline">
				{#each shown as gloss, i (i)}<li>{gloss}{#if i < shown.length - 1};{/if}</li>{' '}{/each}
			</ol>
		{/if}
	</div>

	{#if !vesumOnly}
		<div class="freq"><FrequencyMeter rank={entry.freq_rank} /></div>

		<div class="actions">
			<SaveButton word={entry.word} headword={entry.headword} size={20} />
			<a class="ui-icon-btn" href={wordPath(entry.word)} aria-label={m.card.details} title={m.card.details}>
				<Icon name="chevron-right" size={20} />
			</a>
		</div>
	{/if}

	{#if matched}
		<p class="found">
			{#if matched.groups.length}
				{m.card.formFound}
				{#each matched.groups as group, i (group.form)}
					{#if i}<span class="dot" aria-hidden="true">·</span>{/if}
					<span class="form"><b lang="uk"><Stressed text={group.form} /></b> {group.labels.join('; ')}</span>
				{/each}
				{#if matched.more}<span class="form">{m.card.moreForms(matched.more)}</span>{/if}
			{:else}
				{m.card.someForm}
			{/if}
		</p>
	{/if}
</article>

<style>
	article {
		display: grid;
		/* 18rem: кавалерійський with its play button fits on one line */
		grid-template-columns: minmax(0, 18rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'word glosses actions'
			'meta glosses freq'
			'found found found';
		align-items: center;
		gap: 0.15rem 1.25rem;
		padding: 0.75rem 0.6rem 0.8rem 1.1rem;
		transition: border-color var(--duration);
	}

	@media (hover: hover) {
		article:not(.plain):hover {
			border-color: var(--border-strong);
		}
	}

	/* Half see-through: lighter than a real entry, and still readable over a photo */
	.plain {
		border-style: dashed;
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		box-shadow: none;
	}

	.word {
		grid-area: word;
		display: flex;
		align-items: center;
		gap: 0.15rem;
		min-width: 0;
	}

	.play {
		color: var(--play);
	}

	.meta {
		grid-area: meta;
		min-width: 0;
	}

	.glosses {
		grid-area: glosses;
		padding-left: 1.25rem;
		border-left: 1px solid var(--border);
		color: var(--ink-2);
		font-size: var(--text-lg);
		line-height: 1.45;
	}

	/* Under the buttons, on the line of the grammar, and pushed to the same
	   right edge as the arrow above it. As wide as the longest rank (#16,580):
	   every card's last column is then the same width, and the ranks of a list
	   of results line up like a column of figures. */
	.freq {
		grid-area: freq;
		display: flex;
		justify-content: flex-end;
		box-sizing: border-box;
		min-width: 5.2rem;
		padding-right: 0.6rem;
	}

	.actions {
		grid-area: actions;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	/* Which form of the word the search found: a remark along the card's lower
	   edge, set off by a dashed rule so it is not read as one of the meanings */
	.found {
		grid-area: found;
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.45rem;
		margin: 0.45rem 0.5rem 0 0;
		padding-top: 0.45rem;
		border-top: 1px dashed var(--border);
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.found b {
		color: var(--ink-2);
		font-size: 1rem;
	}

	/* Phones: the meanings go under the word and use the card's full width */
	@media (max-width: 600px) {
		article {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'word actions'
				'meta freq'
				'glosses glosses'
				'found found';
			padding: 0.6rem 0.4rem 0.8rem 0.9rem;
		}

		.freq {
			min-width: 0;
			padding-right: 0.7rem;
		}

		.glosses {
			margin-top: 0.4rem;
			padding: 0.5rem 0.5rem 0 0;
			border-top: 1px solid var(--border);
			border-left: 0;
			font-size: 1rem;
		}
	}
</style>
