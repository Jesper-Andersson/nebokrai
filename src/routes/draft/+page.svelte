<!-- The search page in the draft design. The search itself is the current
     page's (src/routes/+page.svelte): the same request, the same on-screen
     keyboard. The keyboard's open and closed state is a Melt Collapsible. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Collapsible } from 'melt/builders';
	import Icon from '#lib/draft/Icon.svelte';
	import { DRAFT } from '#lib/draft/paths.ts';
	import { draftStrings } from '#lib/draft/strings.ts';
	import WordCard from '#lib/draft/WordCard.svelte';
	import UkrainianKeyboard from '#lib/UkrainianKeyboard.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
	import type { LookupResult } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let s = $derived(draftStrings(settings.lang));

	let query = $state('');
	// The answer for the latest query; null while the box is empty.
	let found = $state.raw<LookupResult | null>(null);
	let failed = $state(false);

	// Ask the server as the user types, waiting for a short pause, and drop
	// answers to queries that have since changed.
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
				found = await res.json();
				failed = false;
			} catch {
				if (!controller.signal.aborted) failed = true;
			}
		}, 150);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	const key = (entry: { id: number | null; word: string; pos: string }) =>
		`${entry.id ?? entry.word}-${entry.pos}`;

	// One query each way of searching: Ukrainian, Latin letters, English.
	const examples = ['небокрай', 'kava', 'horizon', 'дякую'];

	// The on-screen Ukrainian keyboard. Whether it is open is remembered in this
	// browser only (the same key as the current design, so the choice carries over).
	const KEYBOARD_KEY = 'nebokrai-keyboard-open';
	let keyboardOpen = $state(false);
	let input: HTMLInputElement | undefined = $state();

	onMount(() => {
		try {
			keyboardOpen = localStorage.getItem(KEYBOARD_KEY) === '1';
		} catch {}
	});

	const keyboard = new Collapsible({
		open: () => keyboardOpen,
		onOpenChange: (open) => {
			keyboardOpen = open;
			try {
				localStorage.setItem(KEYBOARD_KEY, open ? '1' : '0');
			} catch {}
			input?.focus();
		}
	});

	function fill(text: string) {
		query = text;
		input?.focus();
	}

	// On a phone the results appear behind its keyboard. The keyboard's Search
	// key puts it away; with a mouse, Enter leaves the caret where it is.
	function onInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && matchMedia('(pointer: coarse)').matches) input?.blur();
	}

	// Replace the selection (or insert at the caret) and put the caret after it.
	async function edit(replace: (before: string, selected: string, after: string) => [string, string]) {
		if (!input) return;
		const start = input.selectionStart ?? query.length;
		const end = input.selectionEnd ?? query.length;
		const [before, after] = replace(query.slice(0, start), query.slice(start, end), query.slice(end));
		// The on-screen keyboard stops where the box's own maxlength stops typing.
		if (before.length + after.length > MAX_QUERY_LENGTH) return;
		query = before + after;
		await tick();
		input.focus();
		input.setSelectionRange(before.length, before.length);
	}

	const insert = (text: string) => edit((before, _, after) => [before + text, after]);
	const backspace = () =>
		edit((before, selected, after) => [selected ? before : [...before].slice(0, -1).join(''), after]);

	// The stress mark (U+0301) goes right after a vowel. Pressing it again
	// removes it. Search ignores stress, so results don't change.
	const STRESS = '́';
	const VOWEL = /[аеєиіїоуюя]$/i;
	const stress = () =>
		edit((before, selected, after) => {
			const text = before + selected;
			if (text.endsWith(STRESS)) return [text.slice(0, -1), after];
			return [VOWEL.test(text) ? text + STRESS : text, after];
		});
</script>

<div class="hero" class:searching={query.trim() !== ''}>
	<h1><span class="accent">{m.home.titleAccent}</span>{m.home.titleRest}</h1>
	<p class="tagline">{s.tagline}</p>

	<div class="searchbox">
		<div class="field">
			<Icon name="search" size={20} />
			<!-- With the on-screen keyboard open, keep the phone's own keyboard closed -->
			<input
				bind:this={input}
				bind:value={query}
				placeholder={m.home.placeholder}
				aria-label={m.home.placeholder}
				maxlength={MAX_QUERY_LENGTH}
				inputmode={keyboardOpen ? 'none' : undefined}
				enterkeyhint="search"
				autocapitalize="off"
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
				onkeydown={onInputKeydown}
			/>
			{#if query}
				<button type="button" class="d-icon-btn" aria-label={m.home.clear} onclick={() => fill('')}>
					<Icon name="x" />
				</button>
			{/if}
			<button
				{...keyboard.trigger}
				type="button"
				class="d-icon-btn"
				aria-label={m.keyboard.toggle}
				title={m.keyboard.toggle}
			>
				<Icon name="keyboard" size={22} />
			</button>
		</div>
		<div {...keyboard.content} class="tray">
			{#if keyboard.open}
				<UkrainianKeyboard id="d-uk-keyboard" {input} oninsert={insert} onbackspace={backspace} onstress={stress} />
			{/if}
		</div>
	</div>

	{#if !query.trim()}
		<p class="examples">
			<span>{s.tryLabel}</span>
			{#each examples as example (example)}
				<button type="button" onclick={() => fill(example)}>{example}</button>
			{/each}
		</p>
	{/if}
</div>

{#if failed}
	<p class="note">{m.home.failed}</p>
{:else if found}
	<ul class="results">
		{#each found.results as entry (key(entry))}
			<li><WordCard {entry} /></li>
		{/each}
		{#if found.suggestions.length}
			<li class="divider">{found.results.length ? m.home.orDidYouMean : m.home.didYouMean}</li>
			{#each found.suggestions as entry (key(entry))}
				<li><WordCard {entry} /></li>
			{/each}
		{:else if !found.results.length}
			<li class="note">
				{m.home.noMatches(found.query)}
				<a href="{DRAFT}/report?kind=missing&q={encodeURIComponent(found.query)}">{m.home.reportMissing}</a>
			</li>
		{/if}
	</ul>
{/if}

<style>
	/* Sky above, wheat below: the two colours meet behind the search box */
	.hero {
		padding: clamp(2rem, 9vh, 5.5rem) 1rem 1.25rem;
		background:
			radial-gradient(60rem 18rem at 50% -4rem, var(--d-sky), transparent 70%),
			radial-gradient(34rem 9rem at 50% 100%, var(--d-wheat), transparent 70%);
		text-align: center;
		transition: padding-top 0.2s ease;
	}

	/* With results on the page, the title gives them room */
	.hero.searching {
		padding-top: clamp(1.25rem, 4vh, 2.5rem);
	}

	h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: clamp(1.7rem, 5vw, 2.6rem);
		font-weight: 800;
		line-height: 1.15;
		text-wrap: balance;
	}

	.accent {
		color: var(--d-title-accent);
	}

	.tagline {
		max-width: 34rem;
		margin: 0.7rem auto 1.5rem;
		color: var(--d-muted);
		font-size: 1.02rem;
		line-height: 1.5;
		text-wrap: balance;
	}

	/* The search box; with the keyboard open it grows downward to hold it */
	.searchbox {
		max-width: 38rem;
		margin: 0 auto;
		overflow: hidden;
		border: 1px solid var(--d-border-strong);
		border-radius: 16px;
		background: var(--d-surface);
		box-shadow: var(--d-shadow);
		text-align: left;
	}

	.searchbox:has(input:focus-visible) {
		border-color: var(--d-accent);
		box-shadow:
			0 0 0 3px var(--d-accent-soft),
			var(--d-shadow);
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0 0.45rem 0 1rem;
		color: var(--d-muted);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.95rem 0.6rem;
		border: 0;
		outline: none;
		background: none;
		color: var(--d-ink);
		font-size: 1.1rem;
	}

	input::placeholder {
		color: var(--d-muted);
	}

	/* The keyboard's tray is a shade darker than its keys */
	.tray {
		--panel: var(--d-surface-2);
	}

	.examples {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin: 1rem 0 0;
		color: var(--d-muted);
		font-size: 0.9rem;
	}

	.examples span {
		margin-right: 0.2rem;
	}

	.examples button {
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--d-border);
		border-radius: 999px;
		background: var(--d-surface);
		color: var(--d-ink-2);
		font-weight: 600;
		cursor: pointer;
	}

	@media (hover: hover) {
		.examples button:hover {
			border-color: var(--d-border-strong);
			color: var(--d-ink);
		}
	}

	.examples button:focus-visible {
		outline: 2px solid var(--d-accent);
		outline-offset: 2px;
	}

	@media (pointer: coarse) {
		.examples button {
			padding-block: 0.55rem;
		}
	}

	.results {
		display: grid;
		gap: 0.5rem;
		max-width: 50rem;
		margin: 0.5rem auto 0;
		padding: 0 1rem;
		list-style: none;
	}

	.divider {
		margin-top: 0.75rem;
		color: var(--d-muted);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.note {
		margin: 1.5rem 0 0;
		padding: 0 1rem;
		color: var(--d-muted);
		text-align: center;
	}

	.note a {
		margin-left: 0.4rem;
		color: var(--d-accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 600px) {
		.hero {
			padding-inline: 0.75rem;
		}

		.results {
			padding: 0 0.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero {
			transition: none;
		}
	}
</style>
