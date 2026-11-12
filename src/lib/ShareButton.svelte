<!-- Passes a word's page on. On a phone or a tablet it opens the system's
     share sheet, where the messengers are; with a mouse it copies the address
     and says so, because a desktop share sheet offers little that pasting
     does not. -->
<script lang="ts">
	import { mergeProps } from 'bits-ui';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';
	import { useToasts } from './toasts.ts';

	let {
		path,
		headword,
		size = 18
	}: { /** The page's address on this site, e.g. /word/knyha */ path: string; headword: string; size?: number } =
		$props();

	const settings = useSettings();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));

	async function share() {
		const url = location.origin + path;
		if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
			// Closing the sheet without choosing rejects the promise: not an error
			await navigator.share({ title: `${headword} · Nebokrai`, url }).catch(() => {});
			return;
		}
		try {
			// Absent on a page not served over HTTPS, refused when the browser forbids it
			await navigator.clipboard.writeText(url);
			toaster.addToast({ data: { title: m.toast.copied, headword } });
		} catch {
			toaster.addToast({ data: { title: m.toast.notCopied } });
		}
	}
</script>

<Tip label={m.card.share}>
	{#snippet trigger(props)}
		<button
			{...mergeProps(props, { onclick: () => void share() })}
			type="button"
			class="ui-icon-btn"
			aria-label={m.card.share}
		>
			<Icon name="share" {size} />
		</button>
	{/snippet}
</Tip>
