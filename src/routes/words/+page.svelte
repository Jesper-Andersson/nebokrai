<!-- Every letter of the alphabet with the guide words of its pages (па – пере,
     пере – пил…), as the thumb index of a printed dictionary: any page of
     words is one step from here. -->
<script lang="ts">
	import ListPage from '#lib/ListPage.svelte';
	import { OTHER, commonPath, letterPath } from '#lib/browse.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let locale = $derived(settings.lang === 'uk' ? 'uk' : 'en');
</script>

<ListPage title={m.browse.wordsTitle} description={m.meta.words}>
	<p class="lead">
		{m.browse.wordsLead} <a href={commonPath()}>{m.browse.wordsCommon}</a>
		<a href="/alphabet">{m.browse.wordsAlphabet}</a>
	</p>

	<ul class="letters">
		{#each data.letters as { letter, count, pages } (letter)}
			<li>
				{#if letter === OTHER}
					<a class="letter other" href={letterPath(letter)}>{m.browse.other}</a>
				{:else}
					<a class="letter" href={letterPath(letter)} lang="uk">{letter.toUpperCase()}{letter}</a>
				{/if}
				<span class="count">{count.toLocaleString(locale)}</span>
				<span class="guides" lang={letter === OTHER ? undefined : 'uk'}>
					{#each pages as guide, i (i)}
						<a href={letterPath(letter, i + 1)}>{guide.first} – {guide.last}</a>
					{/each}
				</span>
			</li>
		{/each}
	</ul>
</ListPage>

<style>
	.letters {
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.letters li {
		display: grid;
		grid-template-columns: 3.6rem 3rem minmax(0, 1fr);
		align-items: baseline;
		gap: 0 0.75rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--border);
	}

	/* The letter as a headword: capital and small, as an alphabet shows them */
	.letter {
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: var(--headword-md);
		font-weight: 800;
		line-height: 1.2;
	}

	.letter.other {
		font-family: var(--font-text);
		font-size: 1rem;
		font-weight: 700;
	}

	.count {
		color: var(--muted);
		font-size: var(--text-sm);
		text-align: right;
	}

	.guides {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem 1.25rem;
	}

	.guides a {
		padding-block: 0.15rem;
		color: var(--ink-2);
	}

	/* Gold under a word means: this opens (Headword.svelte) */
	@media (hover: hover) {
		.letter:hover,
		.guides a:hover {
			color: var(--ink);
			text-decoration: underline;
			text-decoration-thickness: 2px;
			text-decoration-color: var(--gold);
			text-underline-offset: 4px;
		}
	}

	.letter:focus-visible,
	.guides a:focus-visible {
		border-radius: var(--radius-sm);
	}

	/* On a phone the guide words go under the letter */
	@media (max-width: 600px) {
		.letters li {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.count {
			text-align: left;
		}

		.guides {
			grid-column: 1 / -1;
			margin-top: 0.2rem;
		}

		.guides a {
			padding-block: 0.4rem;
		}
	}
</style>
