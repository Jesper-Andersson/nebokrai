<!-- The frame every page is drawn in: the header, the page, the footer, and the
     corner messages. It also provides what the pages share through context:
     the settings, the saved words, the toaster and the quick search. -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Tooltip } from 'bits-ui';
	import logoIcon from '#lib/assets/logo-icon.svg';
	import Footer from '#lib/Footer.svelte';
	import Header from '#lib/Header.svelte';
	import { provideQuickSearch } from '#lib/quick-search.svelte.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { provideSaved } from '#lib/saved.svelte.ts';
	import { provideSettings } from '#lib/settings.ts';
	import Toasts from '#lib/Toasts.svelte';
	import { provideToasts } from '#lib/toasts.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The settings come from cookies on the server; changing them in the
	// settings menu (SettingsMenu.svelte) updates the whole page at once and
	// stores the new cookie.
	// svelte-ignore state_referenced_locally
	const settings = $state({ ...data.settings });
	provideSettings(settings);

	let address = $derived(page.url.origin + page.url.pathname);
	let m = $derived(messagesFor(settings.lang));

	// Saved words: read from this browser once the page is running, and synced
	// with the account when signed in (see saved.svelte.ts).
	// svelte-ignore state_referenced_locally
	const saved = provideSaved(data.user?.id ?? null);
	onMount(() => void saved.load());

	provideToasts();

	// The quick search lives in the header, and a page can open it too.
	provideQuickSearch();
</script>

<svelte:head>
	<!-- The site's icon is the pair of flashcards from the header. Browsers that
	     can show an SVG icon take the second line; the rest, and anything that
	     asks for /favicon.ico by itself, get static/favicon.ico, which is the
	     same drawing at 16, 32 and 48 pixels. -->
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href={logoIcon} type="image/svg+xml" />
	<!-- Each page sets its own title and description (PageMeta.svelte); this
	     title is what an error page falls back to. -->
	<title>Nebokrai</title>
	<!-- The one address a page is known by: without whatever parameters a
	     link to it carried, so search engines do not list it twice. -->
	<link rel="canonical" href={address} />
	<meta property="og:url" content={address} />
	<meta property="og:site_name" content="Nebokrai" />
	<meta property="og:type" content="website" />
	<!-- The picture a chat or a social network puts beside a link: one for the
	     whole site (scripts/og-image.ts draws it), with its full address,
	     because the networks do not resolve a relative one. The last line asks
	     for the picture at full width instead of as a thumbnail. -->
	<meta property="og:image" content="{page.url.origin}/og.png" />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={m.meta.picture} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<Tooltip.Provider delayDuration={350}>
	<div class="frame">
		<Header />

		<main>
			{@render children()}
		</main>

		<Footer />
	</div>

	<Toasts />
</Tooltip.Provider>

<style>
	.frame {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 100dvh;
	}

	/* No side padding here: the search page's coloured band reaches both
	   edges of the window, so each page sets its own.

	   The sky under the header is painted here, not by the search page, so
	   it is the same behind every page and does not come and go between
	   them. Its size is fixed, whatever the page's height. */
	main {
		flex: 1;
		padding-bottom: 3rem;
		background: radial-gradient(60rem 18rem at 50% -4rem, var(--sky), transparent 70%) no-repeat;
	}

	/* Over a photo (app.css) the photo is the sky: no painted one. The top of
	   a photo is its brightest part, so the page colour is laid over it under
	   the header and fades out 18rem down, about where the search page's box
	   ends. That carries the search page's title on clouds and on blue. */
	:global(:root[data-bg]) main {
		background: linear-gradient(color-mix(in srgb, var(--bg) 50%, transparent), transparent) top / 100%
			18rem no-repeat;
	}
</style>
