<script lang="ts">
	import { onMount, tick } from 'svelte';
	import UkrainianKeyboard from '#lib/UkrainianKeyboard.svelte';
	import WordCard from '#lib/WordCard.svelte';
	import type { LookupResult } from '#lib/search/suggest.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let query = $state('');
	// The answer for the latest query; null while the box is empty.
	let found = $state<LookupResult | null>(null);
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
			} catch (err) {
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

	// The on-screen Ukrainian keyboard. Whether it is open is remembered in this
	// browser only; the page works the same if storage is unavailable.
	const KEYBOARD_KEY = 'nebokrai-keyboard-open';
	let keyboardOpen = $state(false);
	let input: HTMLInputElement | undefined = $state();

	onMount(() => {
		try {
			keyboardOpen = localStorage.getItem(KEYBOARD_KEY) === '1';
		} catch {}
	});

	function toggleKeyboard() {
		keyboardOpen = !keyboardOpen;
		try {
			localStorage.setItem(KEYBOARD_KEY, keyboardOpen ? '1' : '0');
		} catch {}
		input?.focus();
	}

	// Clearing is nearly always followed by typing a new word, so keep the caret in the box.
	function clear() {
		query = '';
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

	// Draft: the stress mark (U+0301) goes right after a vowel. Pressing it again
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

<h1><span class="accent">{m.home.titleAccent}</span>{m.home.titleRest}</h1>

<div class="searchbox" class:open={keyboardOpen}>
	<div class="search">
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
			<button type="button" class="clear" aria-label={m.home.clear} onclick={clear}>×</button>
		{/if}
		<button
			type="button"
			class="kbd-toggle"
			aria-label={m.keyboard.toggle}
			title={m.keyboard.toggle}
			aria-pressed={keyboardOpen}
			aria-controls="uk-keyboard"
			onclick={toggleKeyboard}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
				<rect x="2" y="5" width="20" height="14" rx="2.5" />
				<path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12.5h.01M10 12.5h.01M14 12.5h.01M18 12.5h.01M8 16h8" />
			</svg>
		</button>
	</div>
	{#if keyboardOpen}
		<UkrainianKeyboard
			id="uk-keyboard"
			{input}
			oninsert={insert}
			onbackspace={backspace}
			onstress={stress}
		/>
	{/if}
</div>

{#if failed}
	<p class="empty">{m.home.failed}</p>
{:else if found}
	<ul class="results">
		{#each found.results as entry (key(entry))}
			<li><WordCard {entry} /></li>
		{/each}
		{#if found.suggestions.length}
			<li class="empty">{found.results.length ? m.home.orDidYouMean : m.home.didYouMean}</li>
			{#each found.suggestions as entry (key(entry))}
				<li><WordCard {entry} /></li>
			{/each}
		{:else if !found.results.length}
			<li class="empty">
				{m.home.noMatches(found.query)}
				<a href="/report?kind=missing&q={encodeURIComponent(found.query)}">{m.home.reportMissing}</a>
			</li>
		{/if}
	</ul>
{/if}

<style>
	h1 {
		margin: 0.6em 0 0.4em;
		color: white;
		font-family: var(--font-heading);
		font-size: clamp(1.6rem, 4vw, 2.1rem);
		font-weight: 800;
		letter-spacing: 0.02em;
		filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
	}

	.accent {
		background: linear-gradient(#f5e2a8, #c9a54a);
		background-clip: text;
		color: transparent;
	}

	/* The search box; with the keyboard open it grows downward to hold it */
	.searchbox {
		max-width: 36rem;
		margin: 0 auto 0.6rem;
		overflow: hidden;
		border: 1.5px solid var(--field-line);
		border-radius: 1.6rem;
		background: var(--field);
	}

	.searchbox.open {
		border-radius: 1.1rem;
	}

	.searchbox:has(input:focus-visible) {
		box-shadow: 0 0 0 3px #5b8fd6;
	}

	.search {
		position: relative;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.7rem 5.4rem 0.7rem 1.1rem;
		border: 0;
		outline: none;
		background: transparent;
		color: var(--ink);
		font-size: 1.05rem;
	}

	/* As tall as the box and 40px wide, so a thumb finds it */
	.clear {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 2.85rem;
		width: 2.5rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font-size: 1.6rem;
		line-height: 1;
		cursor: pointer;
	}

	/* Keyboard button inside the right end of the search box. The button is the
	   tap area (43px); the round highlight is drawn on the icon and stays 34px. */
	.kbd-toggle {
		position: absolute;
		top: 50%;
		right: 0.15rem;
		translate: 0 -50%;
		display: flex;
		padding: 0.3rem;
		border: 0;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.kbd-toggle svg {
		box-sizing: content-box;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0.3rem;
		border-radius: 999px;
	}

	/* Not on touch screens: there a hover colour stays after the tap */
	@media (hover: hover) {
		.kbd-toggle:hover {
			color: var(--ink);
		}
	}

	.kbd-toggle[aria-pressed='true'] {
		color: #ffffff;
	}

	.kbd-toggle[aria-pressed='true'] svg {
		background: #5b8fd6;
	}

	.kbd-toggle:focus-visible {
		outline: none;
	}

	.kbd-toggle:focus-visible svg {
		outline: 3px solid #5b8fd6;
		outline-offset: 1px;
	}

	.results {
		display: grid;
		gap: 6px;
		max-width: 48rem;
		margin: 0 auto 2rem;
		padding: 0;
		list-style: none;
	}

	.empty {
		color: white;
	}

	.empty a {
		margin-left: 0.4rem;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
