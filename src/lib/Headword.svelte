<!-- A Ukrainian headword, set the same way wherever one stands: heavy, in the
     plainest letters the site has (a learner reads it letter by letter), with
     its stressed vowel in the stress colour (небокра́й). Three sizes: `sm`
     in a list, a toast or the footer, `md` in a search result, `lg` on the
     word's own page. With `href` it is a link to that page. -->
<script lang="ts">
	import Stressed from './Stressed.svelte';

	let {
		text,
		size = 'md',
		href,
		tag = 'span'
	}: { text: string; size?: 'sm' | 'md' | 'lg'; href?: string; tag?: 'span' | 'h1' | 'b' } = $props();
</script>

{#if href}
	<a class="headword {size}" lang="uk" {href}><Stressed {text} /></a>
{:else}
	<svelte:element this={tag} class="headword {size}" lang="uk"><Stressed {text} /></svelte:element>
{/if}

<style>
	/* A long word (конкурентоспроможність) breaks onto a second line on a
	   phone instead of pushing the page wider than the screen */
	.headword {
		min-width: 0;
		margin: 0;
		color: var(--ink);
		font-family: var(--font-headword);
		font-weight: 800;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.sm {
		font-size: var(--headword-sm);
	}

	.md {
		font-size: var(--headword-md);
	}

	.lg {
		font-size: var(--headword-lg);
		line-height: 1.1;
	}

	/* Gold under a headword means: this opens the word */
	a:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-decoration-color: var(--gold);
		text-underline-offset: 4px;
	}

	a:focus-visible {
		border-radius: var(--radius-sm);
	}
</style>
