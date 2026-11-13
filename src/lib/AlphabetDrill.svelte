<!-- One prompt of the alphabet trainer (/alphabet) and its answer. A letter or
     a word is shown; it is answered by pressing one of four choices (keys 1
     to 4) or by typing, and what was right is then said under it, with the
     recording where there is one. The page makes one of these for each
     prompt, so nothing here outlives its prompt. What is asked, and whether an
     answer is right, the page decides (src/lib/alphabet/drill.ts).

     Typing a Ukrainian letter needs a Ukrainian keyboard, which a learner of
     the alphabet seldom has: the on-screen one of the search box stands under
     the field, and reads a Latin keyboard's keys as its own. -->
<script lang="ts">
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import UkrainianKeyboard from '#lib/UkrainianKeyboard.svelte';
	import { answerOf, type Options, type Prompt } from '#lib/alphabet/drill.ts';
	import { isSign, letterInfo, pair } from '#lib/alphabet/letters.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordCard } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		prompt,
		direction,
		choice,
		offered,
		result,
		card,
		sound,
		check,
		onanswer,
		onnext,
		onplay
	}: {
		prompt: Prompt;
		direction: Options['direction'];
		/** Answered by choosing among `offered`; otherwise by typing. */
		choice: boolean;
		offered: string[];
		/** Null until the prompt has been answered. */
		result: { correct: boolean; given: string } | null;
		/** What the dictionary has for a word, once fetched. */
		card: WordCard | undefined;
		/** The address of the prompt's recording, if it has one. */
		sound: string | undefined;
		/** Whether what has been typed so far is already the answer. */
		check: (typed: string) => boolean;
		onanswer: (given: string) => void;
		onnext: () => void;
		onplay: (url: string) => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let info = $derived(prompt.kind === 'letter' ? letterInfo(prompt.item) : undefined);
	let right = $derived(answerOf(prompt));
	let write = $derived(direction === 'write');

	let ask = $derived.by(() => {
		const a = m.alphabet.ask;
		if (prompt.kind === 'word') return choice ? a.wordChoice : a.wordType;
		if (write) return choice ? a.writeChoice : a.writeType;
		if (isSign(prompt.item)) return a.signChoice;
		return choice ? a.letterChoice : a.letterType;
	});

	/** A choice as it is printed: a letter's Latin when read, the letter when written, a word's reading. */
	const label = (option: string) =>
		prompt.kind === 'word' ? option : write ? pair(option) : letterInfo(option)?.latin || m.alphabet.sign[option];

	let typed = $state('');
	let field: HTMLInputElement | undefined = $state();

	/**
	 * The answer is taken the moment it is right: no need to press Enter after
	 * "zh". A Ukrainian letter is one key, so there the first letter typed is
	 * the answer, right or wrong.
	 */
	function changed() {
		if (!result && (check(typed) || (write && typed.trim()))) onanswer(typed);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!result && typed.trim()) onanswer(typed);
	}

	// The on-screen keyboard's keys. A letter is one letter: the last key pressed replaces the one before.
	function insert(text: string) {
		if (result) return;
		typed = text.trim();
		changed();
	}

	const focus = (node: HTMLElement) => node.focus();

	// 1 to 4 choose, Enter goes on. Keys are known by their place
	// (KeyboardEvent.code), so they work with a Ukrainian layout switched on.
	function onkeydown(event: KeyboardEvent) {
		if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target instanceof Element ? event.target : null;
		// Not while the quick search is open over the page
		if (target?.closest('[role="dialog"]')) return;
		if (result) {
			const on = event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space';
			// A focused button or link is pressed by these keys itself
			if (!on || target?.closest('button, a, input')) return;
			event.preventDefault();
			onnext();
			return;
		}
		if (!choice || target?.closest('input, textarea, select')) return;
		const option = offered[Number(/^(?:Digit|Numpad)([1-4])$/.exec(event.code)?.[1]) - 1];
		if (option === undefined) return;
		event.preventDefault();
		onanswer(option);
	}
</script>

<svelte:window {onkeydown} />

<article class="ui-card card">
	<p class="ask">{ask}</p>

	{#if prompt.kind === 'letter' && info && write}
		<p class="shown">
			<span class="glyph latin">{info.latin}</span>
			<span class="about">
				{#if info.ipa}<span class="ipa">/{info.ipa}/</span>{/if}
				<span lang="en">{info.hint}</span>
			</span>
		</p>
	{:else}
		<p class="shown">
			<span class="glyph" lang="uk">
				{prompt.kind === 'letter' ? pair(prompt.item) : prompt.item}
			</span>
		</p>
	{/if}

	{#if choice}
		<div class="choices" class:wide={prompt.kind === 'word' || (!write && isSign(prompt.item))}>
			{#each offered as option, i (option)}
				<button
					type="button"
					class="ui-btn option"
					data-is={result ? (option === right ? 'right' : option === result.given ? 'wrong' : undefined) : undefined}
					disabled={result !== null}
					onclick={() => onanswer(option)}
				>
					<kbd class="ui-kbd">{i + 1}</kbd>
					<span lang={write ? 'uk' : undefined}>{label(option)}</span>
				</button>
			{/each}
		</div>
	{:else}
		<form class="typing" onsubmit={submit}>
			<input
				bind:this={field}
				bind:value={typed}
				class="ui-field"
				type="text"
				lang={write ? 'uk' : 'en'}
				aria-label={m.alphabet.yourAnswer}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
				maxlength="40"
				disabled={result !== null}
				data-is={result ? (result.correct ? 'right' : 'wrong') : undefined}
				oninput={changed}
				{@attach focus}
			/>
			<button type="submit" class="ui-btn" disabled={result !== null || !typed.trim()}>{m.alphabet.check}</button>
		</form>
		{#if write && !result}
			<UkrainianKeyboard
				id="alphabet-keyboard"
				input={field}
				oninsert={insert}
				onbackspace={() => (typed = '')}
				onstress={() => {}}
			/>
		{/if}
	{/if}

	{#if result}
		<div class="feedback" data-correct={result.correct} role="status">
			<p class="verdict">
				<Icon name={result.correct ? 'check' : 'x'} size={18} />
				{result.correct ? m.alphabet.correct : m.alphabet.incorrect}
			</p>
			<p class="answer">
				{#if !result.correct}<span class="muted">{m.alphabet.answerIs}</span>{/if}
				{#if info}
					<span class="letter" lang="uk">{pair(info.letter)}</span>
					<span class="reading">{info.latin || m.alphabet.sign[info.letter]}</span>
				{:else}
					<Headword text={card?.headword ?? prompt.item} size="sm" href={wordPath(prompt.item)} />
					<span class="reading">{right}</span>
				{/if}
				{#if sound}
					{@const url = sound}
					<button type="button" class="ui-icon-btn" aria-label={m.word.playRecording} onclick={() => onplay(url)}>
						<Icon name="speaker" />
					</button>
				{/if}
			</p>
			{#if info}
				<p class="muted">
					<span lang="uk">{info.name}</span>
					{#if info.ipa}{' · '}<span class="ipa">/{info.ipa}/</span>{/if}
					{' · '}<span lang="en">{info.hint}</span>
				</p>
			{:else if card?.glosses[0]}
				<p class="muted" lang="en">{card.glosses[0]}</p>
			{/if}
			<button type="button" class="ui-btn ui-btn-primary next" onclick={onnext} {@attach focus}>
				{m.alphabet.next} <kbd class="ui-kbd">Enter</kbd>
			</button>
		</div>
	{/if}
</article>

{#if choice && !result}
	<p class="muted keys">{m.alphabet.keys}</p>
{/if}

<style>
	.card {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 1.5rem 1.25rem;
		animation: come-up 0.24s ease-out both;
	}

	@keyframes come-up {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
		}
	}

	p {
		margin: 0;
	}

	.ask,
	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.shown {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		min-height: 5rem;
		align-content: center;
		text-align: center;
	}

	.glyph {
		font-family: var(--font-headword);
		font-size: var(--headword-lg);
		font-weight: 800;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}

	/* Latin shown to be written in Cyrillic: in the text face, so it is not taken for a Ukrainian letter */
	.glyph.latin {
		font-family: var(--font-text);
		font-weight: 700;
	}

	.about {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.15rem 0.6rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.ipa {
		font-family: var(--font-ipa);
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
		width: min(100%, 24rem);
	}

	/* Words and the signs' names are long: one to a line on a phone */
	@media (max-width: 30rem) {
		.choices.wide {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.option {
		position: relative;
		justify-content: center;
		min-height: 3.25rem;
		padding: 0.6rem 2rem;
		font-size: var(--text-lg);
		overflow-wrap: anywhere;
	}

	.option kbd {
		position: absolute;
		top: 50%;
		left: 0.6rem;
		transform: translateY(-50%);
	}

	/* Answered: the right choice stays in full, the wrong one pressed is struck out */
	.option:disabled {
		opacity: 1;
		color: var(--muted);
		cursor: default;
	}

	.option[data-is='right'] {
		border-color: var(--flag-line);
		background: var(--flag-soft);
		color: var(--ink);
	}

	.option[data-is='wrong'] {
		border-color: var(--stress);
		color: var(--stress);
		text-decoration: line-through;
	}

	.typing {
		display: flex;
		gap: 0.5rem;
		width: min(100%, 24rem);
	}

	.typing input {
		flex: 1;
		min-width: 0;
		font-size: var(--text-lg);
		text-align: center;
	}

	.typing input[data-is='right'] {
		border-color: var(--flag-line);
	}

	.typing input[data-is='wrong'] {
		border-color: var(--stress);
		color: var(--stress);
		text-decoration: line-through;
	}

	.feedback {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		width: 100%;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		text-align: center;
	}

	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 700;
	}

	.feedback[data-correct='true'] .verdict {
		color: var(--flag-line);
	}

	.feedback[data-correct='false'] .verdict {
		color: var(--stress);
	}

	.answer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem 0.6rem;
	}

	.letter {
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
		font-weight: 800;
	}

	.reading {
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.next {
		margin-top: 0.5rem;
	}

	.keys {
		text-align: center;
	}

	/* No keyboard to press 1 to 4 or Enter on */
	@media (hover: none) {
		.keys,
		kbd {
			display: none;
		}

		.option {
			padding-inline: 0.75rem;
		}
	}
</style>
