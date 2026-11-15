<!-- A flashcard answered by typing (/review), for a word reviewed before: the
     design the user chose on 2026-11-15 ("B · The word first, then its form").
     Two steps on one card. First the meaning, and the Ukrainian word to type:
       water   noun   [вода      ]
     then the card's Tatoeba sentence, asking for the form it needs:
       ✓ вода́   Please give me a glass of water.
       Дайте, будь ласка, склянку [    ].
     A word typed in another form (воду) still counts as the word; a Latin
     answer near it gets one more try. In the sentence, the right word with
     another ending gets one more try too, with a hint. Then the whole answer
     shows, and the page offers Again and Good with the one this suggests
     (recall.ts) first. Knowing the word is what the card is about; its ending
     is practised along the way and does not cost the card.
     The buttons under the card are the page's: they submit this card's form
     (id "recall-answer"), and the one marked data-give-up gives the step up. -->
<script lang="ts">
	import Grammar from '#lib/Grammar.svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import { messagesFor, tagLabel } from '#lib/i18n.ts';
	import { around, asksForm, checkTyped, type Recall, type Recalled } from '#lib/review/recall.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordCard } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		info,
		recall,
		glosses,
		step = $bindable(),
		ondone,
		onplay
	}: {
		info: WordCard;
		recall: Recall;
		/** The card's meanings, each once. */
		glosses: string[];
		/** Which step is asked, for the page's buttons; 'done' once answered. */
		step: 'word' | 'form' | 'done';
		ondone: (recalled: Recalled) => void;
		onplay: (url: string) => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let gap = $derived(recall.gap && info.example ? recall.gap : null);
	let parts = $derived(gap && info.example ? around(info.example.uk, gap) : null);

	let typed = $state('');
	/** A first try at this step was near (the word) or the right word in another form (the sentence). */
	let nudged = $state(false);
	/** What was typed and not taken, shown struck through with the answer. */
	let missedWord = $state('');
	let missedForm = $state('');
	let knewWord = $state(false);
	let form = $state<Recalled['form']>(null);

	// Focus must not scroll: on a phone the page would jump to the field
	const focus = (node: HTMLElement) => node.focus({ preventScroll: true });

	function finish() {
		step = 'done';
		ondone({ word: knewWord, form });
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (step === 'done') return;
		const givingUp = event.submitter instanceof HTMLElement && 'giveUp' in event.submitter.dataset;
		if (step === 'word') {
			if (givingUp) return finish();
			if (!typed.trim()) return;
			const found = checkTyped(info.word, [], recall.forms, typed);
			if (found === 'close' && !nudged) {
				nudged = true;
				return;
			}
			if (found === 'right' || found === 'form') {
				knewWord = true;
				typed = '';
				nudged = false;
				// The sentence asks for something only where its form is not the word itself
				if (gap && asksForm(info.word, gap)) step = 'form';
				else finish();
				return;
			}
			missedWord = typed.trim();
			return finish();
		}
		// The form in the sentence
		if (!gap) return finish();
		if (givingUp) {
			form = 'missed';
			return finish();
		}
		if (!typed.trim()) return;
		const found = checkTyped(gap.plain, gap.also, recall.forms, typed);
		if (found === 'right') form = nudged ? 'helped' : 'right';
		else if ((found === 'form' || found === 'close') && !nudged) {
			nudged = true;
			return;
		} else {
			form = 'missed';
			missedForm = typed.trim();
		}
		finish();
	}

	/** A spelling that is one stressed form shows its stress; one that is two (води́, во́ди) shows none. */
	let filled = $derived(gap && gap.readings.length === 1 ? gap.readings[0].form : parts?.word ?? '');

	/** "genitive singular", or «родовий однина» */
	const named = (tags: string[]) => tags.map((tag) => tagLabel(m, settings.lang, tag)).join(' ');

	/** The hint for a second try at the form: the form's name where the spelling is one. */
	let hint = $derived.by(() => {
		if (!gap) return '';
		const all = gap.readings.flatMap((reading) => reading.tags).filter((tags) => tags.length);
		return all.length === 1 ? m.review.recall.formIs(named(all[0])) : m.review.recall.formLook;
	});
</script>

<form id="recall-answer" class="recall" onsubmit={submit}>
	<!-- Enter in a field presses a form's first button: this one, which checks,
	     and not the page's "I don't know", which comes first under the card -->
	<button type="submit" class="ui-sr-only" tabindex="-1" aria-hidden="true">{m.review.recall.check}</button>
	{#if step === 'word'}
		<div class="ask">
			<p class="label">{m.review.recall.inUkrainian}</p>
			<p class="meaning" lang="en">{glosses.join('; ')}</p>
			<p class="grammar"><Grammar pos={info.pos} tags={info.tags} inline /></p>
			<input
				bind:value={typed}
				class="ui-field word-field"
				type="text"
				lang="uk"
				aria-label={m.review.recall.typeWord}
				placeholder={m.review.recall.typeWord}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
				maxlength="60"
				{@attach focus}
			/>
			<p class="note" role="status">{nudged ? m.review.recall.close : m.review.recall.latin}</p>
		</div>
	{:else}
		<p class="word">
			<span class="mark" data-knew={knewWord}><Icon name={knewWord ? 'check' : 'x'} size={20} /></span>
			<Headword text={info.headword} size="md" />
			{#if step === 'done' && info.audio_url}
				{@const url = info.audio_url}
				<button type="button" class="ui-icon-btn" aria-label={m.word.playRecording} onclick={() => onplay(url)}>
					<Icon name="speaker" />
				</button>
			{/if}
		</p>
		{#if missedWord}<p class="given">{m.review.recall.youTyped} <s lang="uk">{missedWord}</s></p>{/if}

		<div class="rest">
			{#if step === 'done'}
				<p class="grammar">
					<Grammar pos={info.pos} tags={info.tags} inline />
					{#if info.ipa}<span class="ipa">{info.ipa}</span>{/if}
				</p>
				<p class="meaning small" lang="en">{glosses.join('; ')}</p>
			{/if}

			{#if info.example}
				<div class="example">
					<span class="english" lang="en">{info.example.en}</span>
					{#if parts && gap}
						<p class="sentence" lang="uk">
							{parts.before}{#if step === 'form'}<input
									bind:value={typed}
									class="blank"
									style:--letters={Math.max(gap.length, [...typed].length + 1)}
									type="text"
									aria-label={m.review.recall.typeForm}
									autocomplete="off"
									autocapitalize="off"
									autocorrect="off"
									spellcheck="false"
									maxlength="60"
									{@attach focus}
								/>{:else}<b class="filled" data-outcome={form ?? (knewWord ? 'right' : 'missed')}><Stressed text={filled} /></b>{/if}{parts.after}
						</p>
					{:else}
						<p class="sentence" lang="uk">{info.example.uk}</p>
					{/if}
				</div>
			{/if}

			{#if step === 'form'}
				<p class="note" role="status">{nudged ? hint : m.review.recall.formAsk}</p>
			{:else if gap && asksForm(info.word, gap)}
				{#if missedForm}<p class="given">{m.review.recall.youTyped} <s lang="uk">{missedForm}</s></p>{/if}
				<!-- води́ genitive singular · во́ди nominative plural, accusative plural -->
				<p class="readings">
					{#each gap.readings as reading, i (reading.form)}
						{#if i}<span aria-hidden="true">{' · '}</span>{/if}
						<span class="reading"><b lang="uk"><Stressed text={reading.form} /></b>
							{reading.tags.map(named).join(', ')}</span>
					{/each}
				</p>
			{/if}

			{#if step === 'done'}<a class="more" href={wordPath(info.word)}>{m.review.openWord}</a>{/if}
		</div>
	{/if}
</form>

<style>
	p {
		margin: 0;
	}

	.recall {
		display: grid;
		gap: 1rem;
		justify-items: center;
		text-align: center;
	}

	.ask {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		width: 100%;
	}

	.label,
	.note {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.meaning {
		font-size: var(--headword-md);
		font-weight: 600;
		line-height: 1.25;
		text-wrap: balance;
	}

	.meaning.small {
		font-size: var(--text-lg);
		font-weight: 400;
	}

	.grammar {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 0.75rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.ipa {
		font-family: var(--font-ipa);
	}

	/* The word to type: as wide as a long word, in the headwords' letters */
	.word-field {
		width: min(100%, 22rem);
		margin-top: 0.4rem;
		font-family: var(--font-headword);
		font-size: var(--text-xl);
		text-align: center;
	}

	.word-field::placeholder {
		font-family: var(--font-text);
		font-size: var(--text-lg);
		font-weight: 400;
	}

	.word {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.25rem 0.5rem;
	}

	.mark {
		display: inline-flex;
		color: var(--right);
	}

	.mark[data-knew='false'] {
		color: var(--stress);
	}

	.given {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.given s {
		color: var(--stress);
		font-family: var(--font-headword);
	}

	/* Under the word, ruled off as the turned card's answer is */
	.rest {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		width: 100%;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
	}

	.example {
		display: grid;
		gap: 0.35rem;
	}

	.english {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.sentence {
		font-family: var(--font-headword);
		font-size: var(--text-xl);
		font-weight: 600;
		line-height: 1.5;
		overflow-wrap: anywhere;
		text-wrap: balance;
	}

	/* The gap is the field, in the sentence's own letters, as on /practice
	   (PracticeGap.svelte): a soft flag fill over a rule to write on */
	.blank {
		display: inline-block;
		width: calc(clamp(4, var(--letters), 12) * 0.62em);
		max-width: 100%;
		margin-inline: 0.1em;
		padding: 0;
		border: 0;
		border-bottom: 2px solid var(--flag-line);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: var(--flag-soft);
		color: var(--ink);
		font: inherit;
		line-height: 1.2;
		text-align: center;
		caret-color: var(--ink);
	}

	.blank:focus-visible {
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

	.readings {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.reading b {
		color: var(--ink);
	}

	.more {
		font-size: var(--text-sm);
	}
</style>
