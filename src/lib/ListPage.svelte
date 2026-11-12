<!-- A sheet with a title, for pages that are lists of words (the commonest
     words, the words under a letter). Like TextPage, but as wide as a
     dictionary page, and its links are left to the lists: a column of six
     hundred words is not six hundred underlined links. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageMeta from '#lib/PageMeta.svelte';

	let {
		title,
		/** For the browser tab and search results, when it says more than the heading: which page of several. */
		metaTitle = title,
		description,
		children
	}: { title: string; metaTitle?: string; description: string; children: Snippet } = $props();
</script>

<PageMeta title="{metaTitle} · Nebokrai" {description} />

<article class="ui-card">
	<h1 class="ui-title">{title}</h1>
	{@render children()}
</article>

<style>
	article {
		box-sizing: border-box;
		/* Leaves a 1rem gutter on each side of a narrow window */
		width: min(var(--page), 100% - 2rem);
		margin: 1.5rem auto 2rem;
		padding: 1.5rem 1.75rem 1.75rem;
		line-height: 1.6;
	}

	h1 {
		margin-bottom: 0.75rem;
	}

	article :global(.lead) {
		margin: 0.5rem 0;
		font-size: var(--text-lg);
	}

	article :global(.muted) {
		margin: 0.5rem 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* A link in a sentence, as on a page of text */
	article :global(p a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	article :global(p a:hover) {
		color: var(--link-hover);
	}

	@media (max-width: 600px) {
		article {
			margin-top: 1rem;
			padding: 1.1rem 1.1rem 1.3rem;
		}
	}
</style>
