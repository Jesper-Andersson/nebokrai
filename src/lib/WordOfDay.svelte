<!-- The word of the day, under the search box while nothing is typed: one
     entry set as the word's own page sets it, cut down to a card. The
     headword and "Details" both lead to the full entry. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { WordOfDay } from '#lib/word-of-day.ts';
	import FrequencyMeter from './FrequencyMeter.svelte';
	import Grammar from './Grammar.svelte';
	import Headword from './Headword.svelte';
	import Icon from './Icon.svelte';
	import SaveButton from './SaveButton.svelte';

	let { entry }: { entry: WordOfDay } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const label = (tag: string) => tag.replace(/-/g, ' ');
</script>

<section class="ui-page" aria-labelledby="word-of-day">
	<h2 id="word-of-day" class="ui-label">{m.home.wordOfDay}</h2>

	<article class="ui-card">
		<header>
			<div class="title">
				<Headword text={entry.headword} href={wordPath(entry.word)} />
				<SaveButton word={entry.word} headword={entry.headword} size={20} />
			</div>
			{#if entry.roman || entry.ipa}
				<p class="pron">
					{#if entry.roman}<span>{entry.roman}</span>{/if}
					{#if entry.ipa}<span class="ipa">{entry.ipa}</span>{/if}
				</p>
			{/if}
			<div class="grammar">
				<Grammar pos={entry.pos} tags={entry.tags} headForms={entry.head_forms} brief />
				<FrequencyMeter rank={entry.freq_rank} showTier />
			</div>
		</header>

		<ol class="ui-senses">
			{#each entry.senses as sense, i (i)}
				<li>
					{#if sense.tags.length}<i class="tag">({sense.tags.map(label).join(', ')})</i>{/if}
					{sense.gloss}
				</li>
			{/each}
		</ol>

		<p class="example">
			<span lang="uk">{entry.example.uk}</span>
			<span class="en">{entry.example.en}</span>
			<!-- Tatoeba's licence asks for the sentence's source to be named -->
			<a class="credit" href="https://tatoeba.org/sentences/show/{entry.example.tatoeba_id}">
				Tatoeba #{entry.example.tatoeba_id}
			</a>
		</p>

		<a class="more" href={wordPath(entry.word)}>{m.card.details}<Icon name="chevron-right" size={16} /></a>
	</article>
</section>

<style>
	section {
		margin-top: 2rem;
	}

	/* The label stands straight on the page, over a photo too */
	h2 {
		margin-bottom: 0.6rem;
		color: var(--on-page);
	}

	article {
		display: grid;
		gap: 0.9rem;
		padding: 1.1rem 1.25rem 1rem;
		line-height: 1.5;
	}

	p {
		margin: 0;
	}

	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pron {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
		color: var(--ink-2);
	}

	.ipa {
		color: var(--muted);
		font-family: var(--font-ipa);
	}

	.grammar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.3rem 1.5rem;
		margin-top: 0.35rem;
	}

	.grammar :global(.freq) {
		margin-left: auto;
	}

	.ui-senses {
		font-size: var(--text-lg);
	}

	.tag {
		color: var(--muted);
		font-size: 1rem;
	}

	.example {
		padding-left: 0.75rem;
		border-left: 2px solid var(--border-strong);
	}

	.en {
		display: block;
		color: var(--muted);
	}

	.credit {
		color: var(--muted);
		font-size: var(--text-xs);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.more {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: 0.2rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.more:hover {
		color: var(--link-hover);
	}

	@media (max-width: 600px) {
		article {
			padding: 0.9rem 1rem;
		}
	}
</style>
