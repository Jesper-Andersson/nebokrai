<!-- One page of the words under a letter, in columns, each word a link to its
     own page. Above them the alphabet, and the letter's pages by their guide
     words when it has more than one. -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import ListPage from '#lib/ListPage.svelte';
	import { ALPHABET, OTHER, letterPath } from '#lib/browse.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let other = $derived(data.letter === OTHER);
	let guide = $derived(data.pages[data.page - 1]);
	let title = $derived(other ? m.browse.otherTitle : m.browse.letterTitle(data.letter.toUpperCase()));
	// Each page of a letter has a title of its own: Words beginning with П: пере – пил
	let metaTitle = $derived(data.pages.length > 1 ? `${title}: ${guide.first} – ${guide.last}` : title);
	let description = $derived(
		other ? m.meta.other : m.meta.letter(data.letter.toUpperCase(), guide.first, guide.last));
</script>

<ListPage {title} {metaTitle} {description}>
	<nav class="alphabet" aria-label={m.browse.alphabet}>
		{#each ALPHABET as letter (letter)}
			<a href={letterPath(letter)} lang="uk" aria-current={letter === data.letter ? 'true' : undefined}>
				{letter.toUpperCase()}
			</a>
		{/each}
		<a class="other" href={letterPath(OTHER)} aria-current={other ? 'true' : undefined}>{m.browse.other}</a>
	</nav>

	{#if other}<p class="lead">{m.browse.otherLead}</p>{/if}

	{#if data.pages.length > 1}
		<nav class="pages" aria-label={m.browse.pages} lang="uk">
			{#each data.pages as page, i (i)}
				<a
					class="ui-chip"
					href={letterPath(data.letter, i + 1)}
					aria-current={i + 1 === data.page ? 'page' : undefined}
				>
					{page.first} – {page.last}
				</a>
			{/each}
		</nav>
	{/if}

	<ul class="list" lang={other ? undefined : 'uk'}>
		{#each data.words as word (word)}
			<li><a href={wordPath(word)}>{word}</a></li>
		{/each}
	</ul>

	<div class="turn">
		{#if data.page > 1}
			<a rel="prev" href={letterPath(data.letter, data.page - 1)}>
				<Icon name="arrow-left" size={16} />{m.browse.previous}
			</a>
		{/if}
		<a href="/words">{m.browse.all}</a>
		{#if data.page < data.pages.length}
			<a rel="next" href={letterPath(data.letter, data.page + 1)}>
				{m.browse.next}<Icon name="chevron-right" size={16} />
			</a>
		{/if}
	</div>
</ListPage>

<style>
	/* The alphabet as a row of keys: every letter the same square to press */
	.alphabet {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 1rem 0;
	}

	.alphabet a {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		min-width: 2.1rem;
		height: 2.1rem;
		padding-inline: 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--ink-2);
		font-weight: 700;
	}

	.alphabet .other {
		font-size: var(--text-sm);
	}

	@media (hover: hover) {
		.alphabet a:hover {
			border-color: var(--border-strong);
			color: var(--ink);
		}
	}

	.alphabet a[aria-current],
	.pages a[aria-current] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}

	.pages {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 1rem 0;
	}

	/* Columns as wide as most words need; the browser fits as many as there
	   is room for, four on a desktop. A long entry (Північні Маріанські
	   Острови) takes a second line. */
	.list {
		margin: 1.25rem 0;
		padding: 0;
		columns: 10rem;
		column-gap: 1.5rem;
		list-style: none;
	}

	.list li {
		break-inside: avoid;
	}

	.list a {
		display: block;
		padding-block: 0.12rem;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	/* Gold under a word means: this opens (Headword.svelte) */
	@media (hover: hover) {
		.list a:hover {
			text-decoration: underline;
			text-decoration-thickness: 2px;
			text-decoration-color: var(--gold);
			text-underline-offset: 4px;
		}
	}

	.list a:focus-visible {
		border-radius: var(--radius-sm);
	}

	.turn {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.turn a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding-block: 0.3rem;
		color: var(--ink-2);
	}

	.turn a:hover {
		color: var(--ink);
	}

	/* Two columns on a phone, where one would make the page twice as long */
	@media (max-width: 600px) {
		.list {
			columns: 2;
			column-gap: 1rem;
		}
	}

	/* A taller line to press with a finger */
	@media (pointer: coarse) {
		.list a {
			padding-block: 0.3rem;
		}
	}
</style>
