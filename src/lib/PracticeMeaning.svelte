<!-- A sentence of the grammar practice (/practice) asked for its meaning, not
     filled in: is it about where something is, or where it goes? у, на and
     під say one with the locative (під: the instrumental) and the other with
     the accusative, so the noun's ending is all there is to go by.

       Where, or where to?
       Підніміться на [вершину].
       [1 Де? where]   [2 Куди? where to]

     Once answered, the ending is marked and the rule is said beside its
     partner: на + accusative → куди?, на + locative → де? на вершині.
     Answered by one pick, whichever way the round is answered otherwise:
     keys 1 and 2, Enter goes on. There is no hint: with two answers it would
     give the answer away, and so would the rule's card, which "?" opens only
     after answering. The sentences are picked by hand (practice/where.ts). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import RuleCard from '#lib/RuleCard.svelte';
	import Sentence from '#lib/Sentence.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import Translation from '#lib/Translation.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { pointOf, type Point } from '#lib/practice/points.ts';
	import { cut, endingOf, split, type Gap, type Outcome } from '#lib/practice/round.ts';
	import { partnerOf, whereAnswer, type WhereAnswer } from '#lib/practice/where.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		gap,
		point,
		result,
		onanswer,
		onnext
	}: {
		gap: Gap;
		point: Point;
		/** Null until the sentence has been answered; `given` is the answer picked. */
		result: { outcome: Outcome; given: string } | null;
		onanswer: (outcome: Outcome, given: string) => void;
		onnext: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const ANSWERS: readonly WhereAnswer[] = ['where', 'whereTo'];
	const QUESTION: Record<WhereAnswer, string> = { where: 'де?', whereTo: 'куди?' };
	const SHOWN: Record<WhereAnswer, string> = { where: 'Де?', whereTo: 'Куди?' };

	let parts = $derived(split(gap));
	let right = $derived(whereAnswer(gap.point));
	/** The preposition as the sentence spells it: в where the rule says у / в. */
	let preposition = $derived(parts.before.trim().split(/\s+/).at(-1)?.toLowerCase() ?? point.cue);
	let partner = $derived(pointOf(partnerOf(gap.point)));
	/** The noun with its ending marked, in the sentence's own spelling: вершин[у]. */
	let word = $derived(cut(parts.word, endingOf(gap).letters));

	function choose(answer: WhereAnswer) {
		if (result) return;
		onanswer(answer === right ? 'right' : 'missed', answer);
	}

	// Focus must not scroll: on a phone the page would jump to Next
	const focus = (node: HTMLElement) => node.focus({ preventScroll: true });

	// On a phone the card reaches down to the foot of the screen, as the
	// fill-in card's does (PracticeGap.svelte), so the answers sit under the thumb
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

	// 1 and 2 answer, Enter goes on, by the keys' place (KeyboardEvent.code)
	function onkeydown(event: KeyboardEvent) {
		if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('[role="dialog"]')) return;
		if (result) {
			const on = event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space';
			const pressable = target?.closest('button, a, input');
			const word = pressable?.classList.contains('ui-gloss-word') && event.code !== 'Space';
			if (!on || (pressable && !word)) return;
			event.preventDefault();
			onnext();
			return;
		}
		const answer = ANSWERS[Number(/^(?:Digit|Numpad)([12])$/.exec(event.code)?.[1]) - 1];
		if (answer === undefined) return;
		event.preventDefault();
		choose(answer);
	}
</script>

<svelte:window {onkeydown} />

<!-- на + accusative → куди? -->
{#snippet takes(kase: Point['case'], answer: WhereAnswer, example?: string)}
	<p class="takes">
		<b lang="uk">{preposition}</b> + <Term id={kase} />
		<Icon name="arrow-right" size={14} />
		<b lang="uk">{QUESTION[answer]}</b>
		{#if example}<span class="example" lang="uk">{preposition} <Stressed text={example} /></span>{/if}
	</p>
{/snippet}

{#snippet next(shown: boolean)}
	<button type="button" class="ui-btn ui-btn-primary next" onclick={onnext} {@attach shown && focus}>
		{m.practice.next}
		<Icon name="arrow-right" size={18} />
		<kbd class="ui-kbd">Enter</kbd>
	</button>
{/snippet}

<article class="ui-card card" bind:this={card} style:min-height={fill ? `${fill}px` : undefined}>
	<!-- The rule's card would answer for the learner: it is there only afterwards -->
	{#if result}<RuleCard {point} {gap} first={false} onpeek={() => {}} />{/if}
	<div class="mid">
		<p class="ask">{m.practice.where.ask}</p>

		<div class="shown">
			<p class="sentence" lang="uk">
				{#if result}<Sentence text={parts.before} />{:else}{parts.before}{/if}<span class="noun"
					>{#if result}{word.stem}<span class="end">{word.ending}</span>{:else}{parts.word}{/if}</span
				>{#if result}<Sentence text={parts.after} />{:else}{parts.after}{/if}
			</p>
			<div class="english" lang="en"><Translation text={gap.en} /></div>
		</div>

		<!-- The verdict and the rule, in room kept from the start -->
		<div class="after" class:told={result !== null}>
			<div class="slot" data-outcome={result?.outcome} role="status">
				{#if result}
					<div class="said">
						<p class="verdict">
							<Icon name={result.outcome === 'missed' ? 'x' : 'check'} size={18} />
							<span class="ui-sr-only">{result.outcome === 'missed' ? m.practice.incorrect : m.practice.correct}:</span>
							{m.practice.where.told[right]}
						</p>
						{@render takes(point.case, right)}
						{#if partner}{@render takes(partner.case, right === 'where' ? 'whereTo' : 'where', gap.partner)}{/if}
					</div>
				{/if}
				<div class="ghost" aria-hidden="true" inert>
					<div class="said">
						<p class="verdict"><Icon name="check" size={18} />{m.practice.where.told.whereTo}</p>
						{@render takes(point.case, right)}
						{@render takes(point.case, right, gap.partner)}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="dock">
		<div class="go">
			{#if result}{@render next(true)}{:else}<div class="ghost" aria-hidden="true" inert>{@render next(false)}</div>{/if}
		</div>
		<div class="choices">
			{#each ANSWERS as answer, i (answer)}
				<button
					type="button"
					class="ui-btn option"
					data-is={result ? (answer === right ? 'right' : answer === result.given ? 'wrong' : undefined) : undefined}
					disabled={result !== null}
					onclick={() => choose(answer)}
				>
					<kbd class="ui-kbd">{i + 1}</kbd>
					<span class="label">
						<span class="question" lang="uk">{SHOWN[answer]}</span>
						<span class="gloss">{m.practice.where.gloss[answer]}</span>
					</span>
				</button>
			{/each}
		</div>
	</div>
</article>

<p class="under">
	<span class="keys" class:spent={result}>{m.practice.where.keys}</span>
	<a class="credit" href="https://tatoeba.org/sentences/show/{gap.tatoeba_id}">Tatoeba #{gap.tatoeba_id}</a>
</p>

<style>
	.card {
		/* The rule's "?" sits in its top corner once answered (RuleCard.svelte) */
		position: relative;
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

	/* The noun whose case decides, on the soft flag ground the gap has */
	.noun {
		padding: 0 0.1em;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: var(--flag-soft);
		box-shadow: inset 0 -2px 0 var(--flag-line);
	}

	.end {
		color: var(--accent);
	}

	.english {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.ghost {
		display: contents;
		visibility: hidden;
	}

	.spent {
		visibility: hidden;
	}

	/* The verdict and the rule on a grey ground; the padding is there from the
	   start, so the ground comes in without moving anything */
	.after {
		display: grid;
		justify-items: center;
		width: min(100%, 26rem);
		padding: 0.6rem 1rem;
		border-radius: var(--radius-md);
	}

	.after.told {
		background: var(--surface-2);
	}

	.slot {
		display: grid;
		place-items: start center;
	}

	.slot > :global(*),
	.slot > .ghost > :global(*) {
		grid-area: 1 / 1;
	}

	.said {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
	}

	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--right);
		font-weight: 700;
	}

	.slot[data-outcome='missed'] .verdict {
		color: var(--stress);
	}

	.takes {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.15rem 0.4rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.takes b,
	.example {
		color: var(--ink);
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.example {
		margin-left: 0.4rem;
	}

	.dock {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
	}

	.go {
		display: grid;
		width: min(100%, 26rem);
	}

	.next {
		flex: 1;
		justify-content: center;
		gap: 0.4rem;
		min-height: 2.9rem;
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
		padding: 0.5rem 2rem;
	}

	.option kbd {
		position: absolute;
		top: 50%;
		left: 0.6rem;
		transform: translateY(-50%);
	}

	.label {
		display: grid;
		justify-items: start;
		line-height: 1.2;
	}

	.question {
		font-family: var(--font-headword);
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.gloss {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	/* Answered: the right answer stays in full, the wrong one pressed is struck out */
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
	}

	.option[data-is='wrong'] .question {
		text-decoration: line-through;
	}

	.option[data-is] .gloss {
		color: inherit;
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

	/* A phone: the bar runs the screen's full width at the foot of the card, as the fill-in card's does */
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
			margin-inline: calc(-1rem - 1px - 0.75rem);
			padding: 0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom));
			border-top: 1px solid var(--border);
			background: var(--surface);
		}
	}

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
