<!-- A word's page: for each entry of the spelling, how common it is, the
     headword with its actions, how it is said, and its grammar in one italic
     line; then two columns. The left has what a reader comes for: the first
     meanings (the rest behind a closed row), example sentences and the words
     related to it. The right has the form tables behind tabs
     (FormTables.svelte) and the etymology, closed. On a phone the two stack.
     A spelling with several entries gets a list of them first. -->
<script lang="ts">
	import { mergeProps } from 'bits-ui';
	import FormTables from '#lib/FormTables.svelte';
	import FrequencyMeter from '#lib/FrequencyMeter.svelte';
	import Grammar from '#lib/Grammar.svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import RelatedWords from '#lib/RelatedWords.svelte';
	import SaveButton from '#lib/SaveButton.svelte';
	import Sentence from '#lib/Sentence.svelte';
	import ShareButton from '#lib/ShareButton.svelte';
	import Stressed from '#lib/Stressed.svelte';
	import Term from '#lib/Term.svelte';
	import Tip from '#lib/Tip.svelte';
	import Translation from '#lib/Translation.svelte';
	import { commonsPage } from '#lib/commons.ts';
	import { formTables } from '#lib/forms.ts';
	import {
		RELATED_HEAD_FORMS, RELATED_ROW_TERMS, headFormLabel, headFormPlace, otherFormLabel, termOf, type TermId
	} from '#lib/grammar.ts';
	import { formName, messagesFor, posLabel, tagLabel } from '#lib/i18n.ts';
	import { useRadio } from '#lib/radio.svelte.ts';
	import { plain } from '#lib/search/normalize.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { Relation, Sense, WordEntry } from '#lib/search/word.ts';
	import { wordDescription, wordTitle } from '#lib/seo.ts';
	import { useSettings } from '#lib/settings.ts';
	import { differOnlyByStress, stressMoved, stressShift } from '#lib/stress.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	const radio = useRadio();
	let m = $derived(messagesFor(settings.lang));
	const wiktionary = (word: string) =>
		`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Ukrainian`;

	// The radio (RadioPlayer.svelte) may be playing: it is turned down for as
	// long as the word sounds, so the word can be heard over it.
	function play(entry: WordEntry) {
		const done = radio.duck();
		if (entry.audio_url) {
			const audio = new Audio(entry.audio_url);
			audio.addEventListener('ended', done);
			audio.addEventListener('error', done);
			audio.play().catch(done);
		} else {
			const utterance = new SpeechSynthesisUtterance(entry.word);
			utterance.lang = 'uk-UA';
			utterance.onend = utterance.onerror = done;
			speechSynthesis.speak(utterance);
		}
	}

	// The synonyms or antonyms of one meaning of an entry, or (n null) of the
	// entry as a whole.
	const named = (entry: WordEntry, kind: 'synonym' | 'antonym', n: number | null) =>
		entry.relations.filter((x) => x.kind === kind && x.sense_n === n);

	// The spellings an example sentence can have this entry's word in: the word
	// and its forms of one word (буду читати is two, and буду is not читати).
	const ownForms = (entry: WordEntry) =>
		new Set([entry.word, ...entry.forms.map((f) => f.form).filter((form) => !form.includes(' '))].map(plain));

	// The meanings shown before the closed row of the rest. Three fill the first
	// screen beside the tables and are usually enough; брати has 25.
	const FIRST_MEANINGS = 3;

	// A meaning with a usage note after a semicolon ("to take, to grab; but
	// while брати is generic, дістати means…") is the meaning and, smaller, the
	// note. A short second half ("water; liquid") is part of the meaning.
	function splitGloss(gloss: string): [string, string | null] {
		const at = gloss.indexOf('; ');
		if (at < 0 || gloss.length - at < 60) return [gloss, null];
		const note = gloss.slice(at + 2).trim();
		return [gloss.slice(0, at), note.charAt(0).toUpperCase() + note.slice(1)];
	}

	// The etymology's opening words, beside its closed row: "From Old East Slavic бьрати"
	function etymologyHint(text: string): string {
		const first = text.split(/[,.;(\n]/)[0].trim();
		return first.length > 48 ? `${first.slice(0, 46).trimEnd()}…` : first;
	}

	// The forms beside the headword that are words of their own (водяни́й,
	// води́ця), as rows of Related words, in the order of RELATED_HEAD_FORMS
	function relatedRows(
		entry: WordEntry,
		hasTables: boolean
	): { label: string; term?: TermId; words: Relation[] }[] {
		const related = entry.head_forms.filter((f) => headFormPlace(f.tags, hasTables) === 'related');
		return RELATED_HEAD_FORMS.map((key) => ({
			label: m.word.relatedRows[key] ?? key,
			term: RELATED_ROW_TERMS[key],
			words: related
				.filter((f) => headFormLabel(f.tags).key === key)
				.map((f): Relation => ({ kind: 'derived', sense_n: null, word: f.form, tags: [], has_entry: f.has_entry }))
		})).filter((row) => row.words.length);
	}

	// The second column: the tables and the etymology. A page without either
	// keeps the narrower width of one column of text.
	const hasSide = (entry: WordEntry) => entry.forms.length > 0 || Boolean(entry.etymology);
	let wide = $derived(data.entries.some(hasSide));

	// The list of entries names each headword only when they are not all the
	// same (за́мок and замо́к, or а, А and -а behind one address).
	let varied = $derived(new Set(data.entries.map((e) => e.headword)).size > 1);
	let stressedApart = $derived(
		data.entries.some((a, i) => data.entries.slice(i + 1).some((b) => differOnlyByStress(a.headword, b.headword)))
	);
</script>

<!-- A spelling with several entries is described by its most common one -->
<PageMeta title={wordTitle(m, data.entries[0])} description={wordDescription(m, data.entries[0])} />

<div class="ui-page" class:wide>
	<p class="back">
		<a href="/"><Icon name="arrow-left" size={16} />{m.word.back}</a>
	</p>

	<!-- стан is a noun five times over: say so before the first entry -->
	{#if data.entries.length > 1}
		{#if stressedApart}<p class="apart">{m.word.sameSpelling}</p>{/if}
		<nav class="entries" aria-label={m.word.entries}>
			{#each data.entries as entry, i (entry.id)}
				<a href="#entry-{entry.id}">
					<span class="n">{i + 1}</span>
					{#if varied}<b lang="uk"><Stressed text={entry.headword} /></b>{/if}
					<b>{posLabel(m, entry.pos)}</b>
					<span class="gloss">{entry.senses[0]?.gloss ?? ''}</span>
				</a>
			{/each}
		</nav>
	{/if}

	{#each data.entries as entry (entry.id)}
		{@const { tables, other } = formTables(entry.pos, entry.forms, entry.word)}
		{@const playLabel = entry.audio_url ? m.word.playRecording : m.word.playVoice}
		<!-- What each form's stress is compared with. Not for pronouns: мене́ is
		     another word than я, not я with its stress moved. -->
		{@const base = entry.pos === 'pron' ? '' : entry.headword}
		{@const shift = stressShift(base, entry.forms.map((f) => f.form))}
		{@const own = ownForms(entry)}
		<!-- The grammar line keeps the forms a learner needs beside the headword
		     (the aspect partner взя́ти); the case forms are in the table and the
		     words made from it are with the related words -->
		{@const lineForms = entry.head_forms.filter((f) => headFormPlace(f.tags, tables.length > 0) === 'line')}
		{@const fromHead = relatedRows(entry, tables.length > 0)}
		<!-- Derived words and words of the same root are shown for the entry as a
		     whole, whichever meaning Wiktionary lists them under -->
		{@const derived = entry.relations.filter((x) => x.kind === 'derived')}
		{@const sameRoot = entry.relations.filter((x) => x.kind === 'related')}
		{@const first = entry.senses.slice(0, FIRST_MEANINGS)}
		{@const rest = entry.senses.slice(FIRST_MEANINGS)}
		{@const pronounced = (settings.roman === 'on' && entry.roman) || (settings.ipa === 'on' && entry.ipa)}
		<article id="entry-{entry.id}" class="ui-card">
			<header>
				<!-- How common the word is, first: it says how much the rest is worth learning now -->
				<div class="rank">
					<FrequencyMeter rank={entry.freq_rank} showTier />
				</div>
				<div class="title">
					<Headword text={entry.headword} size="lg" tag="h1" />
					<div class="actions">
						<Tip label={playLabel}>
							{#snippet trigger(props)}
								<button
									{...mergeProps(props, { onclick: () => play(entry) })}
									type="button"
									class="ui-icon-btn play"
									aria-label={m.card.play}
								>
									<Icon name="speaker" size={22} />
								</button>
							{/snippet}
						</Tip>
						<SaveButton word={entry.word} headword={entry.headword} size={21} />
						<!-- стан has five entries on one page: a shared link opens at this one -->
						<ShareButton
							path={wordPath(entry.word) + (data.entries.length > 1 ? `#entry-${entry.id}` : '')}
							headword={entry.headword}
							size={21}
						/>
					</div>
				</div>
				<!-- Latin letters and the phonetic alphabet, each as the settings ask -->
				{#if pronounced}
					<p class="pron">
						{#if settings.roman === 'on' && entry.roman}<span class="roman">{entry.roman}</span>{/if}
						{#if settings.ipa === 'on' && entry.ipa}<span class="ipa">{entry.ipa}</span>{/if}
					</p>
				{/if}
				<div class="grammar">
					<Grammar pos={entry.pos} tags={entry.tags} headForms={lineForms} />
				</div>
			</header>

			<div class="columns" class:single={!hasSide(entry)}>
				<div class="main">
					<section>
						<h2 class="ui-label">{m.word.meanings}</h2>
						{#snippet senseItem(sense: Sense, big: boolean)}
							{@const [gloss, note] = big ? splitGloss(sense.gloss) : [sense.gloss, null]}
							<li>
								<p class:big>
									<!-- A remark that is a grammar word can be pressed for its note -->
									{#if sense.tags.length}
										<i class="tag">({#each sense.tags as tag, i (i)}{@const term = termOf(tag)}{#if i}{', '}{/if}{#if term}<Term id={term} />{:else}{tagLabel(m, settings.lang, tag)}{/if}{/each})</i>
									{/if}
									{gloss}
								</p>
								{#if note}<p class="note">{note}</p>{/if}
								{#if sense.examples.length}
									<ul class="quotes">
										{#each sense.examples as ex, i (i)}
											<li>
												<Sentence text={ex.text} {own} />
												{#if ex.english}<Translation text={ex.english} />{/if}
											</li>
										{/each}
									</ul>
								{/if}
								<RelatedWords label={m.word.synonyms} words={named(entry, 'synonym', sense.n)} />
								<RelatedWords label={m.word.antonyms} words={named(entry, 'antonym', sense.n)} />
							</li>
						{/snippet}
						<ol class="ui-senses senses">
							{#each first as sense (sense.n)}{@render senseItem(sense, true)}{/each}
						</ol>
						<!-- брати has 25 meanings: the rest wait behind a row, numbered on from the first -->
						{#if rest.length}
							<details class="more">
								<summary>
									{m.word.moreMeanings(rest.length)}
									<span class="chevron"><Icon name="chevron-right" size={16} /></span>
								</summary>
								<ol class="ui-senses senses" style="counter-reset: sense {FIRST_MEANINGS}">
									{#each rest as sense (sense.n)}{@render senseItem(sense, false)}{/each}
								</ol>
							</details>
						{/if}
						<!-- Those Wiktionary gives for the word, not for one of its meanings -->
						{#if named(entry, 'synonym', null).length || named(entry, 'antonym', null).length}
							<div class="whole">
								<RelatedWords label={m.word.synonyms} words={named(entry, 'synonym', null)} />
								<RelatedWords label={m.word.antonyms} words={named(entry, 'antonym', null)} />
							</div>
						{/if}
					</section>

					{#if entry.examples.length}
						<section>
							<h2 class="ui-label">{m.word.examples}</h2>
							<ul class="sentences">
								{#each entry.examples as ex (ex.tatoeba_id)}
									<li>
										<Sentence text={ex.uk} {own} />
										<Translation text={ex.en} />
										<a class="credit" href="https://tatoeba.org/sentences/show/{ex.tatoeba_id}">
											Tatoeba #{ex.tatoeba_id}
										</a>
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					<!-- Adjectives and diminutives first, then the longer lists -->
					{#if fromHead.length || derived.length || sameRoot.length}
						<section>
							<h2 class="ui-label">{m.word.family}</h2>
							{#each fromHead as row (row.label)}
								<RelatedWords label={row.label} term={row.term} words={row.words} />
							{/each}
							<RelatedWords label={m.word.derived} term="derived" words={derived} limit={24} />
							<RelatedWords label={m.word.sameRoot} term="same-root" words={sameRoot} limit={24} />
						</section>
					{/if}
				</div>

				{#if hasSide(entry)}
					<aside class="side">
						{#if tables.length || other.length}
							<section>
								<h2 class="ui-label">{entry.pos === 'verb' ? m.word.conjugation : m.word.forms}</h2>
								{#if tables.length}<FormTables {tables} headword={base} />{/if}
								{#if other.length}
									<dl class="other">
										{#each other as group, i (i)}
											{@const label = otherFormLabel(group.tags)}
											{@const text = formName(m, settings.lang, label.key && m.grammar.otherForms[label.key], label.extra)}
											<div>
												<dt>{#if label.term}<Term id={label.term}>{text}</Term>{:else}{text}{/if}</dt>
												<dd lang="uk">
													<!-- {', '}: Svelte drops a space at the end of a block, and the forms ran together -->
													{#each group.forms as form, i}{#if i}{', '}{/if}<Stressed text={form} moved={stressMoved(base, form)} />{/each}
												</dd>
											</div>
										{/each}
									</dl>
								{/if}
								{#if shift === 'moves'}
									<p class="shift">{m.word.stressMoves} <b lang="uk"><Stressed text={entry.headword} /></b>.</p>
								{:else if shift === 'stays'}
									<p class="shift">{m.word.stressStays}</p>
								{/if}
								<p class="guide">
									<a href="/grammar#{entry.pos === 'verb' ? 'verbs' : 'cases'}">{m.grammar.explained}</a>
								</p>
							</section>
						{/if}

						<!-- Closed, with its opening words beside the name -->
						{#if entry.etymology}
							<details class="etymology">
								<summary>
									<h2 class="ui-label">{m.word.etymology}</h2>
									<span class="hint">{etymologyHint(entry.etymology)}</span>
									<span class="chevron"><Icon name="chevron-right" size={16} /></span>
								</summary>
								<p>{entry.etymology}</p>
							</details>
						{/if}
					</aside>
				{/if}
			</div>

			<footer>
				<span>
					{m.word.from} <a href={wiktionary(entry.word)}>{m.word.wiktionary}</a>
					(<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>)
					{#if entry.audio_url}
						· <a href={commonsPage(entry.audio_url)}>{m.word.recording}</a>
					{/if}
				</span>
				<a href="/report?entry={entry.id}">{m.word.report}</a>
			</footer>
		</article>
	{/each}
</div>

<style>
	p {
		margin: 0;
	}

	/* Two columns need more than the width of one column of text */
	.ui-page.wide {
		--page: var(--page-wide);
	}

	.back {
		margin: 0.5rem 0;
	}

	/* The padding makes the link a 40px tap target */
	.back a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 0.75rem 0.6rem 0;
		color: var(--on-page);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.back a:hover {
		color: var(--ink);
	}

	/* Stands on the page, above the list of entries */
	.apart {
		margin-bottom: 0.5rem;
		color: var(--on-page);
		font-size: var(--text-sm);
	}

	/* The entries of this spelling, as links that wrap onto more lines */
	.entries {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	.entries a {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		max-width: 16rem;
		padding: 0.4rem 0.75rem 0.4rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--panel);
		font-size: var(--text-sm);
	}

	.entries a:hover {
		border-color: var(--border-strong);
	}

	.entries .n {
		font-weight: 700;
	}

	.entries .gloss {
		overflow: hidden;
		color: var(--muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	article {
		margin-bottom: 1.25rem;
		padding: 1.5rem 1.75rem 1.1rem;
		line-height: 1.5;
		/* A link from the list of entries stops below the sticky header */
		scroll-margin-top: 4.5rem;
	}

	article a,
	.entries a:focus-visible {
		text-underline-offset: 3px;
	}

	section a,
	footer a {
		color: var(--accent);
		text-decoration: underline;
	}

	.rank {
		margin-bottom: 0.35rem;
		font-size: var(--text-sm);
	}

	/* The word and its buttons on one line. A long word on a phone has the
	   line to itself and the buttons go under it: beside them it was left a
	   third of the line and broke in three (кавале / рійськи / й). The
	   headword takes its size from this box's width (Headword.svelte). */
	.title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.5rem;
		container-type: inline-size;
	}

	.grammar {
		margin-top: 0.6rem;
	}

	.actions {
		display: flex;
		flex: none;
		gap: 0.1rem;
	}

	.play {
		color: var(--play);
	}

	.pron {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
		margin-top: 0.15rem;
		color: var(--ink-2);
		font-size: var(--text-lg);
	}

	.ipa {
		color: var(--muted);
		font-family: var(--font-ipa);
	}

	/* What the reader comes for on the left; the tables and the etymology on the right */
	.columns {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 4fr);
		align-items: start;
		gap: 0 2rem;
	}

	.columns.single {
		grid-template-columns: minmax(0, 1fr);
	}

	.side {
		padding-left: 2rem;
		border-left: 1px solid var(--border);
	}

	@media (max-width: 860px) {
		.columns {
			grid-template-columns: minmax(0, 1fr);
		}

		.side {
			padding-left: 0;
			border-left: 0;
		}
	}

	section,
	.etymology {
		margin-top: 1.6rem;
	}

	h2 {
		margin-bottom: 0.75rem;
	}

	/* A section's name stands alone, with no rule running beside it; rules are
	   kept for between the items (sentences, table rows) */
	h2.ui-label::after {
		display: none;
	}

	.senses {
		font-size: var(--text-lg);
	}

	/* 1. 2. 3., quieter than the meanings they count */
	.senses > li::before {
		content: counter(sense) '.';
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.9;
	}

	/* The first meanings, in the text font a size up: they are what the page is for */
	.big {
		color: var(--ink);
		font-size: var(--text-xl);
		line-height: 1.3;
	}

	/* A usage note split off a meaning (splitGloss) */
	.note {
		margin-top: 0.3rem;
		color: var(--ink-2);
		font-size: 1rem;
	}

	/* "22 more meanings", and the rows that open like it */
	details > summary {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		list-style: none;
		cursor: pointer;
	}

	details > summary::-webkit-details-marker {
		display: none;
	}

	.chevron {
		display: inline-flex;
		color: var(--muted);
		transform: rotate(90deg);
		transition: transform var(--duration);
	}

	details[open] > summary .chevron {
		transform: rotate(-90deg);
	}

	.more {
		margin-top: 0.75rem;
	}

	.more > summary {
		display: inline-flex;
		gap: 0.3rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.more > summary .chevron {
		color: inherit;
	}

	.more > ol {
		margin-top: 0.75rem;
	}

	.etymology > summary h2 {
		flex: 1;
		margin: 0;
	}

	.etymology .hint {
		overflow: hidden;
		color: var(--muted);
		font-size: var(--text-sm);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.etymology > p {
		margin-top: 0.75rem;
		white-space: pre-line;
	}

	/* Synonyms and antonyms of the word as a whole, under its meanings and in
	   line with their text, past the numerals */
	.whole {
		margin: 0.9rem 0 0 1.75rem;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--border);
	}

	/* A remark on a meaning, as a dictionary sets it: (figurative) skyline */
	.tag {
		color: var(--muted);
		font-size: 1rem;
		font-style: italic;
	}

	.quotes,
	.sentences {
		margin: 0.3rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 1rem;
	}

	.quotes li {
		padding-left: 0.75rem;
		border-left: 2px solid var(--border-strong);
	}

	.quotes li + li {
		margin-top: 0.3rem;
	}

	/* Ruled off from one another and nothing more: the entry is the card, and
	   a box of its own around the sentences made a card inside a card. */
	.sentences {
		margin: 0;
	}

	.sentences li {
		padding: 0.6rem 0;
	}

	.sentences li:first-child {
		padding-top: 0;
	}

	.sentences li:last-child {
		padding-bottom: 0;
	}

	.sentences li + li {
		border-top: 1px solid var(--border);
	}

	section a.credit {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.other {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.4rem 1.5rem;
		margin: 0.9rem 0 0;
	}

	.other dt {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.other dd {
		margin: 0;
	}

	/* What the underlines in the tables mean */
	.shift {
		margin-top: 0.6rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.shift b {
		color: var(--ink-2);
	}

	.guide {
		margin-top: 0.75rem;
		font-size: var(--text-sm);
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.3rem 1.5rem;
		margin-top: 1.6rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-size: var(--text-sm);
	}

	@media (max-width: 600px) {
		article {
			padding: 1.1rem 1rem 0.9rem;
		}
	}
</style>
