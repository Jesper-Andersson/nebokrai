<!-- The line under a headword that a printed dictionary sets in italics: the
     part of speech, the grammar tags, and the forms a learner needs beside
     the headword.

       noun · masculine (він) · inanimate · genitive небокра́ю

     Each grammar word can be pressed for a note on what it means (Term.svelte),
     and a gender has its pronoun beside it: a learner who has not met
     "masculine" knows "він".

     `brief` is the line of a search result: plain text, so a list of results
     stays quick to read and to tab through, without the animacy, and with the
     genitive alone under a short name. `inline` is the part of speech alone,
     as a span, to stand on the headword's own line (the footer, a saved word).

     The italics are the text font slanted by the browser, on purpose. A true
     Cyrillic italic changes the letters (т becomes m, и becomes u), which a
     beginner cannot yet read; slanted, іменник keeps the letters it has
     everywhere else. -->
<script lang="ts">
	import { entryParts, headFormLabel, termOf } from '#lib/grammar.ts';
	import { formName, messagesFor, posLabel, tagLabel } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import Stressed from './Stressed.svelte';
	import Term from './Term.svelte';

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
	let posTerm = $derived(termOf(pos));
	let parts = $derived(entryParts(tags, brief));
	let forms = $derived(brief ? headForms.filter((f) => f.tags.includes('genitive')).slice(0, 1) : headForms);
</script>

{#if inline}
	<span class="grammar">{name}</span>
{:else}
	<p class="grammar">
		<span class="row">
			<span class="part">
				{#if posTerm && !brief}<Term id={posTerm}>{name}</Term>{:else}{name}{/if}
			</span>
			{#each parts as part (part.tag)}
				<span class="part">
					{#if part.term && !brief}<Term id={part.term} />{:else}{tagLabel(m, settings.lang, part.tag)}{/if}
					{#if part.hint}{' '}<span lang="uk">({part.hint})</span>{/if}
				</span>
			{/each}
			{#each forms as f, i (i)}
				{@const label = headFormLabel(f.tags)}
				{@const text = formName(m, settings.lang, label.key && m.grammar.headForms[label.key], label.extra)}
				<span class="part">
					{#if brief}
						<abbr title={m.grammar.terms.genitive.name}>{m.card.genitive}</abbr>
					{:else if label.term}
						<Term id={label.term}>{text}</Term>
					{:else}
						{text}
					{/if}
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
		/* Room for the last slanted letter, which leans past its own box */
		padding-right: 0.2em;
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
