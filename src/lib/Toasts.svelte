<!-- Draws the messages of the page's toaster (toasts.ts) in the bottom corner.
     Melt shows the container as a `popover`, so it sits above dialogs too. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import Stressed from './Stressed.svelte';
	import { useToasts } from './toasts.ts';

	const settings = useSettings();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));
</script>

<div {...toaster.root} class="toasts">
	{#each toaster.toasts as toast (toast.id)}
		<div {...toast.content} class="toast">
			<p>
				<span {...toast.title}>{toast.data.title}</span>
				{#if toast.data.headword}
					<b {...toast.description} lang="uk"><Stressed text={toast.data.headword} /></b>
				{/if}
			</p>
			{#if toast.data.undo}
				<button
					type="button"
					class="undo"
					onclick={() => {
						toast.data.undo?.();
						toast.removeSelf();
					}}
				>
					{m.toast.undo}
				</button>
			{/if}
			<button {...toast.close} type="button" class="ui-icon-btn" aria-label={m.toast.dismiss}>
				<Icon name="x" size={16} />
			</button>
		</div>
	{/each}
</div>

<style>
	/* A popover comes with the browser's own box (centred, bordered); undo that */
	.toasts {
		position: fixed;
		inset: auto 1rem 1rem auto;
		display: grid;
		gap: 0.5rem;
		width: min(22rem, calc(100vw - 2rem));
		margin: 0;
		padding: 0;
		overflow: visible;
		border: 0;
		background: none;
	}

	.toasts:not(:popover-open) {
		display: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.45rem 0.45rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
		font-size: 0.92rem;
	}

	p {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.45rem;
		min-width: 0;
		margin: 0;
	}

	b {
		font-family: var(--font-headword);
		font-size: 1.05rem;
		overflow-wrap: anywhere;
	}

	.undo {
		padding: 0.3rem 0.6rem;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--accent);
		font-weight: 700;
		cursor: pointer;
	}

	@media (hover: hover) {
		.undo:hover {
			background: var(--accent-soft);
		}
	}

	.undo:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	@media (max-width: 520px) {
		.toasts {
			inset-inline: 1rem;
			width: auto;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.toast {
			animation: toast-in 0.18s ease-out;
		}
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			translate: 0 8px;
		}
	}
</style>
