<!-- Search from any page: Ctrl+K (⌘K on a Mac) opens a Bits UI Dialog holding a
     Command list. The answers come from /api/search like the search page's,
     so Command's own filtering is off. Enter opens the word's page. Whether
     it is open, and what its box holds, is shared (quick-search.svelte.ts), so
     that a word in an example sentence can open it with itself typed in. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Command, Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { searchReporter } from '#lib/hit.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
	import { useQuickSearch } from '#lib/quick-search.svelte.ts';
	import type { SearchResult } from '#lib/search/search.ts';
	import type { LookupResult, Suggestion } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';
	import Grammar from './Grammar.svelte';
	import Headword from './Headword.svelte';
	import Icon from './Icon.svelte';
	import { wordPath } from '#lib/search/slug.ts';

	const quick = useQuickSearch();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	type Entry = SearchResult | Suggestion;
	const key = (entry: Entry) => `${entry.id ?? entry.word}-${entry.pos}`;

	let found = $state.raw<LookupResult | null>(null);
	let failed = $state(false);
	let hasRows = $derived(!!found && found.results.length + found.suggestions.length > 0);
	// The highlighted row. Set to the first answer when answers arrive, so
	// Enter opens the best match without an arrow key first.
	let selected = $state('');
	let input = $state<HTMLInputElement | null>(null);

	$effect(() => {
		const q = quick.query.trim();
		if (!q) {
			found = null;
			failed = false;
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const answer: LookupResult = await res.json();
				found = answer;
				failed = false;
				// A dictionary entry before a word only VESUM knows, which has a page but no meaning
				const all = [...answer.results, ...answer.suggestions];
				const first = all.find((e) => !('vesum_only' in e && e.vesum_only)) ?? all[0];
				selected = first ? key(first) : '';
			} catch {
				if (!controller.signal.aborted) failed = true;
			}
		}, 150);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	// Start empty the next time it opens, unless it is opened with a word.
	$effect(() => {
		if (!quick.open) quick.query = '';
	});

	// ⌘K on a Mac, Ctrl+K elsewhere: on a Mac, Ctrl+K in a text field deletes
	// to the end of the line, and that is left alone.
	let mac = false;
	onMount(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform);
	});

	// event.key follows the layout: with Ukrainian on, the K key gives "л" and a
	// check for "k" never matches. So a key that is not a Latin letter is read
	// by its place (KeyK). Only then: on Dvorak the KeyK place types "t", and
	// Ctrl+T there must still open a tab.
	function isK(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		return key === 'k' || (!/^[a-z]$/.test(key) && event.code === 'KeyK');
	}

	function onWindowKeydown(event: KeyboardEvent) {
		const modifier = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
		// Not with Alt (AltGr is Ctrl+Alt on Windows) or Shift (Ctrl+Shift+K is
		// Firefox's web console)
		if (modifier && !event.altKey && !event.shiftKey && isK(event)) {
			event.preventDefault();
			// Held down, the key repeats: open once rather than flicker open and shut.
			if (event.repeat) return;
			quick.open = !quick.open;
		}
	}

	// Counted like the search page's (src/lib/hit.ts); closing the box empties
	// it, which drops a search not looked at long enough.
	const searches = searchReporter();
	$effect(() => searches.shown(found));

	function go(entry: Entry | { word: string }) {
		searches.leaving();
		quick.open = false;
		void goto(wordPath(entry.word));
	}

	// The entry that answers a Russian word or surzhyk (дах for криша), and the
	// other Ukrainian words offered beside it that have a page of their own
	const answers = (entry: Entry) =>
		'through' in entry && entry.through?.kind === 'nonstandard' ? entry.through : undefined;
	const plainWord = (word: string) => word.replace(/\u0301/g, '');
	const others = (entry: Entry) =>
		'use' in entry && entry.use ? entry.use.filter((u) => u.has_entry && plainWord(u.word) !== entry.word) : [];
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#snippet row(entry: Entry)}
	{@const noMeaning = 'vesum_only' in entry && entry.vesum_only === true}
	<Command.Item class="ui-quick-item" value={key(entry)} onSelect={() => go(entry)}>
		<Headword text={entry.headword} size="sm" />
		<Grammar pos={entry.pos} inline />
		<span class="ui-quick-gloss">{noMeaning ? ('kind' in entry && entry.kind ? m.card.kind[entry.kind] : m.card.noEntry) : entry.glosses.slice(0, 2).join('; ')}</span>
	</Command.Item>
{/snippet}

<!-- A Russian word or surzhyk (option C, user's pick, 2026-11-17): the word typed, greyed and not to be
     picked, then the Ukrainian words under their heading; the first is highlighted, so Enter opens it -->
{#snippet instead(entry: Entry, typed: { word: string })}
	<Command.Item class="ui-quick-item" value={`typed-${typed.word}`} disabled>
		<s class="ui-quick-typed" lang="uk">{typed.word}</s>
		<span class="ui-quick-gloss">{m.card.kind.distorted}</span>
	</Command.Item>
	<Command.Group>
		<Command.GroupHeading class="ui-quick-heading">{m.card.inUkrainian}</Command.GroupHeading>
		<Command.GroupItems>
			{@render row(entry)}
			{#each others(entry) as u (u.word)}
				<Command.Item class="ui-quick-item" value={`use-${u.word}`} onSelect={() => go({ word: plainWord(u.word) })}>
					<Headword text={u.word} size="sm" />
				</Command.Item>
			{/each}
		</Command.GroupItems>
	</Command.Group>
{/snippet}

<Dialog.Root bind:open={quick.open}>
	<Dialog.Portal>
		<Dialog.Overlay class="ui-overlay" />
		<Dialog.Content class="ui-quick" aria-describedby={undefined}>
			<Dialog.Title class="ui-sr-only">{m.quick.title}</Dialog.Title>
			<Command.Root shouldFilter={false} loop label={m.quick.title} bind:value={selected}>
				<div class="ui-quick-field">
					<Icon name="search" size={20} />
					<Command.Input
						class="ui-quick-input"
						bind:value={quick.query}
						placeholder={m.home.placeholder}
						maxlength={MAX_QUERY_LENGTH}
						autocapitalize="off"
						autocomplete="off"
						autocorrect="off"
						spellcheck="false"
						bind:ref={input}
					/>
					<!-- As on the search page. Esc is told once, in the line of keys below. -->
					{#if quick.query}
						<button
							type="button"
							class="ui-icon-btn"
							aria-label={m.home.clear}
							onclick={() => {
								quick.query = '';
								input?.focus();
							}}
						>
							<Icon name="x" />
						</button>
					{/if}
				</div>
				<!-- A listbox with nothing to choose is announced as an empty list
				     (WCAG 4.1.2), so while there are no rows the list is hidden and the
				     hint or "no matches" stands beside it, where a screen reader reads
				     it out. The list stays in the page: the box points at it. -->
				{#if failed || !found || !hasRows}
					<div class="ui-quick-list" role="status">
						<p class="ui-quick-note">
							{failed ? m.home.failed : !found ? m.quick.hint : m.home.noMatches(found.query)}
						</p>
					</div>
				{/if}
				<Command.List class="ui-quick-list" hidden={failed || !hasRows}>
					<Command.Viewport>
						{#if found}
							{#each found.results as entry (key(entry))}
								{@const typed = answers(entry)}
								{#if typed}{@render instead(entry, typed)}{:else}{@render row(entry)}{/if}
							{/each}
							{#if found.suggestions.length}
								<Command.Group>
									<Command.GroupHeading class="ui-quick-heading">
										{found.results.length ? m.home.orDidYouMean : m.home.didYouMean}
									</Command.GroupHeading>
									<Command.GroupItems>
										{#each found.suggestions as entry (key(entry))}
											{@render row(entry)}
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}
						{/if}
					</Command.Viewport>
				</Command.List>
				<p class="ui-quick-keys" aria-hidden="true">
					<span><kbd class="ui-kbd">↑</kbd> <kbd class="ui-kbd">↓</kbd> {m.quick.navigate}</span>
					<span><kbd class="ui-kbd">Enter</kbd> {m.quick.select}</span>
					<span><kbd class="ui-kbd">Esc</kbd> {m.quick.close}</span>
				</p>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* Everything here is rendered by Bits UI at the end of <body>, so the rules
	   are global and the class names carry a prefix of their own. */
	:global(.ui-quick) {
		position: fixed;
		top: min(14vh, 7rem);
		left: 50%;
		z-index: 50;
		box-sizing: border-box;
		width: min(36rem, calc(100vw - 20px));
		translate: -50% 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
	}

	:global(.ui-quick:focus-visible) {
		outline: none;
	}

	:global(.ui-quick-field) {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0 0.5rem 0 0.9rem;
		border-bottom: 1px solid var(--border);
		color: var(--muted);
	}

	:global(.ui-quick-input) {
		flex: 1;
		min-width: 0;
		padding: 0.95rem 0;
		border: 0;
		outline: none;
		background: none;
		color: var(--ink);
		font-size: var(--text-lg);
	}

	:global(.ui-quick-input::placeholder) {
		color: var(--muted);
	}

	:global(.ui-quick-list) {
		max-height: min(24rem, 55vh);
		overflow-y: auto;
		padding: 0.4rem;
		scroll-padding-block: 0.4rem;
	}

	:global(.ui-quick-item) {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: baseline;
		gap: 0 0.6rem;
		padding: 0.5rem 0.65rem;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	/* Grey, as in the settings menu: blue stays a thin accent, never a fill */
	:global(.ui-quick-item[data-selected]) {
		background: var(--surface-2);
	}

	/* A phone has room for a word or two of the meaning beside the headword, so
	   the meaning takes a line of its own under it */
	@media (max-width: 30rem) {
		:global(.ui-quick-item) {
			grid-template-columns: auto minmax(0, 1fr);
		}

		:global(.ui-quick-gloss) {
			grid-column: 1 / -1;
		}
	}

	:global(.ui-quick-item[data-disabled]) {
		opacity: 0.6;
		cursor: default;
	}

	/* The Russian word or surzhyk typed, as the headword would stand, struck through */
	:global(.ui-quick-typed) {
		color: var(--muted);
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
		font-weight: 800;
		line-height: 1.2;
	}

	:global(.ui-quick-gloss) {
		overflow: hidden;
		color: var(--ink-2);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.ui-quick-heading) {
		padding: 0.6rem 0.65rem 0.25rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	:global(.ui-quick-note) {
		margin: 0;
		padding: 1.4rem 0.65rem;
		color: var(--muted);
		text-align: center;
	}

	:global(.ui-quick-keys) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		margin: 0;
		padding: 0.55rem 0.9rem;
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-size: var(--text-xs);
	}

	/* A phone has no arrow keys or Esc to explain */
	@media (pointer: coarse) {
		:global(.ui-quick-keys) {
			display: none;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.ui-quick[data-state='open']) {
			animation: ui-quick-in var(--duration) ease-out;
		}
	}

	@keyframes -global-ui-quick-in {
		from {
			opacity: 0;
			translate: -50% -8px;
		}
	}
</style>
