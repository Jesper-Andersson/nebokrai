<script lang="ts">
	import { describeTags, formTables } from '#lib/forms.ts';
	import { formLabel, messagesFor, posLabel } from '#lib/i18n.ts';
	import { commonality } from '#lib/labels.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { WordEntry } from '#lib/search/word.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
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
			new Audio(entry.audio_url).play();
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

<!-- A word with its stressed vowel (letter + U+0301) in red -->
{#snippet stressed(text: string)}{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span class="stress">{part}</span>{:else}{part}{/if}{/each}{/snippet}

<p class="back"><a href="/">{m.word.back}</a></p>

{#each data.entries as entry (entry.id)}
	{@const { tables, other } = formTables(entry.pos, entry.forms, entry.word)}
	{@const common = commonality(entry.freq_rank)}
	<article>
		<header>
			<p
				class="freq {common}"
				title={entry.freq_rank
					? m.word.rankTitle(rank(entry.freq_rank))
					: m.word.unranked}
			>
				{m.tiers[common]}{#if entry.freq_rank}<span class="rank">#{rank(entry.freq_rank)}</span>{/if}
			</p>
			<p class="meta">
				<span class="pos">{posLabel(m, entry.pos)}</span>
				{entry.tags.join(' · ')}
			</p>
			<h1>
				<span class="headword" lang="uk">{@render stressed(entry.headword)}</span>
				<button
					class="play"
					aria-label={m.card.play}
					title={entry.audio_url ? m.word.playRecording : m.word.playVoice}
					onclick={() => play(entry)}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<polygon points="10 8 16 12 10 16 10 8" />
					</svg>
				</button>
			</h1>
			<p class="pron">
				{#if entry.roman}<span>{entry.roman}</span>{/if}
				{#if entry.ipa}<span class="ipa">{entry.ipa}</span>{/if}
			</p>
			{#if entry.head_forms.length}
				<p class="head-forms">
					{#each entry.head_forms as f, i}
						{#if i}<span class="sep">·</span>{/if}
						<span class="tags">{describeTags(f.tags)}</span>
						<b lang="uk">{@render stressed(f.form)}</b>
					{/each}
				</p>
			{/if}
		</header>

		<section>
			<h2>{m.word.meanings}</h2>
			<ol class="senses">
				{#each entry.senses as sense (sense.n)}
					<li>
						{#each sense.tags as tag}<span class="badge">{label(tag)}</span>{/each}
						{sense.gloss}
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
				<div class="tables">
					{#each tables as table (table.title)}
						<div class="table-wrap">
							<table>
								<caption>{formLabel(m, table.title)}</caption>
								{#if table.columns.some(Boolean)}
									<thead>
										<tr>
											<td></td>
											{#each table.columns as col}<th scope="col">{formLabel(m, col)}</th>{/each}
										</tr>
									</thead>
								{/if}
								<tbody>
									{#each table.rows as row (row.label)}
										<tr>
											<th scope="row">{formLabel(m, row.label)}</th>
											{#each row.cells as cell}
												<td lang="uk">
													{#each cell as item, i}
														{#if i}<br />{/if}{@render stressed(item.form)}{#if item.note}
															<small>{item.note}</small>{/if}
													{:else}<span class="none">—</span>{/each}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>
				{#if other.length}
					<dl class="other">
						{#each other as group (group.label)}
							<div>
								<dt>{group.label}</dt>
								<dd lang="uk">
									{#each group.forms as form, i}{#if i}, {/if}{@render stressed(form)}{/each}
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
			{m.word.from} <a href={wiktionary(entry.word)}>{m.word.wiktionary}</a>
			(<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>)
			{#if entry.audio_url}
				· <a href={commonsPage(entry.audio_url)}>{m.word.recording}</a>
			{/if}
			<a class="report" href="/report?entry={entry.id}">{m.word.report}</a>
		</footer>
	</article>
{/each}

<style>
	.back {
		max-width: 48rem;
		margin: 0.25rem auto 0;
		text-align: left;
	}

	/* The padding makes the link a 40px tap target; it sits where it did before */
	.back a {
		display: inline-block;
		padding: 0.75rem 0.75rem 0.6rem 0;
		color: white;
		filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.6));
	}

	article {
		box-sizing: border-box;
		max-width: 48rem;
		margin: 0 auto 1.25rem;
		padding: 1.25rem 1.5rem 1rem;
		border-radius: 6px;
		background: var(--panel);
		color: var(--ink);
		line-height: 1.5;
		text-align: left;
	}

	p {
		margin: 0;
	}

	a {
		color: var(--link);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	header {
		position: relative;
	}

	/* Commonality pill, top right; colours keep the text above 4.5:1 contrast */
	.freq {
		float: right;
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		margin: 0 0 0 0.75rem;
		padding: 0.15rem 0.75rem;
		border: 1.5px solid;
		border-radius: 999px;
		font-size: 0.9rem;
		font-weight: 800;
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

	.meta {
		font-size: 0.9rem;
	}

	.pos {
		margin-right: 0.3rem;
		color: var(--ink-soft);
		font-size: 1.1rem;
		font-weight: 800;
	}

	h1 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		/* Start below the commonality pill. Beside it, the headword lost the
		   pill's width on every line, and a long word broke into three on a phone. */
		clear: right;
		margin: 0.1rem 0 0.2rem;
		font-size: clamp(2rem, 6vw, 2.6rem);
		font-weight: 800;
		line-height: 1.2;
	}

	/* A long word (конкурентоспроможність) breaks onto a second line on a
	   phone instead of pushing the page wider than the screen */
	.headword {
		min-width: 0;
		font-family: var(--font-headword);
		overflow-wrap: anywhere;
	}

	.stress {
		color: var(--stress);
	}

	/* Padding for a 43px tap area; the negative margin keeps the icon in place */
	.play {
		display: inline-flex;
		flex: none;
		margin: -0.55rem;
		padding: 0.55rem;
		border: 0;
		background: none;
		color: var(--play);
		cursor: pointer;
	}

	.play svg {
		width: 1.6rem;
		height: 1.6rem;
	}

	.pron {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
		color: var(--ink-soft);
	}

	.ipa {
		font-family: 'Gentium Plus', 'Charis SIL', 'Doulos SIL', 'Segoe UI', sans-serif;
	}

	.head-forms {
		margin-top: 0.4rem;
	}

	.head-forms .tags {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.head-forms b {
		font-size: 1.05rem;
	}

	.sep {
		margin: 0 0.4rem;
		color: var(--faint);
	}

	section {
		margin-top: 1.25rem;
	}

	h2 {
		margin: 0 0 0.4rem;
		padding-bottom: 0.2rem;
		border-bottom: 1.5px solid var(--rule);
		font-family: var(--font-heading);
		font-size: 1.15rem;
		font-weight: 700;
	}

	.senses {
		margin: 0;
		padding-left: 1.5rem;
		font-size: 1.1rem;
	}

	.senses > li + li {
		margin-top: 0.3rem;
	}

	.badge {
		display: inline-block;
		margin-right: 0.35rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		background: var(--badge-bg);
		color: var(--badge-ink);
		font-size: 0.8rem;
		font-weight: 600;
		vertical-align: 0.1em;
	}

	.quotes,
	.sentences {
		margin: 0.25rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 1rem;
	}

	.quotes li {
		padding-left: 0.75rem;
		border-left: 3px solid var(--line);
	}

	.sentences li {
		padding: 0.35rem 0;
	}

	.sentences li + li {
		border-top: 1px solid var(--line);
	}

	.en {
		display: block;
		color: var(--muted);
	}

	.credit {
		color: var(--faint);
		font-size: 0.8rem;
	}

	.tables {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: flex-start;
	}

	.table-wrap {
		max-width: 100%;
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		font-size: 1rem;
	}

	caption {
		padding-bottom: 0.2rem;
		font-weight: 800;
		text-align: left;
	}

	th,
	td {
		padding: 0.25rem 0.75rem 0.25rem 0;
		border-bottom: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}

	th {
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 600;
	}

	td small {
		color: var(--faint);
	}

	.none {
		color: var(--faint);
	}

	.other {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.3rem 1.5rem;
		margin: 0.75rem 0 0;
	}

	.other dt {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.other dd {
		margin: 0;
	}

	.etymology {
		white-space: pre-line;
	}

	footer .report {
		float: right;
		margin-left: 1rem;
	}

	/* flow-root: the floated report link stays inside the panel when it wraps
	   to a line of its own (it hung below the panel's edge on a phone) */
	footer {
		display: flow-root;
		margin-top: 1.25rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		article {
			padding: 1rem 1rem 0.75rem;
		}
	}
</style>
