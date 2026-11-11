<!-- The bookmark that saves a word or removes it (Melt Toggle), with a tooltip
     and a message that offers Undo. -->
<script lang="ts">
	import { mergeProps } from 'bits-ui';
	import { Toggle } from 'melt/builders';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import { draftStrings } from './strings.ts';
	import Tip from './Tip.svelte';
	import { useToasts } from './toasts.ts';

	let { word, headword, size = 18 }: { word: string; headword: string; size?: number } = $props();

	const settings = useSettings();
	const savedWords = useSaved();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));
	let s = $derived(draftStrings(settings.lang));

	// The saved list is the source of truth; the toggle only reports the click.
	const toggle = new Toggle({
		value: () => savedWords.has(word),
		onValueChange: () => {
			const before = savedWords.has(word);
			void savedWords.toggle(word);
			// A full list refuses the word: say nothing rather than "Saved".
			if (savedWords.has(word) === before) return;
			toaster.addToast({
				data: {
					title: before ? s.toast.removed : s.toast.saved,
					headword,
					undo: () => void savedWords.toggle(word)
				}
			});
		}
	});
</script>

<Tip label={toggle.value ? m.card.unsave : m.card.save}>
	{#snippet trigger(props)}
		<button
			{...mergeProps(props, toggle.trigger)}
			type="button"
			class="d-icon-btn"
			aria-label={toggle.value ? m.card.unsave : m.card.save}
		>
			<Icon name="bookmark" {size} filled={toggle.value} />
		</button>
	{/snippet}
</Tip>
