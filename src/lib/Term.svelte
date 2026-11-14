<!-- A grammar word that explains itself: pressed, it opens a note with what
     the word means for a learner, an example, and the way into the guide.

       <Term id="genitive" />                       genitive
       <Term id="genitive">Родовий</Term>           the caller's own wording

     A Bits UI Popover and not a tooltip (Tip.svelte): a tooltip opens on hover
     only, which a phone does not have. The popover opens on a press, and with
     a mouse also after the pointer rests on the word a moment (HOVER_OPEN); it
     waits a little before closing, so the pointer can move into the note and
     reach its link. The note is drawn at the end of <body>, so its styles are
     the global `ui-term` classes in app.css. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { EXAMPLES, HINTS, type TermId } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	// `tabbable={false}`: a search result's line. Twenty results with three
	// terms each would be sixty stops between one result and the next; the
	// pointer and a press still open the note, and the word's page has it in
	// the tab order.
	let { id, children, tabbable = true }: { id: TermId; children?: Snippet; tabbable?: boolean } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let term = $derived(m.grammar.terms[id]);
	let example = $derived(EXAMPLES[id]);

	// Long enough that a pointer passing over a line of grammar opens nothing,
	// short enough that one resting on a word does not wait for it
	const HOVER_OPEN = 400;
	const HOVER_CLOSE = 300;
</script>

<!-- No space in or after the button: it would show before the bracket or the
     comma that follows the word, as in "(transitive )" -->
<Popover.Root
	><Popover.Trigger
		class="ui-term"
		openOnHover
		openDelay={HOVER_OPEN}
		closeDelay={HOVER_CLOSE}
		tabindex={tabbable ? undefined : -1}
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
