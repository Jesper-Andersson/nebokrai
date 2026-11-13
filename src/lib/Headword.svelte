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

	// The letters of its longest part, for the `lg` size (below). A phrase can
	// turn the line at a space and a compound at its hyphen, so it is the part
	// between them that has to fit; the stress mark takes no room.
	let letters = $derived(Math.max(1, ...text.replaceAll('́', '').split(/[\s-]+/).map((part) => part.length)));
	let fit = $derived(size === 'lg' ? letters : undefined);
</script>

{#if href}
	<a class="headword {size}" lang="uk" {href} style:--letters={fit}><Stressed {text} /></a>
{:else}
	<svelte:element this={tag} class="headword {size}" lang="uk" style:--letters={fit}>
		<Stressed {text} />
	</svelte:element>
{/if}

<style>
	/* A long word (конкурентоспроможність) breaks onto a second line on a
	   phone instead of pushing the page wider than the screen. That is the
	   last resort: the `lg` size is made smaller first (below). */
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

	/* On its own page and on a flashcard the word is the thing being read,
	   letter by letter, and a break in the middle of it (кавалерійськи / й on
	   a phone) spoils exactly that. So a long word is set as large as lets it
	   stand on one line of the box it is in: the box's width (100cqi; the
	   parent must be a container, `container-type: inline-size`) over the
	   letters of the word, each taken as 0.66 of the font size. Measured over
	   the 6,925 words of eleven letters or more in the dictionary, a letter of
	   this font is 0.60 of the size at the median and 0.65 for 99 in 100; the
	   widest, Житомирщина, is 0.685 and may still break.
	   Never smaller than a headword in a list: конкурентоспроможність, 22
	   letters, is 23px on a 390px phone, and that smallest size (19px) on a
	   320px one, where it still stands on one line. */
	.lg {
		font-size: clamp(var(--headword-sm), calc(100cqi / (var(--letters) * 0.66)), var(--headword-lg));
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
