<!-- Which lists one or more saved words are in: a button that opens a Bits UI
     Popover with a chip per list (pressed when every word is in it) and a box
     to name a new list, which the words go straight into. A popover and not a
     menu, because a menu takes typed letters as a search of its items and
     would fight the text box. Beside the bookmark it is an icon; on the Saved
     page, for the ticked words, a button with its name on it. -->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import { messagesFor } from '#lib/i18n.ts';
	import { MAX_LISTS, MAX_LIST_NAME } from '#lib/saved.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';

	// `open` can be set from outside: the bookmark opens this when it saves a
	// word, to ask which lists the word goes into (SaveButton.svelte).
	let { words, variant = 'icon', size = 18, open = $bindable(false) }: {
		words: string[];
		variant?: 'icon' | 'button';
		size?: number;
		open?: boolean;
	} = $props();

	const settings = useSettings();
	const saved = useSaved();
	let m = $derived(messagesFor(settings.lang));

	let name = $state('');
	let problem = $state<'taken' | 'full' | null>(null);

	// Only while open: with thousands of words ticked this is a lot to look through.
	let holding = $derived(
		open
			? new Set(saved.lists.filter((l) => { const inList = new Set(l.words); return words.every((w) => inList.has(w)); }).map((l) => l.id))
			: new Set<string>()
	);
	// The icon takes the accent colour when its word is in a list, so that shows without opening it.
	let listed = $derived(variant === 'icon' && words.some((w) => saved.listsOf(w).length > 0));

	// The lists new words go to without asking, by name, for the line that says so
	let defaultNames = $derived(
		saved.lists.filter((l) => saved.defaultLists?.includes(l.id)).map((l) => l.name).join(', ')
	);

	// From now on the bookmark puts a word where this one is, and does not open this panel.
	function makeDefault() {
		saved.setDefaultLists(saved.lists.filter((l) => holding.has(l.id)).map((l) => l.id));
		open = false;
	}

	function create(event: SubmitEvent) {
		event.preventDefault();
		const made = saved.createList(name, words);
		if (made === 'invalid') return;
		if (typeof made === 'string') problem = made;
		else name = '';
	}
</script>

<Popover.Root bind:open onOpenChange={() => (problem = null)}>
	{#if variant === 'icon'}
		<Popover.Trigger class={['ui-icon-btn', listed && 'ui-listed']} aria-label={m.lists.choose} title={m.lists.choose}>
			<Icon name="list" {size} />
		</Popover.Trigger>
	{:else}
		<Popover.Trigger class="ui-btn">
			<Icon name="list" size={16} />
			{m.lists.choose}
		</Popover.Trigger>
	{/if}
	<Popover.Portal>
		<Popover.Content class="ui-popover ui-lists" align="end" sideOffset={6} collisionPadding={8}>
			<h2>{m.lists.heading}</h2>
			{#if saved.lists.length}
				<div class="ui-lists-chips">
					{#each saved.lists as list (list.id)}
						<button
							type="button"
							class="ui-chip"
							aria-pressed={holding.has(list.id)}
							onclick={() => saved.setInList(list.id, words, !holding.has(list.id))}
						>
							{list.name}
						</button>
					{/each}
				</div>
			{:else}
				<p>{m.lists.none}</p>
			{/if}
			<form onsubmit={create}>
				<input
					class="ui-field"
					type="text"
					maxlength={MAX_LIST_NAME}
					autocomplete="off"
					placeholder={m.lists.newName}
					aria-label={m.lists.newName}
					bind:value={name}
					oninput={() => (problem = null)}
				/>
				<button type="submit" class="ui-btn" disabled={!name.trim()}>{m.lists.create}</button>
			</form>
			{#if problem}
				<p class="ui-lists-problem" role="alert">{problem === 'taken' ? m.lists.taken : m.lists.full(MAX_LISTS)}</p>
			{/if}
			<!-- Beside a bookmark only: whether saving a word asks for its lists -->
			{#if variant === 'icon' && saved.lists.length}
				<div class="ui-lists-default">
					{#if saved.defaultLists === null}
						<button type="button" class="ui-btn" onclick={makeDefault}>{m.lists.makeDefault}</button>
						<p>{m.lists.makeDefaultHint}</p>
					{:else}
						<p>{m.lists.defaultIs(defaultNames)}</p>
						<button type="button" class="ui-btn" onclick={() => saved.setDefaultLists(null)}>
							{m.lists.askAgain}
						</button>
					{/if}
				</div>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	/* Everything here is rendered by Bits UI, the panel at the end of <body>,
	   so the rules are global and the class names carry a prefix of their own. */
	:global(.ui-icon-btn.ui-listed) {
		color: var(--accent);
	}

	:global(.ui-lists) {
		display: grid;
		gap: 0.7rem;
	}

	:global(.ui-lists h2) {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	:global(.ui-lists p) {
		margin: 0;
		color: var(--ink-2);
	}

	/* Fifty lists are more than a phone is tall: the chips scroll, the box for a new list stays in reach */
	:global(.ui-lists-chips) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		max-height: min(14rem, 40dvh);
		overflow-y: auto;
		/* Room for the focus ring, which the scrolling would cut off */
		margin: -3px;
		padding: 3px;
	}

	/* A long name breaks inside its chip rather than widening the panel */
	:global(.ui-lists-chips .ui-chip) {
		max-width: 100%;
		overflow-wrap: anywhere;
		text-align: start;
	}

	:global(.ui-lists form) {
		display: flex;
		gap: 0.5rem;
	}

	:global(.ui-lists form .ui-field) {
		min-width: 0;
		padding-block: 0.4rem;
	}

	:global(.ui-lists form .ui-btn) {
		flex: none;
	}

	/* Set apart by a line: this is about every word saved from now on, not this one */
	:global(.ui-lists-default) {
		display: grid;
		justify-items: start;
		gap: 0.4rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--border);
	}

	:global(.ui-lists .ui-lists-default p) {
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1.4;
	}

	:global(.ui-lists p.ui-lists-problem) {
		color: var(--stress);
	}
</style>
