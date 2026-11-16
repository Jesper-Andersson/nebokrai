<!-- The "edited" badge after the credit of an example Nebokrai corrected
     (docs/sentence-rating.md, section 7). Pressed, or with a mouse rested on,
     it opens a note with Tatoeba's own sentence and the changed words struck
     through, so a reader can see what was changed and why it is credited.

       <EditedNote original={ex.original} fixed={ex.uk} />

     A Bits UI Popover, as in Term.svelte, not a tooltip: a phone has no hover.
     The note is drawn at the end of <body>, so its styles are the global
     `ui-edited` classes in app.css. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import { changedWords } from '#lib/edited.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { original, fixed }: { original: string; fixed: string } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let parts = $derived(changedWords(original, fixed));

	// The same delays as a grammar term's note (Term.svelte)
	const HOVER_OPEN = 400;
	const HOVER_CLOSE = 300;
</script>

<Popover.Root>
	<Popover.Trigger class="ui-badge ui-edited" openOnHover openDelay={HOVER_OPEN} closeDelay={HOVER_CLOSE}>
		{m.word.adapted}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="ui-popover ui-edited-note" sideOffset={6} collisionPadding={8}>
			<p>{m.word.editedNote}</p>
			<p class="ui-edited-original" lang="uk">
				{#each parts as part, i (i)}{#if part.changed}<del>{part.text}</del>{:else}{part.text}{/if}{/each}
			</p>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
