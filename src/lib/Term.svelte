<!-- A grammar word that explains itself: pressed, it opens a note with what
     the word means for a learner, an example, and the way into the guide.

       <Term id="genitive" />                       genitive
       <Term id="genitive">Родовий</Term>           the caller's own wording

     A Bits UI Popover and not a tooltip (Tip.svelte): a tooltip opens on hover,
     which a phone does not have. The note is drawn at the end of <body>, so its
     styles are the global `ui-term` classes in app.css. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { EXAMPLES, HINTS, type TermId } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { id, children }: { id: TermId; children?: Snippet } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let term = $derived(m.grammar.terms[id]);
	let example = $derived(EXAMPLES[id]);
</script>

<!-- No space in or after the button: it would show before the bracket or the
     comma that follows the word, as in "(transitive )" -->
<Popover.Root
	><Popover.Trigger class="ui-term"
		>{#if children}{@render children()}{:else}{term.name.toLocaleLowerCase(settings.lang)}{/if}</Popover.Trigger
	><Popover.Portal>
		<Popover.Content class="ui-popover ui-term-note" sideOffset={6} collisionPadding={8}>
			<p class="ui-term-name">
				<b>{term.name}</b>
				{#if HINTS[id]}<span lang="uk">{HINTS[id]}</span>{/if}
			</p>
			<p>{term.text}</p>
			{#if example}
				<p class="ui-term-example"><b lang="uk">{example.uk}</b><span>{example.en}</span></p>
			{/if}
			<a href="/grammar#{id}">{m.grammar.more}</a>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
