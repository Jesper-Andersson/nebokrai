<!-- The line under a headword that a printed dictionary sets in italics: the
     part of speech, the grammar tags, and the forms a learner needs beside
     the headword.

       іменник · masculine · inanimate · genitive небокра́ю

     `brief` keeps only the genitive, under a short name (a search result).
     `inline` is the part of speech alone, as a span, to stand on the
     headword's own line (the footer, a saved word).

     The italics are the text font slanted by the browser, on purpose. A true
     Cyrillic italic changes the letters (т becomes m, и becomes u), which a
     beginner cannot yet read; slanted, іменник keeps the letters it has
     everywhere else. -->
<script lang="ts">
	import { describeTags } from '#lib/forms.ts';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { orderedTags } from '#lib/labels.ts';
	import { useSettings } from '#lib/settings.ts';
	import Stressed from './Stressed.svelte';

	let {
		pos,
		tags = [],
		headForms = [],
		brief = false,
		inline = false
	}: {
		pos: string;
		tags?: string[];
		headForms?: { form: string; tags: string[] }[];
		brief?: boolean;
		inline?: boolean;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	// "Noun" on a button, "noun" in a line of grammar
	let name = $derived(posLabel(m, pos).toLocaleLowerCase(settings.lang));
	let forms = $derived(brief ? headForms.filter((f) => f.tags.includes('genitive')).slice(0, 1) : headForms);
</script>

{#if inline}
	<span class="grammar">{name}</span>
{:else}
	<p class="grammar">
		<span class="row">
			{#each [name, ...orderedTags(tags)] as part, i (i)}<span class="part">{part}</span>{/each}
			{#each forms as f, i (i)}
				<span class="part">
					{brief ? m.card.genitive : describeTags(f.tags)}
					<b lang="uk"><Stressed text={f.form} /></b>
				</span>
			{/each}
		</span>
	</p>
{/if}

<style>
	.grammar {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
		font-style: italic;
		font-weight: 400;
		line-height: 1.45;
	}

	/* A dot stands before every part, in the part's own left padding, and the
	   row is pulled left by that padding with the overhang cut off. The dot of
	   whichever part begins a line is then out of sight: no line ends in a dot
	   or starts with one, however the parts wrap. */
	p {
		overflow: hidden;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		margin-left: -1.1em;
	}

	.part {
		position: relative;
		padding-left: 1.1em;
	}

	.part::before {
		content: '·';
		position: absolute;
		left: 0;
		width: 1.1em;
		font-style: normal;
		text-align: center;
	}

	/* The forms are Ukrainian words to learn, not remarks about one: upright,
	   and a little larger than the remarks */
	b {
		color: var(--ink-2);
		font-size: 1rem;
		font-style: normal;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
</style>
