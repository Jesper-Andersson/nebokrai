<!-- A panel with a title, for text pages (About, Resources, Report). -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} · Nebokrai</title>
</svelte:head>

<article>
	<h1>{title}</h1>
	{@render children()}
</article>

<style>
	article {
		box-sizing: border-box;
		/* Leaves a 1rem gutter on each side of a narrow window */
		width: min(44rem, 100% - 2rem);
		margin: 1.5rem auto 2rem;
		padding: 1.5rem 1.75rem 1.75rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		box-shadow: var(--shadow);
		line-height: 1.6;
	}

	h1 {
		margin: 0 0 0.75rem;
		font-family: var(--font-heading);
		font-size: clamp(1.6rem, 4vw, 2rem);
		font-weight: 700;
		line-height: 1.2;
	}

	article :global(h2) {
		margin: 1.75rem 0 0.5rem;
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1.25;
	}

	article :global(p) {
		margin: 0.5rem 0;
	}

	article :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
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
