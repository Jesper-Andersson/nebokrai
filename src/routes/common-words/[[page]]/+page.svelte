<!-- The commonest words, a hundred to a page: its place in the list, the word
     with its stress, what part of speech it is, and its first meaning. The
     word leads to its own page. -->
<script lang="ts">
	import Headword from '#lib/Headword.svelte';
	import ListPage from '#lib/ListPage.svelte';
	import { COMMON_PER_PAGE, commonPath } from '#lib/browse.ts';
	import { messagesFor, posLabel } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// 101–200: the part of the list a page holds
	const range = (page: number) => `${(page - 1) * COMMON_PER_PAGE + 1}–${page * COMMON_PER_PAGE}`;
	// "pronoun, conjunction", as in a line of grammar
	const parts = (pos: string[]) => pos.map((p) => posLabel(m, p).toLocaleLowerCase(settings.lang)).join(', ');
</script>

{#snippet pager()}
	<nav class="pager" aria-label={m.browse.commonPages}>
		{#each { length: data.pages }, i}
			<a class="ui-chip" href={commonPath(i + 1)} aria-current={i + 1 === data.page ? 'page' : undefined}>
				{range(i + 1)}
			</a>
		{/each}
	</nav>
{/snippet}

<ListPage
	title={m.browse.commonTitle}
	metaTitle={data.page > 1 ? `${m.browse.commonTitle}: ${range(data.page)}` : m.browse.commonTitle}
	description={m.meta.commonWords}
>
	<p class="lead">{m.browse.commonLead}</p>
	{@render pager()}

	<ol class="words" start={data.first}>
		{#each data.words as entry, i (entry.word)}
			<li>
				<span class="n" aria-hidden="true">{data.first + i}</span>
				<span class="word">
					<Headword text={entry.headword} size="sm" href={wordPath(entry.word)} />
					<i>{parts(entry.pos)}</i>
				</span>
				<span class="gloss">{entry.gloss}</span>
			</li>
		{/each}
	</ol>

	{@render pager()}
	<p class="muted">{m.browse.commonSource} <a href="/sources">{m.footer.sources}</a>.</p>
</ListPage>

<style>
	.pager {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 1rem 0;
	}

	.pager a[aria-current='page'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}

	/* The list's own numerals (.n) stand in for the browser's, to line up */
	.words {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.words li {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 13rem) minmax(0, 1fr);
		align-items: baseline;
		gap: 0 0.9rem;
		padding: 0.45rem 0;
		border-top: 1px solid var(--border);
	}

	.n {
		color: var(--muted);
		font-size: var(--text-sm);
		text-align: right;
	}

	.word {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.5rem;
	}

	.word i {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* A meaning can run to a paragraph (на has one of 190 letters): two lines
	   here, all of it on the word's page */
	.gloss {
		display: -webkit-box;
		overflow: hidden;
		color: var(--ink-2);
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	/* On a phone the meaning goes under the word */
	@media (max-width: 600px) {
		.words li {
			grid-template-columns: 2rem minmax(0, 1fr);
			gap: 0 0.7rem;
		}

		.gloss {
			grid-column: 2;
		}
	}
</style>
