<!-- One search result. The headword and the arrow both lead to the word's
     page; the meanings stay plain text so they can be selected and copied. -->
<script lang="ts">
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import type { SearchResult } from '#lib/search/search.ts';
	import type { Suggestion } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';
	import { mergeProps } from 'bits-ui';
	import Icon from './Icon.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import SaveButton from './SaveButton.svelte';
	import Stressed from './Stressed.svelte';
	import Tip from './Tip.svelte';

	let { entry }: { entry: SearchResult | Suggestion } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let genitive = $derived(entry.head_forms.find((f) => f.tags.includes('genitive'))?.form);
	// A VESUM-only word has no entry, so nothing to save or open.
	let vesumOnly = $derived('vesum_only' in entry && entry.vesum_only === true);

	function speak() {
		const utterance = new SpeechSynthesisUtterance(entry.word);
		utterance.lang = 'uk-UA';
		speechSynthesis.speak(utterance);
	}
</script>

<article class:plain={vesumOnly}>
	<div class="word">
		{#if vesumOnly}
			<span class="headword" lang="uk"><Stressed text={entry.headword} /></span>
		{:else}
			<a class="headword" lang="uk" href={wordPath(entry.word)}><Stressed text={entry.headword} /></a>
		{/if}
		<Tip label={m.card.play}>
			{#snippet trigger(props)}
				<button
					{...mergeProps(props, { onclick: speak })}
					type="button"
					class="ui-icon-btn play"
					aria-label={m.card.play}
				>
					<Icon name="speaker" />
				</button>
			{/snippet}
		</Tip>
	</div>

	<p class="meta">
		<span class="ui-badge">{posLabel(m, entry.pos)}</span>
		{#if entry.tags.length}<span>{entry.tags.join(' · ')}</span>{/if}
		{#if genitive}
			<span class="genitive">{m.card.genitive} <b lang="uk"><Stressed text={genitive} /></b></span>
		{/if}
	</p>

	<p class="glosses">
		{#if vesumOnly}<i>{m.card.noEntry}</i>{:else}{entry.glosses.slice(0, 3).join('; ')}{/if}
	</p>

	{#if !vesumOnly}
		<div class="actions">
			<SaveButton word={entry.word} headword={entry.headword} />
			<a class="ui-icon-btn" href={wordPath(entry.word)} aria-label={m.card.details} title={m.card.details}>
				<Icon name="chevron-right" />
			</a>
		</div>
	{/if}
</article>

<style>
	article {
		display: grid;
		/* 18rem: кавалерійський with its play button fits on one line */
		grid-template-columns: minmax(0, 18rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'word glosses actions'
			'meta glosses actions';
		align-items: center;
		gap: 0.15rem 1.25rem;
		padding: 0.75rem 0.6rem 0.8rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		transition:
			border-color 0.12s,
			box-shadow 0.12s;
	}

	@media (hover: hover) {
		article:not(.plain):hover {
			border-color: var(--border-strong);
			box-shadow: var(--shadow);
		}
	}

	/* Half see-through: lighter than a real entry, and still readable over a photo */
	.plain {
		border-style: dashed;
		background: color-mix(in srgb, var(--surface) 55%, transparent);
	}

	p {
		margin: 0;
	}

	.word {
		grid-area: word;
		display: flex;
		align-items: center;
		gap: 0.15rem;
		min-width: 0;
	}

	/* A long word (конкурентоспроможність) breaks onto a second line on a
	   phone instead of pushing the page wider than the screen */
	.headword {
		min-width: 0;
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: 1.55rem;
		font-weight: 800;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	a.headword:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-decoration-color: var(--gold);
		text-underline-offset: 4px;
	}

	a.headword:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.play {
		color: var(--play);
	}

	.meta {
		grid-area: meta;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.5rem;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.genitive b {
		color: var(--ink-2);
		font-size: 0.95rem;
	}

	.glosses {
		grid-area: glosses;
		padding-left: 1.25rem;
		border-left: 1px solid var(--border);
		color: var(--ink-2);
		font-size: 1.08rem;
		line-height: 1.45;
	}

	.actions {
		grid-area: actions;
		display: flex;
		align-items: center;
	}

	/* Phones: the meanings go under the word and use the card's full width */
	@media (max-width: 600px) {
		article {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'word actions'
				'meta meta'
				'glosses glosses';
			padding: 0.6rem 0.4rem 0.8rem 0.9rem;
		}

		.glosses {
			margin-top: 0.4rem;
			padding: 0.5rem 0.5rem 0 0;
			border-top: 1px solid var(--border);
			border-left: 0;
			font-size: 1.02rem;
		}
	}
</style>
