<!-- A word's page: for each entry of the spelling, the headword with its
     actions, how it is said, its grammar in one italic line, the meanings
     with their synonyms and antonyms, example sentences, the form tables
     behind tabs (FormTables.svelte), the words related to it and the
     etymology. A spelling with several entries gets a list of them first. -->
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
	import Stressed from '#lib/Stressed.svelte';
	import Tip from '#lib/Tip.svelte';
	import { formTables } from '#lib/forms.ts';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { plain } from '#lib/search/normalize.ts';
	import type { WordEntry } from '#lib/search/word.ts';
	import { wordDescription, wordTitle } from '#lib/seo.ts';
	import { useSettings } from '#lib/settings.ts';
	import { differOnlyByStress, stressMoved, stressShift } from '#lib/stress.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	const wiktionary = (word: string) =>
		`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Ukrainian`;

	// Audio URLs point at an mp3 transcoded from a Commons file; the file's own
	// page (with author and licence) is named after the original, which is the
	// second-to-last part of a transcoded address.
	function commonsPage(audioUrl: string) {
		const parts = audioUrl.split('/');
		const file = parts.includes('transcoded') ? parts.at(-2) : parts.at(-1);
		return `https://commons.wikimedia.org/wiki/File:${file}`;
	}

	function play(entry: WordEntry) {
		if (entry.audio_url) {
			void new Audio(entry.audio_url).play();
		} else {
			const utterance = new SpeechSynthesisUtterance(entry.word);
			utterance.lang = 'uk-UA';
			speechSynthesis.speak(utterance);
		}
	}

	const label = (tag: string) => tag.replace(/-/g, ' ');

	// The synonyms or antonyms of one meaning of an entry, or (n null) of the
	// entry as a whole.
	const named = (entry: WordEntry, kind: 'synonym' | 'antonym', n: number | null) =>
		entry.relations.filter((x) => x.kind === kind && x.sense_n === n);

	// The spellings an example sentence can have this entry's word in: the word
	// and its forms of one word (буду читати is two, and буду is not читати).
	const ownForms = (entry: WordEntry) =>
		new Set([entry.word, ...entry.forms.map((f) => f.form).filter((form) => !form.includes(' '))].map(plain));

	// The list of entries names each headword only when they are not all the
	// same (за́мок and замо́к, or а, А and -а behind one address).
	let varied = $derived(new Set(data.entries.map((e) => e.headword)).size > 1);
	let stressedApart = $derived(
		data.entries.some((a, i) => data.entries.slice(i + 1).some((b) => differOnlyByStress(a.headword, b.headword)))
	);
</script>

<!-- A spelling with several entries is described by its most common one -->
<PageMeta title={wordTitle(m, data.entries[0])} description={wordDescription(m, data.entries[0])} />

<div class="ui-page">
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
		<!-- Derived words and words of the same root are shown for the entry as a
		     whole, whichever meaning Wiktionary lists them under -->
		{@const derived = entry.relations.filter((x) => x.kind === 'derived')}
		{@const sameRoot = entry.relations.filter((x) => x.kind === 'related')}
		<article id="entry-{entry.id}" class="ui-card">
			<header>
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
					</div>
				</div>
				{#if entry.roman || entry.ipa}
					<p class="pron">
						{#if entry.roman}<span>{entry.roman}</span>{/if}
						{#if entry.ipa}<span class="ipa">{entry.ipa}</span>{/if}
					</p>
				{/if}
				<!-- How common the word is stands at the right end of the grammar
				     line, as it does on a search card -->
				<div class="grammar">
					<Grammar pos={entry.pos} tags={entry.tags} headForms={entry.head_forms} />
					<FrequencyMeter rank={entry.freq_rank} showTier />
				</div>
			</header>

			<section>
				<h2 class="ui-label">{m.word.meanings}</h2>
				<ol class="ui-senses senses">
					{#each entry.senses as sense (sense.n)}
						<li>
							<p>
								{#if sense.tags.length}<i class="tag">({sense.tags.map(label).join(', ')})</i>{/if}
								{sense.gloss}
							</p>
							{#if sense.examples.length}
								<ul class="quotes">
									{#each sense.examples as ex}
										<li>
											<Sentence text={ex.text} {own} />
											{#if ex.english}<span class="en">{ex.english}</span>{/if}
										</li>
									{/each}
								</ul>
							{/if}
							<RelatedWords label={m.word.synonyms} words={named(entry, 'synonym', sense.n)} />
							<RelatedWords label={m.word.antonyms} words={named(entry, 'antonym', sense.n)} />
						</li>
					{/each}
				</ol>
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
								<span class="en">{ex.en}</span>
								<a class="credit" href="https://tatoeba.org/sentences/show/{ex.tatoeba_id}">
									Tatoeba #{ex.tatoeba_id}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if tables.length || other.length}
				<section>
					<h2 class="ui-label">{entry.pos === 'verb' ? m.word.conjugation : m.word.forms}</h2>
					{#if tables.length}<FormTables {tables} headword={base} />{/if}
					{#if other.length}
						<dl class="other">
							{#each other as group (group.label)}
								<div>
									<dt>{group.label}</dt>
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
				</section>
			{/if}

			{#if derived.length || sameRoot.length}
				<section>
					<h2 class="ui-label">{m.word.family}</h2>
					<RelatedWords label={m.word.derived} words={derived} limit={24} />
					<RelatedWords label={m.word.sameRoot} words={sameRoot} limit={24} />
				</section>
			{/if}

			{#if entry.etymology}
				<section>
					<h2 class="ui-label">{m.word.etymology}</h2>
					<p class="etymology">{entry.etymology}</p>
				</section>
			{/if}

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
		font-variant-numeric: tabular-nums;
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

	.title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.grammar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.3rem 1.5rem;
		margin-top: 0.6rem;
	}

	/* At the right edge also when it has a line to itself */
	.grammar :global(.freq) {
		margin-left: auto;
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
	}

	.ipa {
		color: var(--muted);
		font-family: var(--font-ipa);
	}

	section {
		margin-top: 1.6rem;
	}

	h2 {
		margin-bottom: 0.75rem;
	}

	.senses {
		font-size: var(--text-lg);
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

	.sentences {
		margin: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.sentences li {
		padding: 0.6rem 0.9rem;
	}

	.sentences li + li {
		border-top: 1px solid var(--border);
	}

	.en {
		display: block;
		color: var(--muted);
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

	.etymology {
		white-space: pre-line;
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
