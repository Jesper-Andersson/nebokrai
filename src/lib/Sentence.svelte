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
		own = new Set()
	}: {
		text: string;
		/** The word of the page and its forms, as `plain()` writes them. Empty where no word is the page's own. */
		own?: Set<string>;
	} = $props();

	let parts = $derived(tokens(text));

	/** The word `step` tokens away from token `i` (−2 or 2), when a space alone stands between. */
	function neighbour(i: number, step: -2 | 2): string | undefined {
		const between = parts[i + step / 2];
		const word = parts[i + step];
		return between && word?.word && /^\s+$/.test(between.text) ? word.text : undefined;
	}
</script>

<span lang="uk"
	>{#each parts as token, i (i)}{#if !token.word}{token.text}{:else if own.has(plain(token.text))}<b>{token.text}</b
			>{:else}<GlossWord text={token.text} before={neighbour(i, -2)} after={neighbour(i, 2)} />{/if}{/each}</span
>

<style>
	b {
		font-weight: 700;
	}
</style>
