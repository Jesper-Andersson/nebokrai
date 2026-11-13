<!-- One sentence of the grammar practice (/practice) and its answer. The
     sentence stands with a noun left out and the noun's dictionary form
     under it; the form that fits is chosen among four (keys 1 to 4) or typed,
     and the rule is then said under it: the preposition, the case it asks
     for and the question that case answers.

       Кава без _____ .        цукор
       без + genitive · кого? чого? · without

     The case can be shown before answering, and a typed answer that is the
     right word in the wrong form gets one more try with the case shown. Either
     way the sentence then counts as answered with help, not as missed. The
     page makes one of these for each sentence, so nothing here outlives it;
     what the answers do to the rule's schedule the page decides
     (src/lib/practice/round.ts). -->
<script lang="ts">
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import UkrainianKeyboard from '#lib/UkrainianKeyboard.svelte';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import type { Point } from '#lib/practice/points.ts';
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

	const focus = (node: HTMLElement) => node.focus();

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
		<span class="takes"><b lang="uk">{point.preposition}</b> + <Term id={point.case} /></span>
		{#if HINTS[point.case]}<span class="question" lang="uk">{HINTS[point.case]}</span>{/if}
		<span class="meaning">{m.practice.meaning[point.id]}</span>
	</p>
{/snippet}

<article class="ui-card card">
	<p class="ask">{choice ? m.practice.ask.choice : m.practice.ask.type}</p>

	<div class="shown">
		<p class="sentence" lang="uk">
			{parts.before}{#if result}<b class="filled" data-outcome={result.outcome}>{parts.word}</b>{:else}<span
					class="blank"
					style:--letters={gap.length}
					aria-label={m.practice.yourAnswer}
				></span>{/if}{parts.after}
		</p>
		<p class="english" lang="en">{gap.en}</p>
		<p class="cue">
			<Headword text={gap.headword} size="sm" />
			{#if gap.number === 'plural'}<span class="ui-badge">{m.practice.plural}</span>{/if}
		</p>
	</div>

	{#if !result}
		{#if hinted || nudged}
			{#if nudged}<p class="nudge" role="status">{m.practice.nudge}</p>{/if}
			{@render rule()}
		{:else}
			<button type="button" class="link" onclick={() => (hinted = true)}>{m.practice.hint}</button>
		{/if}
	{/if}

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
	{:else}
		<form class="typing" onsubmit={submit}>
			<input
				bind:this={field}
				bind:value={typed}
				class="ui-field"
				type="text"
				lang="uk"
				aria-label={m.practice.yourAnswer}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
				maxlength="60"
				disabled={result !== null}
				data-is={result ? (result.outcome === 'missed' ? 'wrong' : 'right') : undefined}
				{@attach focus}
			/>
			<button type="submit" class="ui-btn" disabled={result !== null || !typed.trim()}>{m.practice.check}</button>
		</form>
		{#if !result}
			<UkrainianKeyboard id="practice-keyboard" input={field} oninsert={insert} onbackspace={backspace} onstress={() => {}} />
		{/if}
	{/if}

	{#if result}
		<div class="feedback" data-outcome={result.outcome} role="status">
			<p class="verdict">
				<Icon name={result.outcome === 'missed' ? 'x' : 'check'} size={18} />
				{result.outcome === 'right'
					? m.practice.correct
					: result.outcome === 'helped'
						? m.practice.helped
						: m.practice.incorrect}
			</p>
			<p class="answer">
				<Headword text={gap.headword} size="sm" href={wordPath(gap.word)} />
				<Icon name="arrow-right" size={16} />
				<Headword text={gap.answer} size="sm" />
			</p>
			{@render rule()}
			<button type="button" class="ui-btn ui-btn-primary next" onclick={onnext} {@attach focus}>
				{m.practice.next} <kbd class="ui-kbd">Enter</kbd>
			</button>
		</div>
	{/if}
</article>

<p class="under">
	{#if choice && !result}<span class="keys">{m.practice.keys}</span>{/if}
	<!-- The sentence's licence asks for its author's credit: the link leads to it -->
	<a class="credit" href="https://tatoeba.org/sentences/show/{gap.tatoeba_id}">Tatoeba #{gap.tatoeba_id}</a>
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

	/* The gap: a rule to write on, about as long as the word it stands for,
	   so that a long word is not guessed from a short line or the other way */
	.blank {
		display: inline-block;
		width: calc(clamp(4, var(--letters), 9) * 0.62em);
		margin-inline: 0.1em;
		border-bottom: 2px solid var(--flag-line);
		vertical-align: baseline;
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
