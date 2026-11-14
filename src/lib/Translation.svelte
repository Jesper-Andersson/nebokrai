<!-- The English under an example sentence. With "Hide translations" on (the
     default) it is blurred, so the learner reads the Ukrainian first; a press
     shows it, and another press blurs it again. With the setting off it is
     plain text, as it always was.

       Дайте, будь ласка, склянку води.
       ░░░░░ ░░░░ ░░ ░ ░░░░░ ░░ ░░░░░░      → Please give me a glass of water.

     Until it is shown, a screen reader hears "Show the English" rather than
     the translation, as the eye sees only the blur. The word of the day's
     meanings use it too, in the ink of the meanings (`muted={false}`). -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { text, muted = true }: { text: string; muted?: boolean } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let shown = $state(false);
</script>

{#if settings.blur === 'on'}
	<button
		type="button"
		class="en reveal"
		class:muted
		class:shown
		aria-pressed={shown}
		aria-label={shown ? undefined : m.word.reveal}
		title={shown ? undefined : m.word.reveal}
		onclick={() => (shown = !shown)}><span>{text}</span></button
	>
{:else}
	<span class="en" class:muted>{text}</span>
{/if}

<style>
	/* A button's own colour is the system's, not the text's around it */
	.en {
		display: block;
		color: inherit;
	}

	.muted {
		color: var(--muted);
	}

	/* Laid out as the plain line would be: same place, same wrapping */
	.reveal {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	/* Blurred past reading, but its length still shows a line is there */
	.reveal span {
		filter: blur(5px);
		user-select: none;
		transition: filter var(--duration);
	}

	@media (hover: hover) {
		.reveal:not(.shown):hover span {
			filter: blur(4px);
		}
	}

	.reveal.shown span {
		filter: none;
		user-select: text;
	}
</style>
