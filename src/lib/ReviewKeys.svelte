<!-- The keys that answer a flashcard, each drawn as the key it is with what
     it does beside it. A key is changed by clicking it and pressing another:
     the review page, which listens to the keyboard, does the changing
     (src/lib/review/keys.ts). -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { ACTIONS, isDefault, keyLabel, type Action, type Bindings } from '#lib/review/keys.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		keys,
		changing,
		onpick,
		onreset
	}: {
		keys: Bindings;
		/** The action waiting for its new key, if one is. */
		changing: Action | null;
		/** A key was clicked: it now waits for a key press, or stops waiting if it already was. */
		onpick: (action: Action) => void;
		onreset: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
</script>

<div class="keys">
	<ul>
		{#each ACTIONS as action (action)}
			{@const label = keyLabel(keys[action])}
			<li>
				<button
					type="button"
					class="key"
					class:wide={label.length > 2}
					class:waiting={changing === action}
					aria-label={m.review.keys.change(m.review.keys.action[action], label)}
					aria-pressed={changing === action}
					onclick={() => onpick(action)}
				>
					{changing === action ? '…' : label}
				</button>
				<span>{m.review.keys.action[action]}</span>
			</li>
		{/each}
	</ul>
	<p role="status">
		{changing ? m.review.keys.press : m.review.keys.hint}
		{#if !changing && !isDefault(keys)}
			<button type="button" class="reset" onclick={onreset}>{m.review.keys.reset}</button>
		{/if}
	</p>
</div>

<style>
	.keys {
		display: grid;
		gap: 0.5rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	/* A key cap: square, with a thicker lower edge as if seen from above */
	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.45rem;
		border: 1px solid var(--border-strong);
		border-bottom-width: 3px;
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	.key.wide {
		padding: 0 0.7rem;
		font-size: var(--text-xs);
	}

	@media (hover: hover) {
		.key:hover {
			background: var(--surface-2);
		}
	}

	/* Waiting for its new key: pressed down, in the accent */
	.key.waiting {
		border-color: var(--accent);
		border-bottom-width: 1px;
		margin-top: 2px;
		height: calc(2rem - 2px);
		background: var(--accent-soft);
		color: var(--accent);
	}

	p {
		margin: 0;
		font-size: var(--text-xs);
	}

	.reset {
		margin-left: 0.4rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
