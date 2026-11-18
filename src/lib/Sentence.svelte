<!-- A Ukrainian sentence. The word a page is about stands out, in whichever
     form the sentence has it; every other word opens a small card that says
     what it is (GlossWord.svelte):

       У молодості треба багато **читати**.

     молодості opens "мо́лодість, noun · genitive singular · youth". Each word
     is given its neighbours when only a space stands between them, so a
     pair that is an entry of its own (будь ласка) is found as one. -->
<script lang="ts">
	import { plain } from '#lib/search/normalize.ts';
	import { tokens } from '#lib/sentence.ts';
	import GlossWord from './GlossWord.svelte';

	let {
		text,
		own = new Set(),
		unknown
	}: {
		text: string;
		/** The word of the page and its forms, as `plain()` writes them. Empty where no word is the page's own. */
		own?: Set<string>;
		/**
		 * For a story (/read/<story>): one flag per word of the sentence, in
		 * order, true for a word the reader has not learnt yet, which is
		 * underlined. Left out, no word is.
		 */
		unknown?: boolean[];
	} = $props();

	let parts = $derived(tokens(text));
	/** The place of each word among the sentence's words, for `unknown`. */
	let wordAt = $derived.by(() => {
		let n = 0;
		return parts.map((token) => (token.word ? n++ : -1));
	});

	/** The word `step` tokens away from token `i` (−2 or 2), when a space alone stands between. */
	function neighbour(i: number, step: -2 | 2): string | undefined {
		const between = parts[i + step / 2];
		const word = parts[i + step];
		return between && word?.word && /^\s+$/.test(between.text) ? word.text : undefined;
	}
</script>

<span lang="uk"
	>{#each parts as token, i (i)}{#if !token.word}{token.text}{:else if own.has(plain(token.text))}<b>{token.text}</b
			>{:else}<GlossWord text={token.text} before={neighbour(i, -2)} after={neighbour(i, 2)} marked={unknown?.[wordAt[i]] ?? false} />{/if}{/each}</span
>

<style>
	span {
		font-family: var(--font-reading);
	}

	b {
		font-weight: 700;
	}
</style>
