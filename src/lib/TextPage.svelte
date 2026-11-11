<!-- A sheet with a title, for pages of text (About, Resources, Sources,
     Report). `.lead` on a first paragraph sets it a size larger. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageMeta from '#lib/PageMeta.svelte';

	/** `description` is for search results and link previews; the page itself does not show it. */
	let { title, description, children }: { title: string; description: string; children: Snippet } = $props();
</script>

<PageMeta title="{title} · Nebokrai" {description} />

<article class="ui-card">
	<h1 class="ui-title">{title}</h1>
	{@render children()}
</article>

<style>
	article {
		box-sizing: border-box;
		/* Leaves a 1rem gutter on each side of a narrow window */
		width: min(var(--prose), 100% - 2rem);
		margin: 1.5rem auto 2rem;
		padding: 1.5rem 1.75rem 1.75rem;
		line-height: 1.6;
	}

	h1 {
		margin-bottom: 0.75rem;
	}

	article :global(h2) {
		margin: 1.75rem 0 0.5rem;
		font-family: var(--font-heading);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1.25;
	}

	article :global(.lead) {
		font-size: var(--text-lg);
	}

	article :global(p) {
		margin: 0.5rem 0;
	}

	article :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	article :global(a:hover) {
		color: var(--link-hover);
	}

	article :global(.muted) {
		color: var(--muted);
	}

	@media (max-width: 600px) {
		article {
			margin-top: 1rem;
			padding: 1.1rem 1.1rem 1.3rem;
		}
	}
</style>
