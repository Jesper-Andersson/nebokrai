<!-- How the flashcards work, behind a question mark beside the review page's
     title: what the two answers do, how FSRS chooses when a card comes back,
     the day's limits, the streak, and where the reviews are kept. A Bits UI
     Dialog: the text is too long for a popover on a phone. -->
<script lang="ts">
	import { Dialog } from 'bits-ui';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let t = $derived(messagesFor(settings.lang).review.help);
</script>

<Dialog.Root>
	<Dialog.Trigger class="ui-icon-btn" aria-label={t.open} title={t.open}>
		<Icon name="help" size={20} />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay class="ui-overlay" />
		<Dialog.Content class="ui-help">
			<div class="ui-help-head">
				<Dialog.Title class="ui-help-title">{t.title}</Dialog.Title>
				<Dialog.Close class="ui-icon-btn" aria-label={t.close} title={t.close}>
					<Icon name="x" size={18} />
				</Dialog.Close>
			</div>
			<Dialog.Description class="ui-help-intro">{t.intro}</Dialog.Description>
			{#each t.sections as section (section.heading)}
				<section class="ui-help-section">
					<h3>{section.heading}</h3>
					{#each section.body as paragraph, i (i)}<p>{paragraph}</p>{/each}
				</section>
			{/each}
			<p class="ui-help-more">
				{t.more}
				<a href="https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm">{t.moreLink}</a>.
			</p>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* Rendered by Bits UI at the end of <body>, so the rules are global and
	   the class names carry a prefix of their own. */
	:global(.ui-help) {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 50;
		box-sizing: border-box;
		width: min(34rem, calc(100vw - 20px));
		max-height: calc(100dvh - 20px);
		padding: 1.25rem 1.35rem 1.5rem;
		translate: -50% -50%;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	:global(.ui-help:focus-visible) {
		outline: none;
	}

	:global(.ui-help-head) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	:global(.ui-help-title) {
		margin: 0;
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	:global(.ui-help-intro) {
		margin: 0.35rem 0 0;
		color: var(--ink-2);
	}

	:global(.ui-help-section) {
		margin-top: 1.1rem;
	}

	:global(.ui-help-section h3) {
		margin: 0 0 0.3rem;
		font-size: var(--text-sm);
		font-weight: 700;
	}

	:global(.ui-help-section p),
	:global(.ui-help-more) {
		margin: 0;
		color: var(--ink-2);
	}

	:global(.ui-help-section p + p) {
		margin-top: 0.4rem;
	}

	:global(.ui-help-more) {
		margin-top: 1.25rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
		color: var(--muted);
	}
</style>
