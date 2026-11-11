<script lang="ts">
	import type { SearchResult } from '#lib/search/search.ts';
	import type { Suggestion } from '#lib/search/suggest.ts';

	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import { wordPath } from '#lib/search/slug.ts';

	let { entry }: { entry: SearchResult | Suggestion } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let partOfSpeech = $derived(posLabel(m, entry.pos));
	let genitive = $derived(entry.head_forms.find((f) => f.tags.includes('genitive'))?.form);
	let vesumOnly = $derived('vesum_only' in entry && entry.vesum_only);

	const savedWords = useSaved();
	let saved = $derived(savedWords.has(entry.word));

	function speak() {
		const utterance = new SpeechSynthesisUtterance(entry.word);
		utterance.lang = 'uk-UA';
		speechSynthesis.speak(utterance);
	}
</script>

<!-- Renders a word with its stressed vowel (letter + U+0301) in red -->
{#snippet stressed(text: string)}{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span class="stress">{part}</span>{:else}{part}{/if}{/each}{/snippet}

<article class="card">
	<div class="entry">
		<p class="meta">
			<span class="pos">{partOfSpeech}</span>
			{entry.tags.join(' - ')}
		</p>
		<p class="word">
			<span class="headword" lang="uk">{@render stressed(entry.headword)}</span>
			<button class="icon play" aria-label={m.card.play} onclick={speak}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<polygon points="10 8 16 12 10 16 10 8" />
				</svg>
			</button>
		</p>
		{#if genitive}
			<p class="forms">
				({m.card.genitive}) <b lang="uk">{@render stressed(genitive)}</b>
			</p>
		{/if}
	</div>

	<p class="translations">
		{#if vesumOnly}<i>{m.card.noEntry}</i>{:else}{entry.glosses.slice(0, 3).join('; ')}{/if}
	</p>

	<div class="actions">
		<!-- A VESUM-only word has no entry, so nothing to save or open -->
		{#if !vesumOnly}
		<button
			class="icon"
			aria-label={saved ? m.card.unsave : m.card.save}
			aria-pressed={saved}
			onclick={() => savedWords.toggle(entry.word)}
		>
			<svg
				viewBox="0 0 24 24"
				fill={saved ? 'currentColor' : 'none'}
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linejoin="round"
			>
				<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
			</svg>
		</button>
		<a href={wordPath(entry.word)}>{m.card.details}</a>
		{/if}
	</div>
</article>

<style>
	.card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		padding: 0.25rem 0.6rem 0.5rem 0.8rem;
		border-radius: 6px;
		background: var(--panel);
		color: var(--ink);
		text-align: left;
	}

	p {
		margin: 0;
	}

	.meta {
		font-size: 0.85rem;
	}

	.pos {
		margin-right: 0.3rem;
		color: var(--ink-soft);
		font-size: 1.05rem;
		font-weight: 800;
	}

	.word {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1.3;
	}

	/* A long word (конкурентоспроможність) breaks onto a second line on a
	   phone instead of pushing the page wider than the screen */
	.headword {
		min-width: 0;
		font-family: var(--font-headword);
		overflow-wrap: anywhere;
	}

	.stress {
		color: var(--stress);
	}

	.forms {
		font-size: 0.8rem;
	}

	.forms b {
		font-size: 1.1rem;
		font-weight: 800;
	}

	.translations {
		display: flex;
		align-items: center;
		margin-block: 0.6rem;
		padding-left: 2.5rem;
		border-left: 1.5px solid var(--rule);
		font-size: 1.3rem;
	}

	.actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-top: 0.3rem;
	}

	.actions a {
		position: relative;
		margin-block: auto;
		font-weight: 700;
		text-decoration: underline;
	}

	/* A larger tap area around the link, without changing the card's height */
	.actions a::after {
		content: '';
		position: absolute;
		inset: -0.6rem -0.4rem;
	}

	/* Padding for a 40px tap area; the negative margin keeps the icon in place */
	.icon {
		display: inline-flex;
		flex: none;
		margin: -0.6rem;
		padding: 0.6rem;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.icon svg {
		width: 1.3rem;
		height: 1.3rem;
	}

	.play {
		color: var(--play);
	}

	/* Phones: translations go under the word instead of beside it, and use the
	   card's full width. The actions stay beside the word. */
	@media (max-width: 600px) {
		.card {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.translations {
			grid-column: 1 / -1;
			margin: 0.3rem 0 0;
			padding-left: 0;
			border-left: 0;
			font-size: 1.1rem;
		}

		.actions {
			grid-row: 1;
			grid-column: 2;
		}
	}
</style>
