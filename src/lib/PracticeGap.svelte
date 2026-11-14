<!-- One sentence of the grammar practice (/practice) and its answer. The
     sentence stands with a noun left out and the noun's dictionary form
     under it; the form that fits is chosen among four (keys 1 to 4) or typed
     into the gap, and the rule is then said under it: the preposition, the
     case it asks for and the question that case answers.

       Кава без [цук ] .       цукор
       без (without) → genitive
       Genitive answers кого? чого?

     A number's rule is said the same way, with whether it counts one or many:

       У мене 5 _____ .        книга
       5–20, 25… → genitive plural

     The case can be shown before answering, and a typed answer that is the
     right word in the wrong form gets one more try with the case shown. Either
     way the sentence then counts as answered with help, not as missed. The
     page makes one of these for each sentence, so nothing here outlives it;
     what the answers do to the rule's schedule the page decides
     (src/lib/practice/round.ts).

     On a phone the card fills the screen under the header: the sentence in
     the middle of the free room, and at the foot a bar under the thumb with
     what answers (the four forms, or Check and the on-screen keyboard) and
     then Next. Everything that answering shows has its room kept from the
     start, so nothing moves when it appears. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Collapsible } from 'melt/builders';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import Translation from '#lib/Translation.svelte';
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

	/** Typing with the on-screen keyboard: once answered, the keyboard is out of
	 *  use, and the verdict and the rule take its room instead of the sentence's. */
	let inDock = $derived(!choice && keyboard.open);

	// On a phone the card reaches down to the foot of the screen, so the bar
	// sits under the thumb and the sentence in the middle of what is left.
	// Measured from the top of the page, so it is the same whatever the scroll.
	let card: HTMLElement | undefined = $state();
	let fill = $state(0);

	onMount(() => {
		const narrow = matchMedia('(max-width: 600px)');
		const measure = () => {
			if (!card || !narrow.matches) return void (fill = 0);
			const top = card.getBoundingClientRect().top + scrollY;
			fill = Math.max(0, innerHeight - top - 12);
		};
		measure();
		addEventListener('resize', measure);
		return () => removeEventListener('resize', measure);
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

<!-- без (without) → genitive
     Genitive answers кого? чого? -->
{#snippet rule()}
	<div class="rule">
		<p class="takes">
			<b lang="uk">{point.cue}</b>
			{#if m.practice.meaning[point.id]}<span class="meaning">({m.practice.meaning[point.id]})</span>{/if}
			<Icon name="arrow-right" size={14} />
			<Term id={point.case} />
			{#if point.number}{m.practice.ofNumber[point.number]}{/if}
		</p>
		{#if HINTS[point.case]}
			<p class="question">
				{m.grammar.terms[point.case].name}
				{m.practice.answers}
				<span lang="uk">{HINTS[point.case]}</span>
			</p>
		{/if}
	</div>
{/snippet}

<!-- ✓ Right   екзамен → екзамені -->
{#snippet verdict(result: { outcome: Outcome; given: string })}
	<p class="verdict">
		<Icon name={result.outcome === 'missed' ? 'x' : 'check'} size={18} />
		{result.outcome === 'right' ? m.practice.correct : result.outcome === 'helped' ? m.practice.helped : m.practice.incorrect}
		{#if result.outcome === 'missed' && !choice}<s class="given" lang="uk">{result.given}</s>{/if}
	</p>
	<p class="answer">
		<Headword text={gap.headword} size="sm" href={wordPath(gap.word)} />
		<Icon name="arrow-right" size={16} />
		<Headword text={gap.answer} size="sm" />
	</p>
{/snippet}

<!-- Next: in the bar, where the thumb already is -->
{#snippet next(shown: boolean)}
	<button type="button" class="ui-btn ui-btn-primary next" onclick={onnext} {@attach shown && focus}>
		{m.practice.next}
		<Icon name="arrow-right" size={18} />
		<kbd class="ui-kbd">Enter</kbd>
	</button>
{/snippet}

<article class="ui-card card" bind:this={card} style:min-height={fill ? `${fill}px` : undefined}>
	<div class="mid">
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
			<div class="english" lang="en"><Translation text={gap.en} /></div>
			<p class="cue">
				<Headword text={gap.headword} size="sm" />
				{#if gap.number === 'plural' && !isNumber(point)}<span class="ui-badge">{m.practice.plural}</span>{/if}
			</p>
		</div>

		<!-- The verdict, kept in place unseen until there is one; when typing with
		     the on-screen keyboard it comes in the keyboard's place instead -->
		{#if !inDock}
			<div class="outcome" data-outcome={result?.outcome} role="status">
				{#if result}
					{@render verdict(result)}
				{:else}
					<!-- The same shape, naming the headword twice rather than the answer -->
					<div class="ghost" aria-hidden="true" inert>
						<p class="verdict"><Icon name="check" size={18} />{m.practice.correct}</p>
						<p class="answer">
							<Headword text={gap.headword} size="sm" />
							<Icon name="arrow-right" size={16} />
							<Headword text={gap.headword} size="sm" />
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- "Show the case" and the rule share one place, as tall as the rule -->
		<div class="help" class:spent={result && inDock} inert={result !== null && inDock}>
			{#if nudged && !result}<p class="nudge" role="status">{m.practice.nudge}</p>{/if}
			<div class="slot">
				{#if hinted || nudged || (result && !inDock)}
					{@render rule()}
				{:else}
					<button type="button" class="link" onclick={() => (hinted = true)}>{m.practice.hint}</button>
					<div class="ghost" aria-hidden="true" inert>{@render rule()}</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="dock">
		{#if choice}
			<div class="go">
				{#if result}{@render next(true)}{:else}<div class="ghost" aria-hidden="true" inert>{@render next(false)}</div>{/if}
			</div>
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
		{:else}
			<form id="practice-answer" class="actions" onsubmit={submit}>
				{#if result}
					{@render next(true)}
				{:else}
					<button type="submit" class="ui-btn ui-btn-primary next" disabled={!typed.trim()}>{m.practice.check}</button>
				{/if}
				<button {...keyboard.trigger} type="button" class="ui-btn keys-toggle" title={m.keyboard.toggle}>
					<Icon name="keyboard" size={20} />
					{m.practice.keyboard}
					<span class="turn" class:open={keyboard.open}><Icon name="chevron-right" size={16} /></span>
				</button>
			</form>
			<!-- The keyboard, and once answered the verdict and the rule in its room -->
			<div class="board">
				<div {...keyboard.content} class="keys-board" class:spent={result} inert={result !== null}>
					{#if keyboard.open}
						<UkrainianKeyboard id="practice-keyboard" input={field} oninsert={insert} onbackspace={backspace} onstress={() => {}} />
					{/if}
				</div>
				{#if inDock && result}
					<div class="outcome panel" data-outcome={result.outcome} role="status">
						{@render verdict(result)}
						{@render rule()}
					</div>
				{/if}
			</div>
		{/if}
	</div>
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
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
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

	/* The sentence and what is said about it, in the middle of the free room */
	.mid {
		display: grid;
		flex: 1;
		align-content: center;
		justify-items: center;
		gap: 0.9rem;
		text-align: center;
	}

	.ask {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.shown {
		display: grid;
		justify-items: center;
		gap: 0.45rem;
	}

	.sentence {
		font-family: var(--font-headword);
		font-size: var(--headword-md);
		font-weight: 600;
		line-height: 1.5;
		overflow-wrap: anywhere;
		text-wrap: balance;
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
		/* The soft flag fill, so the gap reads as a field */
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
		background: var(--right-soft);
		color: var(--right);
		font-weight: 800;
	}

	.filled[data-outcome='missed'] {
		background: none;
		color: inherit;
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

	/* Kept in place, unseen, until it is needed */
	.ghost {
		display: contents;
		visibility: hidden;
	}

	.spent {
		visibility: hidden;
	}

	.outcome {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
	}

	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--right);
		font-weight: 700;
	}

	.outcome[data-outcome='missed'] .verdict {
		color: var(--stress);
	}

	.given {
		color: var(--stress);
		font-family: var(--font-headword);
	}

	.answer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem 0.5rem;
		color: var(--muted);
	}

	.help {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
	}

	/* The link and the unseen rule in one cell, as tall as the rule */
	.slot {
		display: grid;
		/* The link at the top, right under the word: the room below it is only kept */
		place-items: start center;
	}

	.slot > :global(*),
	.slot > .ghost > :global(*) {
		grid-area: 1 / 1;
	}

	.rule {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		font-size: var(--text-sm);
	}

	.takes {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.15rem 0.4rem;
		font-weight: 700;
	}

	.takes b {
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.meaning,
	.question {
		color: var(--ink-2);
		font-weight: 400;
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

	/* What answers, and then Next */
	.dock {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
	}

	.go {
		display: grid;
		width: min(100%, 26rem);
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
		width: min(100%, 26rem);
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
		border-color: var(--right);
		background: var(--right-soft);
		color: var(--right);
	}

	.option[data-is='wrong'] {
		border-color: var(--stress);
		color: var(--stress);
		text-decoration: line-through;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		width: min(100%, 26rem);
	}

	.next {
		flex: 1;
		justify-content: center;
		gap: 0.4rem;
		min-height: 2.9rem;
	}

	.keys-toggle {
		gap: 0.35rem;
		color: var(--ink-2);
	}

	.turn {
		display: inline-flex;
		transform: rotate(-90deg);
		transition: transform 0.15s;
	}

	.turn.open {
		transform: rotate(90deg);
	}

	/* The keyboard and the answer's panel in one cell, as tall as the keyboard */
	.board {
		display: grid;
		width: 100%;
	}

	.board > * {
		grid-area: 1 / 1;
	}

	.panel {
		align-content: center;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		background: var(--surface-2);
		text-align: center;
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

	/* A phone (the width app.css narrows the page's gutter at): the sentence
	   gets two lines' room, and the bar runs the screen's full width at the
	   foot of the card, staying in sight */
	@media (max-width: 600px) {
		.card {
			padding: 1rem 1rem 0;
		}

		.sentence {
			min-height: calc(2 * 1.5em);
		}

		.dock {
			position: sticky;
			bottom: 0;
			/* Out over the card's padding and border and the page's gutter
			   (.ui-page in app.css), to the screen's edges */
			margin-inline: calc(-1rem - 1px - 0.75rem);
			padding: 0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom));
			border-top: 1px solid var(--border);
			background: var(--surface);
		}

		/* The keys as wide as the screen, as a phone's own keyboard */
		.board {
			justify-self: stretch;
			width: auto;
			margin-inline: -0.6rem;
		}
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
