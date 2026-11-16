<!-- The fundraiser banner under the header (src/lib/appeal.ts). The campaign's
     own picture carries its name, so the card has no heading: the picture, a
     paragraph, the link to give, and a button that closes it for a month.
     On a phone the picture runs across the top and the close button sits on it. -->
<script lang="ts">
	import picture from '#lib/assets/appeal/volt4victory.webp';
	import { APPEAL, showAppeal } from '#lib/appeal.ts';
	import Icon from '#lib/Icon.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { applySetting, useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let shown = $derived(showAppeal(APPEAL, settings.closed));

	function close() {
		settings.closed = APPEAL.id;
		applySetting('closed', APPEAL.id);
	}
</script>

{#if shown}
	<aside class="appeal" aria-label={m.appeal.label}>
		<div class="card">
			<a class="picture" href={APPEAL.url} target="_blank" rel="noopener" tabindex="-1">
				<img src={picture} alt={m.appeal.picture} width="1024" height="341" />
			</a>
			<div class="text">
				<p>{m.appeal.text}</p>
				<div class="actions">
					<a class="ui-btn ui-btn-primary" href={APPEAL.url} target="_blank" rel="noopener">{m.appeal.donate}</a>
					<span class="with">{m.appeal.with}</span>
				</div>
			</div>
			<button type="button" class="ui-icon-btn close" aria-label={m.appeal.close} title={m.appeal.close} onclick={close}>
				<Icon name="x" />
			</button>
		</div>
	</aside>
{/if}

<style>
	/* The width of the search box and its results, the widest thing most pages
	   line up with, and the page's edge gap at the sides. */
	.appeal {
		padding: var(--gap-stack) var(--gap-stack) 0;
	}

	.card {
		position: relative;
		display: flex;
		gap: 1.25rem;
		align-items: center;
		max-width: var(--search);
		margin: 0 auto;
		padding: 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}

	.picture {
		flex: none;
		line-height: 0;
	}

	img {
		width: 16.5rem;
		height: auto;
		border-radius: var(--radius-md);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--gap-inline);
		min-width: 0;
		padding-right: 2.25rem;
	}

	p {
		margin: 0;
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-inline) 0.75rem;
		align-items: center;
	}

	.actions .ui-btn {
		white-space: nowrap;
		text-decoration: none;
	}

	.with {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
	}

	/* A phone: the picture across the top, the close button on its corner,
	   on the card's own colour so it reads on the picture's dark green. */
	@media (max-width: 40rem) {
		.card {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		img {
			width: 100%;
		}

		.text {
			padding: 0 0.25rem 0.25rem;
		}

		.close {
			top: 1.1rem;
			right: 1.1rem;
			background: var(--surface);
			color: var(--ink);
		}
	}
</style>
