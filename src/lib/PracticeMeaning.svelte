<!-- A sentence of the grammar practice (/practice) asked for its meaning, not
     filled in. Two kinds, answered alike by one of two picks:

     Is it about where something is, or where it goes? у, на and під say one
     with the locative (під: the instrumental) and the other with the
     accusative (practice/where.ts).

       Where, or where to?
       Підніміться на [вершину].
       [1 Де? where]   [2 Куди? where to]

     Which of two nouns does it? The one in the dictionary form, whatever the
     order of the words (practice/roles.ts).

       Who sees whom?
       [Собаку] бачить [кіт].
       [1 собака → кіт]   [2 кіт → собака]

     Once answered, the ending is marked and the rule is said: на + accusative
     → куди? beside на + locative → де? на вершині; кіт answers хто?, собаку
     answers кого?. Keys 1 and 2, Enter goes on. The English is shown only
     then, as it would answer the question, and so would a hint or the rule's
     card, which "?" opens only after answering. -->
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
		first = false,
		result,
		onanswer,
		onnext
	}: {
		gap: Gap;
		point: Point;
		/** The rule is met here for the first time (who-whom only): its card opens over the sentence. */
		first?: boolean;
		/** Null until the sentence has been answered; `given` is the answer picked. */
		result: { outcome: Outcome; given: string } | null;
		onanswer: (outcome: Outcome, given: string) => void;
		onnext: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	/** A pick: де? or куди?; or which noun the arrow starts from, the one that does it or the one done to. */
	type Pick = WhereAnswer | 'doer' | 'done';

	const QUESTION: Record<WhereAnswer, string> = { where: 'де?', whereTo: 'куди?' };
	const SHOWN: Record<WhereAnswer, string> = { where: 'Де?', whereTo: 'Куди?' };
	const isWhere = (pick: Pick): pick is WhereAnswer => pick === 'where' || pick === 'whereTo';

	/** A who item's verb and the noun that does it; null for a where item. */
	let who = $derived(gap.kind === 'who' && gap.roles ? gap.roles : null);
	// The two arrows in either order, drawn once for the sentence (each makes
	// its own card), so the place of the right one says nothing
	const flip = Math.random() < 0.5;
	let picks = $derived<readonly Pick[]>(who ? (flip ? ['doer', 'done'] : ['done', 'doer']) : ['where', 'whereTo']);
	let right = $derived<Pick>(who ? 'doer' : whereAnswer(gap.point));

	let parts = $derived(split(gap));
	/** The preposition as the sentence spells it: в where the rule says у / в. */
	let preposition = $derived(parts.before.trim().split(/\s+/).at(-1)?.toLowerCase() ?? point.cue);
	let partner = $derived(who ? undefined : pointOf(partnerOf(gap.point)));
	/** The noun whose ending tells, in the sentence's own spelling, its ending marked: вершин[у], Собак[у]. */
	let word = $derived(cut(parts.word, endingOf(gap).letters));
	/** The sentence in pieces round its marked nouns: one for a where item, two for a who item. */
	let pieces = $derived.by(() => {
		const marks = [{ start: gap.start, length: gap.length, done: true }];
		if (who) marks.push({ start: who.doer.start, length: who.doer.length, done: false });
		marks.sort((a, b) => a.start - b.start);
		const out: { text: string; mark?: 'done' | 'doer' }[] = [];
		let at = 0;
		for (const mark of marks) {
			out.push({ text: gap.uk.slice(at, mark.start) });
			out.push({ text: gap.uk.slice(mark.start, mark.start + mark.length), mark: mark.done ? 'done' : 'doer' });
			at = mark.start + mark.length;
		}
		out.push({ text: gap.uk.slice(at) });
		return out;
	});

	function choose(pick: Pick) {
		if (result) return;
		onanswer(pick === right ? 'right' : 'missed', pick);
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
		const pick = picks[Number(/^(?:Digit|Numpad)([12])$/.exec(event.code)?.[1]) - 1];
		if (pick === undefined) return;
		event.preventDefault();
		choose(pick);
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

<!-- кіт answers хто? · собаку answers кого? -->
{#snippet roles(doer: string)}
	<p class="takes">
		<b lang="uk"><Stressed text={doer} /></b>
		{m.practice.answers}
		<b lang="uk">хто?</b>
		<span aria-hidden="true">·</span>
		<b lang="uk"><Stressed text={gap.answer} /></b>
		{m.practice.answers}
		<b lang="uk">кого?</b>
	</p>
	<p class="takes">{m.practice.who.order}</p>
{/snippet}

<!-- What a pick says: Де? where; or кіт → собака -->
{#snippet label(pick: Pick)}
	{#if isWhere(pick)}
		<span class="label">
			<span class="question" lang="uk">{SHOWN[pick]}</span>
			<span class="gloss">{m.practice.where.gloss[pick]}</span>
		</span>
	{:else if who}
		{@const [from, to] = pick === 'doer' ? [who.doer.headword, gap.headword] : [gap.headword, who.doer.headword]}
		<span class="question arrow" lang="uk"
			><span><Stressed text={from} /></span><Icon name="arrow-right" size={16} /><span><Stressed text={to} /></span></span
		>
	{/if}
{/snippet}

{#snippet next(shown: boolean)}
	<button type="button" class="ui-btn ui-btn-primary next" onclick={onnext} {@attach shown && focus}>
		{m.practice.next}
		<Icon name="arrow-right" size={18} />
		<kbd class="ui-kbd">Enter</kbd>
	</button>
{/snippet}

<article class="ui-card card" bind:this={card} style:min-height={fill ? `${fill}px` : undefined}>
	<!-- The rule's card would answer for the learner: it is there only
	     afterwards, or over the first sentence of a rule never met, to teach it -->
	{#if result || first}<RuleCard {point} {gap} {first} onpeek={() => {}} />{/if}
	<div class="mid">
		<p class="ask">{who ? m.practice.who.ask[who.verb] : m.practice.where.ask}</p>

		<div class="shown">
			<p class="sentence" lang="uk">
				{#each pieces as piece, i (i)}{#if piece.mark}<span class="noun"
							>{#if result && piece.mark === 'done'}{word.stem}<span class="end">{word.ending}</span
								>{:else}{piece.text}{/if}</span
						>{:else if result}<Sentence text={piece.text} />{:else}{piece.text}{/if}{/each}
			</p>
			<!-- Kept unseen until answered, holding its room -->
			<div class="english" class:spent={!result} lang="en"><Translation text={gap.en} /></div>
		</div>

		<!-- The verdict and the rule, in room kept from the start -->
		<div class="after" class:told={result !== null}>
			<div class="slot" data-outcome={result?.outcome} role="status">
				{#if result}
					<div class="said">
						<p class="verdict">
							<Icon name={result.outcome === 'missed' ? 'x' : 'check'} size={18} />
							<span class="ui-sr-only">{result.outcome === 'missed' ? m.practice.incorrect : m.practice.correct}:</span>
							{#if who}{gap.en}{:else if isWhere(right)}{m.practice.where.told[right]}{/if}
						</p>
						{#if who}
							{@render roles(who.doer.headword)}
						{:else if isWhere(right)}
							{@render takes(point.case, right)}
							{#if partner}{@render takes(partner.case, right === 'where' ? 'whereTo' : 'where', gap.partner)}{/if}
						{/if}
					</div>
				{/if}
				<div class="ghost" aria-hidden="true" inert>
					<div class="said">
						<p class="verdict"><Icon name="check" size={18} />{who ? gap.en : m.practice.where.told.whereTo}</p>
						{#if who}
							{@render roles(who.doer.headword)}
						{:else}
							{@render takes(point.case, 'where')}
							{@render takes(point.case, 'where', gap.partner)}
						{/if}
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
			{#each picks as pick, i (pick)}
				<button
					type="button"
					class="ui-btn option"
					data-is={result ? (pick === right ? 'right' : pick === result.given ? 'wrong' : undefined) : undefined}
					disabled={result !== null}
					onclick={() => choose(pick)}
				>
					<kbd class="ui-kbd">{i + 1}</kbd>
					{@render label(pick)}
				</button>
			{/each}
		</div>
	</div>
</article>

<p class="under">
	<span class="keys" class:spent={result}>{m.practice.where.keys}</span>
	<!-- A who sentence is made here, not taken from Tatoeba: there is no one to credit -->
	{#if gap.tatoeba_id}
		<a class="credit" href="https://tatoeba.org/sentences/show/{gap.tatoeba_id}">Tatoeba #{gap.tatoeba_id}{#if gap.adapted}, {m.word.adapted}{/if}</a>
	{/if}
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

	.arrow {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.arrow :global(svg) {
		color: var(--muted);
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
