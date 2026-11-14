<!-- One sentence of the grammar practice (/practice) and its answer. The
     sentence stands with a noun left out and the noun's dictionary form
     under it; the form that fits is chosen among four (keys 1 to 4) or typed,
     and the rule is then said under it: the preposition, the case it asks
     for and the question that case answers.

       Кава без _____ .        цукор
       без + genitive · кого? чого? · without

     A number's rule is said the same way, with whether it counts one or many:

       У мене 5 _____ .        книга
       5–20, 25… + genitive plural · кого? чого?

     The case can be shown before answering, and a typed answer that is the
     right word in the wrong form gets one more try with the case shown. Either
     way the sentence then counts as answered with help, not as missed. The
     page makes one of these for each sentence, so nothing here outlives it;
     what the answers do to the rule's schedule the page decides
     (src/lib/practice/round.ts). -->
<script lang="ts">
	import { Collapsible } from 'melt/builders';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import UkrainianKeyboard from '#lib/UkrainianKeyboard.svelte';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { isNumber, type Point } from '#lib/practice/points.ts';
	import { checkAnswer, split, type Gap, type Outcome } from '#lib/practice/round.ts';
	import { plain } from '#lib/search/normalize.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		gap,
		point,
		choice,
		result,
		onanswer,
		onnext
	}: {
		gap: Gap;
		point: Point;
		/** Answered by choosing among the gap's four forms; otherwise by typing. */
		choice: boolean;
		/** Null until the sentence has been answered. */
		result: { outcome: Outcome; given: string } | null;
		onanswer: (outcome: Outcome, given: string) => void;
		onnext: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let parts = $derived(split(gap));
	let right = $derived(plain(gap.answer));

	/** The case was asked for before answering. */
	let hinted = $state(false);
	/** A first typed answer was the right word in another form. */
	let nudged = $state(false);
	let typed = $state('');
	let field: HTMLInputElement | undefined = $state();

	function choose(option: string) {
		if (result) return;
		onanswer(plain(option) === right ? (hinted ? 'helped' : 'right') : 'missed', option);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (result || !typed.trim()) return;
		const found = checkAnswer(gap, typed);
		if (found === 'right') onanswer(hinted || nudged ? 'helped' : 'right', typed);
		else if (found === 'form' && !nudged) {
			// The word is known and the ending is not: the case is shown, and the field waits for another try
			nudged = true;
			field?.select();
		} else onanswer('missed', typed);
	}

	// The on-screen keyboard's keys write at the end: the field holds one short word
	const insert = (text: string) => (typed += text);
	const backspace = () => (typed = [...typed].slice(0, -1).join(''));

	// Focus must not scroll: on a phone the page would jump to the field or to Next
	const focus = (node: HTMLElement) => node.focus({ preventScroll: true });

	// A sentence is only ever shown in the browser (the round fetches it), so
	// these are read once, as the card is made, and the first paint is right.
	/** A touch screen: focusing the field there opens the phone's own keyboard. */
	const touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

	// The on-screen keyboard can be put away. Whether it is open is remembered in
	// this browser only; without storage it is open, as it always was.
	const KEYBOARD_KEY = 'nebokrai-practice-keyboard';
	let keyboardOpen = $state(readOpen());

	function readOpen() {
		try {
			return localStorage.getItem(KEYBOARD_KEY) !== '0';
		} catch {
			return true;
		}
	}

	const keyboard = new Collapsible({
		open: () => keyboardOpen,
		onOpenChange: (open) => {
			keyboardOpen = open;
			try {
				localStorage.setItem(KEYBOARD_KEY, open ? '1' : '0');
			} catch {}
			field?.focus({ preventScroll: true });
		}
	});

	// 1 to 4 choose, Enter goes on. Keys are known by their place
	// (KeyboardEvent.code), so they work with a Ukrainian layout switched on.
	function onkeydown(event: KeyboardEvent) {
		if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target instanceof Element ? event.target : null;
		// Not while the quick search or a grammar note is open over the page
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
		const option = gap.choices[Number(/^(?:Digit|Numpad)([1-4])$/.exec(event.code)?.[1]) - 1];
		if (option === undefined) return;
		event.preventDefault();
		choose(option);
	}
</script>

<svelte:window {onkeydown} />

<!-- без + genitive · кого? чого? · without -->
{#snippet rule()}
	<p class="rule">
		<span class="takes">
			<b lang="uk">{point.cue}</b> + <Term id={point.case} />
			{#if point.number}{m.practice.ofNumber[point.number]}{/if}
		</span>
		{#if HINTS[point.case]}<span class="question" lang="uk">{HINTS[point.case]}</span>{/if}
		<span class="meaning">{m.practice.meaning[point.id]}</span>
	</p>
{/snippet}

<!-- What the answer says: shown after answering, and before it kept in place,
     unseen, so that answering fills the room instead of pushing the page down.
     The unseen copy names the headword twice, not the answer. -->
{#snippet feedback(outcome: Outcome | null)}
	<p class="verdict">
		<Icon name={outcome === 'missed' ? 'x' : 'check'} size={18} />
		{outcome === 'helped' ? m.practice.helped : outcome === 'missed' ? m.practice.incorrect : m.practice.correct}
		{#if outcome === 'missed' && !choice && result}<s class="given" lang="uk">{result.given}</s>{/if}
	</p>
	<p class="answer">
		<Headword text={gap.headword} size="sm" href={outcome ? wordPath(gap.word) : undefined} />
		<Icon name="arrow-right" size={16} />
		<Headword text={outcome ? gap.answer : gap.headword} size="sm" />
	</p>
	{@render rule()}
	<button type="button" class="ui-btn ui-btn-primary next" onclick={onnext} {@attach outcome && focus}>
		{m.practice.next} <kbd class="ui-kbd">Enter</kbd>
	</button>
{/snippet}

<article class="ui-card card">
	<p class="ask">{choice ? m.practice.ask.choice : m.practice.ask.type}</p>

	<div class="shown">
		<p class="sentence" lang="uk">
			{parts.before}{#if result}<b class="filled" data-outcome={result.outcome}>{parts.word}</b
				>{:else if choice}<span class="blank" style:--letters={gap.length} aria-label={m.practice.yourAnswer}></span
				>{:else}<input
					bind:this={field}
					bind:value={typed}
					class="blank field"
					style:--letters={Math.max(gap.length, [...typed].length + 1)}
					type="text"
					form="practice-answer"
					aria-label={m.practice.yourAnswer}
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					maxlength="60"
					inputmode={keyboardOpen ? 'none' : undefined}
					{@attach (!touch || keyboardOpen) && focus}
				/>{/if}{parts.after}
		</p>
		<p class="english" lang="en">{gap.en}</p>
		<p class="cue">
			<Headword text={gap.headword} size="sm" />
			{#if gap.number === 'plural' && !isNumber(point)}<span class="ui-badge">{m.practice.plural}</span>{/if}
		</p>
	</div>

	<!-- Kept in place once answered, unseen, so nothing under it moves up -->
	<div class="help" class:spent={result} inert={result !== null}>
		{#if hinted || nudged}
			{#if nudged}<p class="nudge" role="status">{m.practice.nudge}</p>{/if}
			{@render rule()}
		{:else}
			<button type="button" class="link" onclick={() => (hinted = true)}>{m.practice.hint}</button>
		{/if}
	</div>

	{#if choice}
		<div class="choices">
			{#each gap.choices as option, i (option)}
				<button
					type="button"
					class="ui-btn option"
					lang="uk"
					data-is={result ? (plain(option) === right ? 'right' : option === result.given ? 'wrong' : undefined) : undefined}
					disabled={result !== null}
					onclick={() => choose(option)}
				>
					<kbd class="ui-kbd">{i + 1}</kbd>
					<span><Stressed text={option} /></span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Check and the feedback share one place: Next comes where Check was -->
	<div class="after">
		{#if !choice}
			<form id="practice-answer" class="typing" class:spent={result} inert={result !== null} onsubmit={submit}>
				<button type="submit" class="ui-btn ui-btn-primary" disabled={!typed.trim()}>{m.practice.check}</button>
				<button
					{...keyboard.trigger}
					type="button"
					class="ui-icon-btn"
					aria-label={m.keyboard.toggle}
					title={m.keyboard.toggle}
				>
					<Icon name="keyboard" size={22} />
				</button>
			</form>
		{/if}
		<div class="feedback" class:waiting={!result} data-outcome={result?.outcome} role="status">
			{#if result}
				{@render feedback(result.outcome)}
			{:else}
				<div class="ghost" aria-hidden="true" inert>{@render feedback(null)}</div>
			{/if}
		</div>
	</div>

	{#if !choice}
		<div {...keyboard.content} class="keys-board" class:spent={result} inert={result !== null}>
			{#if keyboard.open}
				<UkrainianKeyboard id="practice-keyboard" input={field} oninsert={insert} onbackspace={backspace} onstress={() => {}} />
			{/if}
		</div>
	{/if}
</article>

<p class="under">
	{#if choice}<span class="keys" class:spent={result}>{m.practice.keys}</span>{/if}
	<!-- The sentence's licence asks for its author's credit: the link leads to it -->
	<!-- A number's sentence is made here, not taken from Tatoeba: there is no one to credit -->
	{#if gap.tatoeba_id}
		<a class="credit" href="https://tatoeba.org/sentences/show/{gap.tatoeba_id}">Tatoeba #{gap.tatoeba_id}</a>
	{/if}
</p>

<style>
	.card {
		display: grid;
		gap: 1.1rem;
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

	.ask {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.shown {
		display: grid;
		justify-items: center;
		gap: 0.45rem;
		text-align: center;
	}

	.sentence {
		font-family: var(--font-headword);
		font-size: var(--headword-md);
		font-weight: 600;
		line-height: 1.5;
		overflow-wrap: anywhere;
		text-wrap: balance;
	}

	/* On a phone a sentence takes one line or two: two lines' room either way,
	   so the next sentence does not move what is under it */
	@media (max-width: 40rem) {
		.sentence {
			min-height: calc(2 * 1.5em);
		}
	}

	/* The gap: a rule to write on, about as long as the word it stands for,
	   so that a long word is not guessed from a short line or the other way */
	.blank {
		display: inline-block;
		width: calc(clamp(4, var(--letters), 9) * 0.62em);
		margin-inline: 0.1em;
		border-bottom: 2px solid var(--flag-line);
		vertical-align: baseline;
	}

	/* Typing: the gap itself is the field, in the sentence's own letters */
	.field {
		max-width: 100%;
		padding: 0;
		border: 0;
		border-bottom: 2px solid var(--flag-line);
		/* The soft flag fill the answered word gets, so the gap reads as a field */
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: var(--flag-soft);
		color: var(--ink);
		font: inherit;
		line-height: 1.2;
		text-align: center;
		caret-color: var(--ink);
	}

	.field:focus-visible {
		outline: none;
		border-bottom-color: var(--accent);
	}

	.filled {
		padding: 0 0.2em;
		border-radius: var(--radius-sm);
		background: var(--flag-soft);
		font-weight: 800;
	}

	.filled[data-outcome='missed'] {
		background: none;
		box-shadow: inset 0 -2px 0 var(--stress);
	}

	.english {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.cue {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.rule {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0.15rem 0.75rem;
		font-size: var(--text-sm);
		text-align: center;
	}

	.takes {
		font-weight: 700;
	}

	.takes b {
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.question,
	.meaning {
		color: var(--ink-2);
	}

	.nudge {
		color: var(--ink);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		cursor: pointer;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
		width: min(100%, 26rem);
	}

	/* A noun's forms can be long (відповідальністю): one to a line on a phone */
	@media (max-width: 30rem) {
		.choices {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.option {
		position: relative;
		justify-content: center;
		min-height: 3.25rem;
		padding: 0.6rem 2rem;
		font-family: var(--font-headword);
		font-size: var(--text-lg);
		font-weight: 700;
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

	/* Answered: still taking its room, so nothing under it moves up */
	.spent {
		visibility: hidden;
	}

	.help {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
	}

	/* Check and the feedback in one grid cell, as tall as the feedback:
	   Check stands at the foot of it, where Next will be */
	.after {
		display: grid;
		width: 100%;
	}

	.after > * {
		grid-area: 1 / 1;
	}

	.typing {
		display: flex;
		align-self: end;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
	}

	/* The on-screen keyboard stays where it is once answered, out of use */
	.keys-board {
		width: 100%;
	}

	.keys-board.spent {
		visibility: visible;
		opacity: 0.4;
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

	.feedback.waiting {
		border-top-color: transparent;
	}

	.ghost {
		display: contents;
		visibility: hidden;
	}

	.given {
		color: var(--stress);
		font-family: var(--font-headword);
	}

	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--flag-line);
		font-weight: 700;
	}

	.feedback[data-outcome='missed'] .verdict {
		color: var(--stress);
	}

	.answer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem 0.5rem;
		color: var(--muted);
	}

	.next {
		margin-top: 0.5rem;
	}

	.under {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 1rem;
		color: var(--on-page);
		font-size: var(--text-sm);
		text-align: center;
	}

	.credit {
		color: inherit;
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
