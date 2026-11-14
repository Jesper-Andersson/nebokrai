<!-- One search result. The headword and the arrow both lead to the word's
     page; the meanings stay plain text so they can be selected and copied.
     How common the word is stands at the right end of the grammar line, as
     it does on the word's own page. A result found through an inflected form
     says which form along its lower edge:

       Form found: руки́ genitive singular · ру́ки nominative, accusative, vocative plural

     An old word (every meaning that matched is dated, archaic or obsolete)
     says so in a badge beside the headword, and its headword and meanings
     are set in the muted grey: свейський under шведський for "swedish". -->
<script lang="ts">
	import { groupMatched } from '#lib/forms.ts';
	import { messagesFor, tagLabel } from '#lib/i18n.ts';
	import type { SearchResult } from '#lib/search/search.ts';
	import type { Suggestion } from '#lib/search/suggest.ts';
	import { useSettings } from '#lib/settings.ts';
	import { mergeProps } from 'bits-ui';
	import AddWord from './AddWord.svelte';
	import { canAddWord } from '#lib/suggest.ts';
	import FrequencyMeter from './FrequencyMeter.svelte';
	import Grammar from './Grammar.svelte';
	import Headword from './Headword.svelte';
	import Icon from './Icon.svelte';
	import { wordPath } from '#lib/search/slug.ts';
	import { speak } from '#lib/speak.ts';
	import SaveButton from './SaveButton.svelte';
	import Stressed from './Stressed.svelte';
	import Tip from './Tip.svelte';
	import Translation from './Translation.svelte';

	// What a card needs of an entry: a search result, a guess, or the word of
	// the day all have it
	type CardEntry = Pick<SearchResult, 'word' | 'headword' | 'pos' | 'tags' | 'head_forms' | 'glosses' | 'freq_rank'> &
		Partial<Pick<SearchResult, 'vesum_only' | 'matched_forms'>>;

	let {
		entry,
		framed = true,
		hideMeanings = false,
		pron
	}: {
		entry: SearchResult | Suggestion | CardEntry;
		/** Off when the card sits inside a frame of its own (WordOfDay.svelte) */
		framed?: boolean;
		/** Blur each meaning until pressed, with "Hide translations" on: a word
		    the learner did not ask for can be guessed before it is read */
		hideMeanings?: boolean;
		/** The word in Latin letters and the phonetic alphabet, shown as the
		    settings ask (the word of the day); a search result leaves them to the word's page */
		pron?: { roman: string | null; ipa: string | null };
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	// Two meanings in full, each on a line of its own, and how many more the
	// word's page has: a third cut short told less than the first two whole
	// (user, 2026-11-14)
	const SHOWN = 2;
	let shown = $derived(entry.glosses.slice(0, SHOWN));
	let more = $derived(entry.glosses.length - shown.length);
	// A VESUM-only word has no entry, so nothing to save or open.
	let vesumOnly = $derived('vesum_only' in entry && entry.vesum_only === true);
	// Present when the query was an inflected form of this word. Empty when
	// only VESUM knew that: it tells the word, not which of its forms.
	let matched = $derived('matched_forms' in entry && entry.matched_forms ? groupMatched(entry.matched_forms) : null);

	// The word that was searched for, when it led here without being one of
	// this word's forms: a reflexive verb, a word on this word's head line, or
	// a Russian word or surzhyk this word is the Ukrainian for (криша, on дах).
	let through = $derived('through' in entry ? entry.through : undefined);
	// For a non-standard word, the other Ukrainian words to say instead: осуд
	// and суд beside вирок, for приговор
	let also = $derived(
		'use' in entry && entry.use ? entry.use.filter((u) => u.word.replace(/\u0301/g, '') !== entry.word) : []
	);
	// A Russian word or surzhyk with no Ukrainian word to offer: the stub, its word greyed
	let distorted = $derived(vesumOnly && 'kind' in entry && entry.kind === 'distorted');

	let roman = $derived(settings.roman === 'on' ? pron?.roman : null);
	let ipa = $derived(settings.ipa === 'on' ? pron?.ipa : null);

	// dated, archaic or obsolete; only a search result says
	let old = $derived('old' in entry ? entry.old : undefined);

	const say = () => speak(entry.word);
</script>

{#snippet led(t: NonNullable<typeof through>)}
	{#if t.kind === 'nonstandard'}
		<!-- ~~криша~~ is not standard Ukrainian. Also: осуд, суд (option C, user's pick, 2026-11-17) -->
		<span class="form"><s lang="uk"><b>{t.word}</b></s> {m.card.through.nonstandard}</span>
		{#if also.length}
			<span class="form">
				{m.card.alsoUse}
				{#each also as u, i (u.word)}{#if i}{', '}{/if}{#if u.has_entry}<a class="also" lang="uk" href={wordPath(u.word.replace(/\u0301/g, ''))}><Stressed text={u.word} /></a>{:else}<span lang="uk"><Stressed text={u.word} /></span>{/if}{/each}
			</span>
		{/if}
	{:else}
		<span class="form"><b lang="uk"><Stressed text={t.word} /></b> {m.card.through[t.kind]}</span>
	{/if}
{/snippet}

<article class:ui-card={framed} class:plain={vesumOnly} class:old class:distorted>
	<div class="word">
		<Headword text={entry.headword} href={vesumOnly ? undefined : wordPath(entry.word)} />
		<Tip label={m.card.play}>
			{#snippet trigger(props)}
				<button
					{...mergeProps(props, { onclick: say })}
					type="button"
					class="ui-icon-btn play"
					aria-label={m.card.play}
				>
					<Icon name="speaker" size={20} />
				</button>
			{/snippet}
		</Tip>
		{#if old}<span class="ui-badge">{tagLabel(m, settings.lang, old)}</span>{/if}
	</div>

	<div class="meta">
		{#if roman || ipa}
			<p class="pron">
				{#if roman}<span>{roman}</span>{/if}
				{#if ipa}<span class="ipa">{ipa}</span>{/if}
			</p>
		{/if}
		<Grammar pos={entry.pos} tags={entry.tags} headForms={entry.head_forms} brief />
	</div>

	<div class="glosses">
		{#if vesumOnly}
			<i>{'kind' in entry && entry.kind ? m.card.kind[entry.kind] : m.card.noEntry}</i>
			<!-- A real word with no entry: a reader may know what it means. Not for
			     one VESUM calls distorted (таможня), which should not get an entry. -->
			{#if !('kind' in entry && entry.kind === 'distorted') && canAddWord(entry.word)}
				<div class="add"><AddWord word={entry.word} label={m.addWord.addMeaning} /></div>
			{/if}
		{:else}
			<!-- The numerals are drawn, not text: copied, the meanings read one
			     to a line -->
			<ol class="ui-senses">
				{#each shown as gloss, i (i)}
					<li>{#if hideMeanings}<Translation text={gloss} muted={false} />{:else}{gloss}{/if}</li>
				{/each}
			</ol>
			{#if more > 0}
				<a class="more" href={wordPath(entry.word)}>{m.card.moreMeanings(more)}</a>
			{/if}
		{/if}
	</div>

	{#if !vesumOnly}
		<div class="freq"><FrequencyMeter rank={entry.freq_rank} /></div>

		<div class="actions">
			<SaveButton word={entry.word} headword={entry.headword} size={20} />
			<a class="ui-icon-btn" href={wordPath(entry.word)} aria-label={m.card.details} title={m.card.details}>
				<Icon name="chevron-right" size={20} />
			</a>
		</div>
	{/if}

	{#if matched}
		<p class="found" class:wrap={!matched.groups.length && through}>
			{#if matched.groups.length}
				{m.card.formFound}
				{#each matched.groups as group, i (group.form)}
					{#if i}<span class="dot" aria-hidden="true">·</span>{/if}
					<span class="form"><b lang="uk"><Stressed text={group.form} /></b> {group.labels.join('; ')}</span>
				{/each}
				{#if matched.more}<span class="form">{m.card.moreForms(matched.more)}</span>{/if}
			{:else if through}
				{@render led(through)}
			{:else}
				{m.card.someForm}
			{/if}
		</p>
	{:else if through}
		<!-- Found by a word this word's head line names: історично, its adverb -->
		<p class="found wrap">
			{@render led(through)}
		</p>
	{/if}
</article>

<style>
	article {
		display: grid;
		/* 18rem: кавалерійський with its play button fits on one line */
		grid-template-columns: minmax(0, 18rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'word glosses actions'
			'meta glosses freq'
			'found found found';
		align-items: center;
		gap: 0 1rem;
		padding: 0.45rem 0.4rem 0.5rem 1rem;
		transition: border-color var(--duration);
	}

	@media (hover: hover) {
		article:not(.plain):hover {
			border-color: var(--border-strong);
		}
	}

	/* Half see-through: lighter than a real entry, and still readable over a photo */
	.plain {
		border-style: dashed;
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		box-shadow: none;
	}

	.word {
		grid-area: word;
		display: flex;
		align-items: center;
		gap: 0.15rem;
		min-width: 0;
	}

	.play {
		color: var(--play);
	}

	/* An old word stands back: its headword, stress included, and its meanings
	   in the muted grey, closer to the page (user's pick, 2026-11-16) */
	.old .word :global(.headword),
	.old .word :global(.headword *),
	.old .glosses {
		color: var(--muted);
	}

	/* On a phone the badge goes under the headword rather than squeeze it:
	   "вийшло з ужитку" beside свейський broke the word over three lines */
	.old .word {
		flex-wrap: wrap;
	}

	.word .ui-badge {
		margin-left: 0.35rem;
	}

	.meta {
		grid-area: meta;
		min-width: 0;
	}

	/* As on the word's page, under the headword: vodá  [wɔˈda] */
	.pron {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.75rem;
		margin: 0 0 0.1rem;
		color: var(--ink-2);
	}

	.ipa {
		color: var(--muted);
		font-family: var(--font-ipa);
	}

	.add {
		margin-top: 0.6rem;
	}

	.glosses {
		grid-area: glosses;
		padding-left: 1.25rem;
		border-left: 1px solid var(--border);
		color: var(--ink-2);
		font-size: var(--text-lg);
		line-height: 1.4;
	}

	/* "1." hanging in the margin, so the meanings' words line up. A word with
	   one meaning has no number. */
	/* The word page spaces its meanings apart; two short ones here read as
	   one block */
	.glosses :global(.ui-senses) {
		gap: 0.1rem;
	}

	.glosses :global(.ui-senses > li) {
		padding-left: 1.3em;
	}

	.glosses :global(.ui-senses > li::before) {
		content: counter(sense) '.';
	}

	.glosses :global(.ui-senses > li:only-child) {
		padding-left: 0;
	}

	.glosses :global(.ui-senses > li:only-child::before) {
		content: none;
	}

	/* Quiet, as the related-word links are: it is there for who wants it */
	.more {
		display: inline-block;
		padding-left: 1.3em;
		color: var(--muted);
		font-size: var(--text-sm);
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}

	/* Under the buttons, on the line of the grammar, and pushed to the same
	   right edge as the arrow above it. As wide as the longest rank (#16,580):
	   every card's last column is then the same width, and the ranks of a list
	   of results line up like a column of figures. */
	.freq {
		grid-area: freq;
		display: flex;
		justify-content: flex-end;
		box-sizing: border-box;
		min-width: 5.2rem;
		padding-right: 0.6rem;
	}

	.actions {
		grid-area: actions;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	/* Which form of the word the search found: a remark along the card's lower
	   edge, set off by a dashed rule so it is not read as one of the meanings */
	.found {
		grid-area: found;
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.45rem;
		margin: 0.3rem 0.5rem 0 0;
		padding-top: 0.3rem;
		border-top: 1px dashed var(--border);
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.found b {
		color: var(--ink-2);
		font-size: 1rem;
	}

	/* The other Ukrainian words, quiet as the related-word links are */
	.also {
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}

	/* A Russian word or surzhyk with nothing to offer: its word stands back */
	.distorted .word :global(.headword),
	.distorted .word :global(.headword *) {
		color: var(--muted);
	}

	/* Phones: the word, how common it is and the buttons share one line, the
	   grammar has the line under it, and the meanings go under that across
	   the full width. The grammar stood beside the word until 2026-11-14 and
	   was cut short there: with a phone's text set larger, трáвма left room
	   for "noun · fe" only. On a line of its own it wraps if it must. The rank
	   (#233) is left to the word's page; the bars say enough here. The form
	   found keeps to one line. */
	@media (max-width: 600px) {
		article {
			grid-template-columns: minmax(0, 1fr) auto auto;
			grid-template-areas:
				'word freq actions'
				'meta meta meta'
				'glosses glosses glosses'
				'found found found';
			gap: 0 0.5rem;
			padding: 0.4rem 0.3rem 0.55rem 0.8rem;
		}

		.meta {
			margin-bottom: 0.2rem;
			font-size: var(--text-xs);
			line-height: 1.3;
		}

		.freq {
			min-width: 0;
			padding-right: 0;
		}

		.freq :global(.freq > span:not(.tier)) {
			display: none;
		}

		.glosses {
			padding: 0 0.5rem 0 0;
			border-left: 0;
			font-size: 1rem;
			line-height: 1.35;
		}

		.found {
			display: block;
			margin-top: 0.15rem;
			padding-top: 0;
			overflow: hidden;
			border-top: 0;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		/* A sentence saying how the word was reached (походити — подано як
		   доконаний вид…) means nothing cut short, so it may wrap */
		.found.wrap {
			white-space: normal;
		}
	}
</style>
