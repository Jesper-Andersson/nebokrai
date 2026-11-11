<!-- A word's page in the draft design. The data is the current page's
     (src/routes/word/[word]); what changes is the layout: the headword with
     its actions, a list of the entries when a spelling has several, and the
     form tables behind tabs (FormTables.svelte). -->
<script lang="ts">
	import { mergeProps } from 'bits-ui';
	import FormTables from '#lib/draft/FormTables.svelte';
	import Icon from '#lib/draft/Icon.svelte';
	import { DRAFT } from '#lib/draft/paths.ts';
	import SaveButton from '#lib/draft/SaveButton.svelte';
	import Stressed from '#lib/draft/Stressed.svelte';
	import { draftStrings } from '#lib/draft/strings.ts';
	import Tip from '#lib/draft/Tip.svelte';
	import { describeTags, formTables } from '#lib/forms.ts';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { commonality } from '#lib/labels.ts';
	import type { WordEntry } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let s = $derived(draftStrings(settings.lang));
	const rank = (n: number) => n.toLocaleString(settings.lang === 'uk' ? 'uk' : 'en');

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
</script>

<svelte:head>
	<title>{data.entries[0].headword.replace(/́/g, '')} · Nebokrai</title>
</svelte:head>

<div class="page">
	<p class="back">
		<a href={DRAFT}><Icon name="arrow-left" size={16} />{m.word.back.replace(/^←\s*/, '')}</a>
	</p>

	<!-- стан is a noun five times over: say so before the first entry -->
	{#if data.entries.length > 1}
		<nav class="entries" aria-label={s.entries}>
			{#each data.entries as entry, i (entry.id)}
				<a href="#entry-{entry.id}">
					<span class="n">{i + 1}</span>
					<b>{posLabel(m, entry.pos)}</b>
					<span class="gloss">{entry.senses[0]?.gloss ?? ''}</span>
				</a>
			{/each}
		</nav>
	{/if}

	{#each data.entries as entry (entry.id)}
		{@const { tables, other } = formTables(entry.pos, entry.forms, entry.word)}
		{@const common = commonality(entry.freq_rank)}
		{@const playLabel = entry.audio_url ? m.word.playRecording : m.word.playVoice}
		<article id="entry-{entry.id}">
			<header>
				<p class="meta">
					<span class="d-badge">{posLabel(m, entry.pos)}</span>
					{#if entry.tags.length}<span>{entry.tags.join(' · ')}</span>{/if}
					<span
						class="freq {common}"
						title={entry.freq_rank ? m.word.rankTitle(rank(entry.freq_rank)) : m.word.unranked}
					>
						{m.tiers[common]}{#if entry.freq_rank}<span class="rank">#{rank(entry.freq_rank)}</span>{/if}
					</span>
				</p>
				<div class="title">
					<h1 class="headword" lang="uk"><Stressed text={entry.headword} /></h1>
					<div class="actions">
						<Tip label={playLabel}>
							{#snippet trigger(props)}
								<button
									{...mergeProps(props, { onclick: () => play(entry) })}
									type="button"
									class="d-icon-btn play"
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
				{#if entry.head_forms.length}
					<ul class="head-forms">
						{#each entry.head_forms as f}
							<li>
								<span>{describeTags(f.tags)}</span>
								<b lang="uk"><Stressed text={f.form} /></b>
							</li>
						{/each}
					</ul>
				{/if}
			</header>

			<section>
				<h2>{m.word.meanings}</h2>
				<ol class="senses">
					{#each entry.senses as sense (sense.n)}
						<li>
							<p>
								{#each sense.tags as tag}<span class="tag">{label(tag)}</span>{/each}
								{sense.gloss}
							</p>
							{#if sense.examples.length}
								<ul class="quotes">
									{#each sense.examples as ex}
										<li>
											<span lang="uk">{ex.text}</span>
											{#if ex.english}<span class="en">{ex.english}</span>{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ol>
			</section>

			{#if entry.examples.length}
				<section>
					<h2>{m.word.examples}</h2>
					<ul class="sentences">
						{#each entry.examples as ex (ex.tatoeba_id)}
							<li>
								<span lang="uk">{ex.uk}</span>
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
					<h2>{entry.pos === 'verb' ? m.word.conjugation : m.word.forms}</h2>
					{#if tables.length}<FormTables {tables} />{/if}
					{#if other.length}
						<dl class="other">
							{#each other as group (group.label)}
								<div>
									<dt>{group.label}</dt>
									<dd lang="uk">
										{#each group.forms as form, i}{#if i}, {/if}<Stressed text={form} />{/each}
									</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</section>
			{/if}

			{#if entry.etymology}
				<section>
					<h2>{m.word.etymology}</h2>
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
				<a href="{DRAFT}/report?entry={entry.id}">{m.word.report}</a>
			</footer>
		</article>
	{/each}
</div>

<style>
	.page {
		box-sizing: border-box;
		max-width: 50rem;
		margin: 0 auto;
		padding: 0 1rem;
	}

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
		color: var(--d-muted);
		font-size: 0.92rem;
		font-weight: 600;
	}

	.back a:hover {
		color: var(--d-ink);
	}

	/* The entries of this spelling, as a row of links */
	.entries {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding-bottom: 0.25rem;
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.entries a {
		display: flex;
		flex: none;
		align-items: baseline;
		gap: 0.45rem;
		max-width: 16rem;
		padding: 0.4rem 0.75rem 0.4rem 0.5rem;
		border: 1px solid var(--d-border);
		border-radius: 10px;
		background: var(--d-surface);
		font-size: 0.88rem;
	}

	.entries a:hover {
		border-color: var(--d-border-strong);
	}

	.entries .n {
		min-width: 1.3rem;
		border-radius: 6px;
		background: var(--d-surface-2);
		color: var(--d-muted);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.3rem;
		text-align: center;
	}

	.entries .gloss {
		overflow: hidden;
		color: var(--d-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	article {
		margin-bottom: 1.25rem;
		padding: 1.5rem 1.75rem 1.1rem;
		border: 1px solid var(--d-border);
		border-radius: 16px;
		background: var(--d-surface);
		box-shadow: var(--d-shadow);
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
		color: var(--d-accent);
		text-decoration: underline;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.6rem;
		color: var(--d-muted);
		font-size: 0.9rem;
	}

	/* How common the word is, at the right end of the line; the colours keep
	   the text above 4.5:1 contrast */
	.freq {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		margin-left: auto;
		padding: 0.1rem 0.7rem;
		border: 1px solid;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.freq .rank {
		font-weight: 600;
		opacity: 0.8;
	}

	.freq.very-common {
		border-color: var(--pill-1-line);
		background: var(--pill-1-bg);
		color: var(--pill-1-ink);
	}

	.freq.common {
		border-color: var(--pill-2-line);
		background: var(--pill-2-bg);
		color: var(--pill-2-ink);
	}

	.freq.uncommon {
		border-color: var(--pill-3-line);
		background: var(--pill-3-bg);
		color: var(--pill-3-ink);
	}

	.freq.rare {
		border-color: var(--pill-4-line);
		background: var(--pill-4-bg);
		color: var(--pill-4-ink);
	}

	.title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	/* A long word (конкурентоспроможність) breaks onto a second line on a
	   phone instead of pushing the page wider than the screen */
	.headword {
		min-width: 0;
		margin: 0;
		font-family: var(--font-headword);
		font-size: clamp(2.1rem, 7vw, 3rem);
		font-weight: 800;
		line-height: 1.15;
		overflow-wrap: anywhere;
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
		color: var(--d-ink-2);
	}

	.ipa {
		color: var(--d-muted);
		font-family: 'Gentium Plus', 'Charis SIL', 'Doulos SIL', 'Segoe UI', sans-serif;
	}

	.head-forms {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.8rem 0 0;
		padding: 0;
		list-style: none;
	}

	.head-forms li {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		padding: 0.2rem 0.7rem;
		border: 1px solid var(--d-border);
		border-radius: 999px;
		color: var(--d-muted);
		font-size: 0.82rem;
	}

	.head-forms b {
		color: var(--d-ink);
		font-size: 1rem;
	}

	section {
		margin-top: 1.6rem;
	}

	h2 {
		margin: 0 0 0.6rem;
		color: var(--d-muted);
		font-family: var(--font-heading);
		font-size: 0.95rem;
		font-weight: 700;
	}

	/* Meanings: each number sits in a small tile of its own */
	.senses {
		display: grid;
		gap: 0.55rem;
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: sense;
		font-size: 1.1rem;
	}

	.senses > li {
		position: relative;
		padding-left: 2.2rem;
		counter-increment: sense;
	}

	.senses > li::before {
		content: counter(sense);
		position: absolute;
		top: 0.1rem;
		left: 0;
		width: 1.5rem;
		border-radius: 7px;
		background: var(--d-surface-2);
		color: var(--d-muted);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.5rem;
		text-align: center;
	}

	.tag {
		display: inline-block;
		margin-right: 0.35rem;
		padding: 0 0.45rem;
		border-radius: 6px;
		background: var(--d-gold-soft);
		color: var(--d-gold-ink);
		font-size: 0.78rem;
		font-weight: 600;
		vertical-align: 0.1em;
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
		border-left: 2px solid var(--d-border-strong);
	}

	.quotes li + li {
		margin-top: 0.3rem;
	}

	.sentences {
		margin: 0;
		border: 1px solid var(--d-border);
		border-radius: 12px;
	}

	.sentences li {
		padding: 0.6rem 0.9rem;
	}

	.sentences li + li {
		border-top: 1px solid var(--d-border);
	}

	.en {
		display: block;
		color: var(--d-muted);
	}

	section a.credit {
		color: var(--d-muted);
		font-size: 0.78rem;
	}

	.other {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.4rem 1.5rem;
		margin: 0.9rem 0 0;
	}

	.other dt {
		color: var(--d-muted);
		font-size: 0.85rem;
	}

	.other dd {
		margin: 0;
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
		border-top: 1px solid var(--d-border);
		color: var(--d-muted);
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		.page {
			padding: 0 0.75rem;
		}

		article {
			padding: 1.1rem 1rem 0.9rem;
		}
	}
</style>
