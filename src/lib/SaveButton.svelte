<!-- The bookmark that saves a word or removes it (Melt Toggle), with a tooltip
     and a message that offers Undo. Beside a saved word's bookmark is the
     button that sorts it into lists (ListPicker.svelte). Once the visitor has
     a list, saving a word opens that panel to ask where the word goes, until
     they choose a default there. -->
<script lang="ts">
	import { mergeProps } from 'bits-ui';
	import { Toggle } from 'melt/builders';
	import { messagesFor } from '#lib/i18n.ts';
	import { listPath } from '#lib/lists.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import ListPicker from './ListPicker.svelte';
	import Tip from './Tip.svelte';
	import { useToasts } from './toasts.ts';

	let { word, headword, size = 18 }: { word: string; headword: string; size?: number } = $props();

	const settings = useSettings();
	const savedWords = useSaved();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));

	let pickerOpen = $state(false);

	// The saved list is the source of truth; the toggle only reports the click.
	const toggle = new Toggle({
		value: () => savedWords.has(word),
		onValueChange: () => {
			const before = savedWords.has(word);
			// Removing a word takes it out of its lists; Undo puts it back in them.
			const lists = savedWords.listsOf(word).map((list) => list.id);
			// A new word goes where the visitor said new words go. With lists but
			// no such choice yet, it is saved first and the panel then asks: a
			// click on the bookmark always saves, whatever happens to the panel.
			const ask = !before && savedWords.lists.length > 0 && savedWords.defaultLists === null;
			if (before) void savedWords.remove(word);
			else void savedWords.save(word, savedWords.defaultLists ?? []);
			// A full list refuses the word: say nothing rather than "Saved".
			if (savedWords.has(word) === before) return;
			pickerOpen = ask;
			// Saved without asking: the message is the only place that says where it went
			// and each name there opens its list.
			const into = before ? [] : savedWords.listsOf(word).map((list) => ({ name: list.name, href: listPath(list.id) }));
			toaster.addToast({
				data: {
					title: before ? m.toast.removed : into.length ? m.toast.savedTo : m.toast.saved,
					lists: into,
					headword,
					undo: () => void (before ? savedWords.save(word, lists) : savedWords.remove(word))
				}
			});
		}
	});
</script>

<!-- One box for the two buttons, so a row that spreads its items out keeps
     them together. The list button is there only for a saved word, and before
     the bookmark: these sit at the right-hand end of their row, so the
     bookmark stays where the finger is. -->
<span class="save">
	{#if toggle.value}<ListPicker words={[word]} {size} bind:open={pickerOpen} />{/if}
	<Tip label={toggle.value ? m.card.unsave : m.card.save}>
		{#snippet trigger(props)}
			<button
				{...mergeProps(props, toggle.trigger)}
				type="button"
				class="ui-icon-btn"
				aria-label={toggle.value ? m.card.unsave : m.card.save}
			>
				<Icon name="bookmark" {size} filled={toggle.value} />
			</button>
		{/snippet}
	</Tip>
</span>

<style>
	.save {
		display: inline-flex;
		flex: none;
		align-items: center;
	}
</style>
