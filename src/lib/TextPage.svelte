<!-- A sheet with a title, for pages of text (About, Resources, Sources,
     Report). `.lead` on a first paragraph sets it a size larger. `wide` gives
     it the dictionary's width instead of the reading width, for a page laid
     out in two columns (Resources).

     On a wide screen a page of three sections or more lists them beside the
     sheet, under "On this page", and marks the one being read: About is
     nearly three screens long at 1440×900, with 23rem of empty margin each
     side. The list is made from the page's own h2 headings once they are
     drawn, so a page needs to do nothing for it. -->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	/** `description` is for search results and link previews; the page itself does not show it. */
	let {
		title,
		description,
		wide = false,
		children
	}: { title: string; description: string; wide?: boolean; children: Snippet } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	let sheet: HTMLElement | undefined = $state();
	let parts = $state.raw<{ id: string; text: string }[]>([]);
	/** The section being read: the last heading to have passed the top of the window */
	let here = $state('');

	const headings = () => (sheet ? [...sheet.querySelectorAll<HTMLElement>('h2')] : []);

	// Read again when the language changes, as the headings are then other words
	$effect(() => {
		void title;
		void settings.lang;
		if (wide) return;
		let live = true;
		void tick().then(() => {
			if (!live) return;
			parts = headings().map((heading, i) => {
				// A heading with no id of its own is given one to link to
				if (!heading.id) heading.id = `part-${i + 1}`;
				return { id: heading.id, text: heading.textContent?.trim() ?? '' };
			});
			mark();
		});
		return () => {
			live = false;
		};
	});

	function mark() {
		if (parts.length < 3) return;
		let current = '';
		for (const heading of headings()) {
			if (heading.getBoundingClientRect().top <= 140) current = heading.id;
		}
		here = current;
	}
</script>

<PageMeta title="{title} · Nebokrai" {description} />

<svelte:window onscroll={mark} />

<article class="ui-card" class:wide bind:this={sheet}>
	<h1 class="ui-title">{title}</h1>
	{@render children()}
</article>

{#if parts.length >= 3}
	<nav class="parts" aria-label={m.nav.onThisPage}>
		<p class="ui-label">{m.nav.onThisPage}</p>
		{#each parts as part (part.id)}
			<a href="#{part.id}" aria-current={here === part.id ? 'location' : undefined}>{part.text}</a>
		{/each}
	</nav>
{/if}

<style>
	article {
		box-sizing: border-box;
		/* Leaves a 1rem gutter on each side of a narrow window */
		width: min(var(--prose), 100% - 2rem);
		margin: 1.5rem auto 2rem;
		padding: 1.5rem 1.75rem 1.75rem;
		line-height: 1.6;
	}

	article.wide {
		width: min(var(--frame-width), 100% - 2rem);
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

	/* Running text reads in the serif; a wide page (Resources) is a grid of
	   cards to scan, so it keeps the interface's sans */
	article:not(.wide) :global(:is(p, li, dt, dd)) {
		font-family: var(--font-reading);
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

	/* A link from the list beside the sheet stops below the sticky header */
	article :global(h2) {
		scroll-margin-top: 4.75rem;
	}

	/* The sections, in the margin to the right of the sheet. Only where the
	   margin has room for them: 44rem of sheet and 17rem each side. */
	.parts {
		display: none;
	}

	@media (min-width: 78rem) {
		.parts {
			position: fixed;
			top: 6.5rem;
			left: calc(50% + var(--prose) / 2 + 2.5rem);
			display: grid;
			gap: 0.45rem;
			width: 13rem;
			max-height: calc(100dvh - 8rem);
			overflow-y: auto;
			font-size: var(--text-sm);
		}

		.parts p {
			margin: 0 0 0.2rem;
		}

		.parts a {
			color: var(--ink-2);
		}

		.parts a:hover,
		.parts a[aria-current] {
			color: var(--ink);
		}

		.parts a[aria-current] {
			font-weight: 700;
		}
	}

	@media (max-width: 600px) {
		article {
			margin-top: 1rem;
			padding: 1.1rem 1.1rem 1.3rem;
		}

		/* On a phone the page itself is the sheet: no frame, and the text gets
		   the width the frame and its padding took, 328 px of 360 instead of
		   293. Over a background photo the frame stays, to keep text readable */
		:global(:root:not([data-bg])) article {
			width: 100%;
			margin: 0.25rem 0 1.5rem;
			padding: 0.75rem 1rem 1rem;
			border: 0;
			border-radius: 0;
			background: none;
			box-shadow: none;
		}
	}
</style>
