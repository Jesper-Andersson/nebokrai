<!-- A Ukrainian sentence on a word's page. The word the page is about stands
     out, in whichever form the sentence has it; every other word can be
     looked up, and opens the quick search with itself typed in:

       У молодості треба багато **читати**.

     The words are buttons, not links: where one leads is only known once the
     search has answered (молодості is a form of молодість). -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { useQuickSearch } from '#lib/quick-search.svelte.ts';
	import { plain } from '#lib/search/normalize.ts';
	import { tokens } from '#lib/sentence.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		text,
		own
	}: {
		text: string;
		/** The word of the page and its forms, as `plain()` writes them. */
		own: Set<string>;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	const quick = useQuickSearch();
</script>

<span lang="uk"
	>{#each tokens(text) as token}{#if !token.word}{token.text}{:else if own.has(plain(token.text))}<b
				>{token.text}</b
			>{:else}<button type="button" title={m.word.lookUp} onclick={() => quick.openWith(plain(token.text))}
				>{token.text}</button
			>{/if}{/each}</span
>

<style>
	/* A word to look up reads as the text around it until it is pointed at */
	button {
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		user-select: text;
	}

	button:hover {
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}

	b {
		font-weight: 700;
	}
</style>
