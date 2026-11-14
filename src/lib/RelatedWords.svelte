<!-- One line of the other words an entry names: its synonyms, its antonyms,
     the words derived from it.

       Synonyms  вродли́вий, краси́вий, фа́йний (dialectal), хоро́ший

     Every word is a link: one the dictionary has leads to its page, the rest
     (брати бика за роги has no entry of its own) to a search for it, which
     finds the words it is made of. A long list (сіяти has 83 derived words)
     shows its beginning and a button for the rest. Nothing is drawn for an
     empty list. -->
<script lang="ts">
	import type { TermId } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { Relation } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';
	import Stressed from './Stressed.svelte';
	import Term from './Term.svelte';

	let {
		label,
		term,
		words,
		limit = Infinity
	}: {
		label: string;
		/** A grammar note behind the label (Derived opens "Derived word"), pressed or hovered */
		term?: TermId;
		words: Relation[];
		/** How many to show before the button. A list only a little longer is shown whole. */
		limit?: number;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// Remarks on how a word is used. Its grammar (feminine, perfective) is left
	// to its own page.
	const USAGE = new Set([
		'colloquial', 'informal', 'formal', 'literary', 'poetic', 'dialectal', 'slang', 'vulgar', 'offensive',
		'derogatory', 'euphemistic', 'figuratively', 'rare', 'uncommon', 'dated', 'archaic', 'obsolete',
		'historical', 'neologism', 'diminutive', 'augmentative', 'endearing', 'emphatic'
	]);
	const remarks = (tags: string[]) => tags.filter((t) => USAGE.has(t)).join(', ');

	// The search, for a word without a page; the stress mark is left out of the address
	const searchPath = (word: string) => `/?q=${encodeURIComponent(word.replace(/́/g, ''))}`;

	// A word named for two meanings is listed once
	let unique = $derived(words.filter((x, i) => words.findIndex((y) => y.word === x.word) === i));
	let whole = $state(false);
	let cut = $derived(!whole && unique.length > limit + 6);
	let shown = $derived(cut ? unique.slice(0, limit) : unique);
</script>

{#if unique.length}
	<p class="related">
		<span class="label">{#if term}<Term id={term}>{label}</Term>{:else}{label}{/if}</span>
		<span class="words">
			<!-- {', '}: Svelte drops a space at the end of a block -->
			{#each shown as x, i (x.word)}{#if i}{', '}{/if}<a
					href={x.has_entry ? wordPath(x.word) : searchPath(x.word)}
					lang="uk"><Stressed text={x.word} /></a
				>{#if remarks(x.tags)}{' '}<i
						>({remarks(x.tags)})</i
					>{/if}{/each}{#if cut}…
				<button type="button" onclick={() => (whole = true)}>{m.word.showAll(unique.length)}</button>
			{/if}
		</span>
	</p>
{/if}

<style>
	.related {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin: 0.3rem 0 0;
		font-size: 1rem;
	}

	/* As wide as the longer of "Synonyms" and "Antonyms", so that the two
	   lists of one meaning start at the same place */
	.label {
		flex: none;
		min-width: 5.2rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.words {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	/* A link reads as a word first: the text's own colour, over a thin line in
	   a tint of the link colour. The full link colour would fight the red of
	   the stress in every word of the list. Pointing at it brings the colour. */
	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-decoration-color: color-mix(in srgb, var(--accent) 50%, transparent);
		text-underline-offset: 4px;
		transition:
			color var(--duration),
			text-decoration-color var(--duration);
	}

	a:hover {
		color: var(--accent);
		text-decoration-color: currentColor;
	}

	i {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
</style>
