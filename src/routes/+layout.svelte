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
	   edges of the window, so each page sets its own. */
	main {
		flex: 1;
		padding-bottom: 3rem;
	}
</style>
