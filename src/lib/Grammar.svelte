<!-- The line under a headword that a printed dictionary sets in italics: the
     part of speech, the grammar tags, and the forms a learner needs beside
     the headword.

       noun · masculine (він) · inanimate · genitive небокра́ю

     Each grammar word can be pressed for a note on what it means (Term.svelte),
     and a gender has its pronoun beside it: a learner who has not met
     "masculine" knows "він".

     `brief` is the line of a search result: without the animacy, with the
     genitive alone under a short name, and on a phone the aspect short too
     (pf., impf.). Its terms open their notes on hover or a press as anywhere
     else, but stay out of the tab order, so a list of results is still quick
     to tab through (user, 2026-11-14). `inline` is the part of speech alone,
     as a span, to stand on the headword's own line (the footer, a saved word).

     The italics are the text font slanted by the browser, on purpose. A true
     Cyrillic italic changes the letters (т becomes m, и becomes u), which a
     beginner cannot yet read; slanted, іменник keeps the letters it has
     everywhere else. -->
<script lang="ts">
	import { hasCase } from '#lib/forms.ts';
	import { entryParts, headFormLabel, termOf } from '#lib/grammar.ts';
	import { formName, messagesFor, posLabel, tagLabel } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
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
		/** `has_entry` comes with a word's own page only (word.ts), not with a search result. */
		headForms?: { form: string; tags: string[]; has_entry?: boolean }[];
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
				{#if posTerm}<Term id={posTerm} tabbable={!brief}>{name}</Term>{:else}{name}{/if}
			</span>
			{#each parts as part (part.tag)}
				<!-- One line, no whitespace between the blocks: a tag without a hint
				     kept a trailing space, and its dot stood further off than the others -->
				{@const short = brief ? m.grammar.short[part.tag] : undefined}
				<span class="part"
					>{#if part.term && short}<Term id={part.term} tabbable={false}
							><span class="long">{tagLabel(m, settings.lang, part.tag)}</span><span class="short">{short}</span></Term
						>{:else if part.term}<Term id={part.term} tabbable={!brief} />{:else}{tagLabel(
							m,
							settings.lang,
							part.tag
						)}{/if}{#if part.hint}{' '}<span
							lang="uk">({part.hint})</span
						>{/if}</span
				>
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
					<!-- A form that is a word of its own leads to it: the aspect partner
					     прочита́ти, the diminutive ру́чка. A case form is this same word,
					     even where its spelling happens to be another word's too. -->
					{#if f.has_entry && !hasCase(f.tags)}
						<a href={wordPath(f.form)}><b lang="uk"><Stressed text={f.form} /></b></a>
					{:else}
						<b lang="uk"><Stressed text={f.form} /></b>
					{/if}
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

	a {
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}

	/* A result's line on a phone stands beside the headword, where
	   "imperfective" has no room: it says "impf.", and its note gives the
	   full name */
	.short {
		display: none;
	}

	@media (max-width: 600px) {
		.long {
			display: none;
		}

		.short {
			display: inline;
		}
	}

	a:hover {
		text-decoration-color: currentColor;
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
