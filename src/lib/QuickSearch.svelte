<!-- Search from any page: Ctrl+K (⌘K on a Mac) opens a Bits UI Dialog holding a
     Command list. The answers come from /api/search like the search page's,
     so Command's own filtering is off. Enter opens the word's page. -->
<script lang="ts">
	import { Command, Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
	import type { SearchResult } from '#lib/search/search.ts';
	import type { LookupResult, Suggestion } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import Stressed from './Stressed.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	type Entry = SearchResult | Suggestion;
	const key = (entry: Entry) => `${entry.id ?? entry.word}-${entry.pos}`;

	let query = $state('');
	let found = $state.raw<LookupResult | null>(null);
	let failed = $state(false);
	// The highlighted row. Set to the first answer when answers arrive, so
	// Enter opens the best match without an arrow key first.
	let selected = $state('');

	$effect(() => {
		const q = query.trim();
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
				const first = [...answer.results, ...answer.suggestions].find((e) => !('vesum_only' in e && e.vesum_only));
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

	// Start empty each time it opens.
	$effect(() => {
		if (!open) query = '';
	});

	function onWindowKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			open = !open;
		}
	}

	function go(entry: Entry) {
		open = false;
		void goto(wordPath(entry.word));
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#snippet row(entry: Entry)}
	{@const noPage = 'vesum_only' in entry && entry.vesum_only === true}
	<Command.Item class="ui-quick-item" value={key(entry)} disabled={noPage} onSelect={() => go(entry)}>
		<span class="ui-quick-word" lang="uk"><Stressed text={entry.headword} /></span>
		<span class="ui-quick-pos">{posLabel(m, entry.pos)}</span>
		<span class="ui-quick-gloss">{noPage ? m.card.noEntry : entry.glosses.slice(0, 2).join('; ')}</span>
	</Command.Item>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="ui-overlay" />
		<Dialog.Content class="ui-quick" aria-describedby={undefined}>
			<Dialog.Title class="ui-sr-only">{m.quick.title}</Dialog.Title>
			<Command.Root shouldFilter={false} loop label={m.quick.title} bind:value={selected}>
				<div class="ui-quick-field">
					<Icon name="search" size={20} />
					<Command.Input
						class="ui-quick-input"
						bind:value={query}
						placeholder={m.home.placeholder}
						maxlength={MAX_QUERY_LENGTH}
						autocapitalize="off"
						autocomplete="off"
						autocorrect="off"
						spellcheck="false"
					/>
					<kbd class="ui-kbd">Esc</kbd>
				</div>
				<Command.List class="ui-quick-list">
					<Command.Viewport>
						{#if failed}
							<p class="ui-quick-note">{m.home.failed}</p>
						{:else if !found}
							<p class="ui-quick-note">{m.quick.hint}</p>
						{:else}
							{#each found.results as entry (key(entry))}
								{@render row(entry)}
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
							{:else if !found.results.length}
								<p class="ui-quick-note">{m.home.noMatches(found.query)}</p>
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
		border-radius: 16px;
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
		padding: 0 0.9rem;
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
		font-size: 1.05rem;
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
		border-radius: 9px;
		cursor: pointer;
	}

	:global(.ui-quick-item[data-selected]) {
		background: var(--accent-soft);
	}

	:global(.ui-quick-item[data-disabled]) {
		opacity: 0.6;
		cursor: default;
	}

	:global(.ui-quick-word) {
		font-family: var(--font-headword);
		font-size: 1.15rem;
		font-weight: 800;
	}

	:global(.ui-quick-pos) {
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 600;
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
		font-size: 0.78rem;
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
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.78rem;
	}

	/* A phone has no arrow keys or Esc to explain */
	@media (pointer: coarse) {
		:global(.ui-quick-keys),
		:global(.ui-quick-field .ui-kbd) {
			display: none;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.ui-quick[data-state='open']) {
			animation: ui-quick-in 0.16s ease-out;
		}
	}

	@keyframes -global-ui-quick-in {
		from {
			opacity: 0;
			translate: -50% -8px;
		}
	}
</style>
