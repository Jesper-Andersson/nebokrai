<!-- The search page: the search box with its on-screen keyboard, and the
     answers of /api/search as cards. While the box is empty, the word of the
     day stands where the answers will. The keyboard's open and closed state
     is a Melt Collapsible. -->
<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { Collapsible } from 'melt/builders';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import WordCard from '#lib/WordCard.svelte';
	import WordOfDay from '#lib/WordOfDay.svelte';
	import UkrainianKeyboard from '#lib/UkrainianKeyboard.svelte';
	import { searchReporter } from '#lib/hit.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
	import type { LookupResult } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';
	import { TITLE_WORD } from '#lib/title-paths.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let word = $derived(TITLE_WORD[settings.lang]);

	// The page can be opened with the search already made (/?q=kava): the
	// server then sends the query and its answer along (+page.server.ts).
	// svelte-ignore state_referenced_locally
	let query = $state(data.query);
	// The answer for the latest query; null while the box is empty.
	// svelte-ignore state_referenced_locally
	let found = $state.raw<LookupResult | null>(data.found);
	// svelte-ignore state_referenced_locally
	let failed = $state(data.failed);

	// The address follows the search box, so what is on the page can be sent
	// to someone, and Back from a word's page returns to the same results.
	// The address is replaced, not added to: Back must leave the search, not
	// step through it letter by letter. Shallow: nothing is loaded for it.
	function showInAddress(q: string) {
		const address = q ? `/?q=${encodeURIComponent(q)}` : '/';
		if (location.pathname + location.search === address) return;
		void goto(address, { shallow: true, replace: true }).catch(() => {});
	}

	// Arriving here by Back or Forward, or by a link to the empty search page
	// while a search is showing: the box takes what the address says. The page
	// stays in place for such a visit, so the lines above do not run again.
	afterNavigate((navigation) => {
		// Not for showInAddress itself, whose address may already be a letter behind the box
		if (navigation.type === 'goto' && navigation.shallow) return;
		const asked = (new URL(location.href).searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);
		if (asked.trim() !== query.trim()) query = asked;
	});

	// Ask the server as the user types, waiting for a short pause, and drop
	// answers to queries that have since changed.
	$effect(() => {
		const q = query.trim();
		if (!q) {
			found = null;
			failed = false;
			showInAddress('');
			return;
		}
		// Already answered: by the server when the page was opened with this
		// query, or a moment ago, before a letter was typed and taken back.
		if (untrack(() => found)?.query.trim() === q) {
			failed = false;
			showInAddress(q);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			showInAddress(q);
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

	// Count a search once its answer has been looked at, not per letter typed
	// (src/lib/hit.ts). Leaving for a result counts it at once.
	const searches = searchReporter();
	$effect(() => searches.shown(found));
	beforeNavigate((navigation) => {
		if (navigation.type === 'goto' && navigation.shallow) return;
		searches.leaving();
	});

	const key = (entry: { id: number | null; word: string; pos: string }) =>
		`${entry.id ?? entry.word}-${entry.pos}`;

	// One query each way of searching: Ukrainian, Latin letters, English.
	const examples = ['небокрай', 'kava', 'horizon', 'дякую'];

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

<PageMeta title={m.meta.homeTitle} description={m.meta.home} />

<div class="hero">
	<!-- One phrase on two lines: the languages in print, and the last word in
	     the hand of the logo. The word is a drawing (title-paths.ts), so the
	     heading also carries it as text for a screen reader or a search engine. -->
	<h1>
		<span class="pair">{m.home.titlePair}</span>
		<span class="ui-sr-only">{word.name}</span>
		<svg class="word" viewBox={word.box} style:--ems={word.ems} aria-hidden="true"><path d={word.d} /></svg>
	</h1>

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
				<button type="button" class="ui-icon-btn" aria-label={m.home.clear} onclick={() => fill('')}>
					<Icon name="x" />
				</button>
			{:else}
				<!-- Searches to try, in the box itself while it is empty: they are
				     what the empty line is for, and a row of their own under the box
				     pushed the word of the day down the page -->
				<span class="examples">
					<span>{m.home.tryLabel}</span>
					{#each examples as example (example)}
						<button type="button" class="ui-chip" onclick={() => fill(example)}>{example}</button>
					{/each}
				</span>
			{/if}
			<button
				{...keyboard.trigger}
				type="button"
				class="ui-icon-btn"
				aria-label={m.keyboard.toggle}
				title={m.keyboard.toggle}
			>
				<Icon name="keyboard" size={22} />
			</button>
		</div>
		<div {...keyboard.content}>
			{#if keyboard.open}
				<UkrainianKeyboard id="uk-keyboard"{input} oninsert={insert} onbackspace={backspace} onstress={stress} />
			{/if}
		</div>
	</div>
</div>

{#if !query.trim()}
	{#if data.wordOfDay}
		<div class="daily" class:with-keyboard={keyboard.open}><WordOfDay entry={data.wordOfDay} /></div>
	{/if}
{:else if failed}
	<p class="note">{m.home.failed}</p>
{:else if found}
	<ul class="ui-page results">
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
				<a href="/report?kind=missing&q={encodeURIComponent(found.query)}">{m.home.reportMissing}</a>
			</li>
		{/if}
	</ul>
{/if}

<style>
	/* The title and the box sit high and stay put: typing must not move the
	   box under the caret. Nothing is painted behind them. Little room above
	   and below, so that the page fits a desktop window without scrolling;
	   what follows (the word of the day, the answers) starts 1rem under the
	   box. */
	.hero {
		padding: clamp(0.75rem, 2vh, 1.25rem) 1rem 1rem;
		text-align: center;
	}

	/* Over a photo (app.css) the frame lays the page colour over the top of
	   the photo, which carries the title; the title's own shadow only has to
	   firm its edges. */
	:global(:root[data-bg]) .pair {
		color: var(--ink);
		text-shadow: 0 1px 0.35em color-mix(in srgb, var(--bg) 65%, transparent);
	}

	:global(:root[data-bg]) .word {
		filter: drop-shadow(0 1px 0.3rem color-mix(in srgb, var(--bg) 65%, transparent));
	}

	h1 {
		display: grid;
		justify-items: center;
		margin: 0 0 0.5rem;
	}

	.pair {
		color: var(--ink-2);
		font-size: clamp(1.05rem, 2.6vw, 1.3rem);
		font-weight: 600;
		line-height: 1.3;
	}

	/* --hand is the size of the handwriting, as a font size would be; the
	   word's own box is --ems of it tall (Словник, with nothing under the line,
	   less than Dictionary). The outline in the letter's own colour thickens
	   it, as it does the logo. */
	.word {
		--hand: clamp(2.9rem, 9vw, 4.1rem);
		display: block;
		width: auto;
		max-width: 100%;
		height: calc(var(--hand) * var(--ems));
		fill: var(--ink);
		stroke: var(--ink);
		stroke-width: 0.9;
		stroke-linejoin: round;
	}

	/* The search box; with the keyboard open it grows downward to hold it.
	   As wide as the results under it (.results), so the two share their edges. */
	.searchbox {
		box-sizing: border-box;
		max-width: var(--page);
		margin: 0 auto;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--panel);
		box-shadow: var(--shadow);
		text-align: left;
	}

	.searchbox:has(input:focus-visible) {
		border-color: var(--accent);
		box-shadow:
			0 0 0 3px var(--accent-soft),
			var(--shadow);
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0 0.45rem 0 1rem;
		color: var(--muted);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.95rem 0.6rem;
		border: 0;
		outline: none;
		background: none;
		color: var(--ink);
		font-size: var(--text-lg);
	}

	input::placeholder {
		color: var(--muted);
	}

	/* The searches to try, at the end of the empty line, before the keyboard's
	   button. They go when a letter is typed, and the box stays as it was. */
	.examples {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.35rem;
		margin-right: 0.4rem;
		font-size: var(--text-sm);
	}

	.examples span {
		margin-right: 0.15rem;
	}

	.results {
		display: grid;
		gap: 0.3rem;
		margin-block: 0.5rem 0;
		list-style: none;
	}

	.divider {
		margin-top: 0.75rem;
		color: var(--on-page);
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.note {
		margin: 1.5rem 0 0;
		padding: 0 1rem;
		color: var(--on-page);
		text-align: center;
	}

	.note a {
		margin-left: 0.4rem;
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* On a desktop the empty search page fits the window: nothing on it is
	   worth scrolling for, and a scrollbar that moves the page an inch says
	   something is hidden. It does as it stands in a window 940px tall or
	   more with the keyboard open (730px with it closed). In a lower window
	   the title is set smaller and the space over the footer is let go; lower
	   still, the open keyboard takes the place of the word of the day, which
	   typing a letter would put away in any case. WordOfDay.svelte drops its
	   example sentence in the lowest windows. Phones scroll as phones do. */
	@media (min-width: 701px) and (max-height: 960px) {
		.word {
			--hand: 3.3rem;
		}

		:global(main:has(> .hero)) {
			padding-bottom: 1rem;
		}
	}

	@media (min-width: 701px) and (max-height: 890px) {
		.daily.with-keyboard {
			display: none;
		}
	}

	/* A box too narrow for the line and the four searches side by side (the
	   Ukrainian "Спробуйте" is the longer label): they take a line of their
	   own inside the box, under the one typed in */
	@media (max-width: 700px) {
		.field {
			flex-wrap: wrap;
		}

		.examples {
			order: 1;
			flex: 0 0 100%;
			flex-wrap: wrap;
			margin: 0;
			padding-bottom: 0.7rem;
		}
	}

	/* Phones: the title is one short line, the hand at the height of the
	   print beside it, and the box a little lower, so the first results are
	   on screen with the box (user, 2026-11-14). A desktop keeps the full
	   title. */
	@media (max-width: 600px) {
		.hero {
			padding: 0.5rem 0.75rem 0.3rem;
		}

		h1 {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			margin-bottom: 0.4rem;
		}

		.pair {
			font-size: var(--text-sm);
		}

		.word {
			--hand: 1.7rem;
		}

		input {
			padding-block: 0.6rem;
		}

		/* The results are one list on one surface, a hairline between words,
		   rather than a card each: a card's own frame and gap cost each word
		   a few lines. The frame is WordCard's, taken off here only. */
		.results:has(:global(article)) {
			gap: 0;
			overflow: hidden;
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			background: var(--surface);
			box-shadow: var(--shadow);
		}

		.results :global(.ui-card) {
			border: 0;
			border-radius: 0;
			background: none;
			box-shadow: none;
		}

		.results > li + li {
			border-top: 1px solid var(--border);
		}

		.results .divider {
			margin: 0;
			padding: 0.6rem 0.8rem 0.3rem;
			color: var(--muted);
		}
	}
</style>
