<!-- The frame every page is drawn in: the header, the page, the footer, and the
     corner messages. It also provides what the pages share through context:
     the settings, the saved words and the toaster. -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Tooltip } from 'bits-ui';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/Header.svelte';
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
	let m = $derived(messagesFor(settings.lang));

	// Saved words: read from this browser once the page is running, and synced
	// with the account when signed in (see saved.svelte.ts).
	// svelte-ignore state_referenced_locally
	const saved = provideSaved(data.user?.id ?? null);
	onMount(() => void saved.load());

	provideToasts();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Nebokrai</title>
</svelte:head>

<Tooltip.Provider delayDuration={350}>
	<div class="frame">
		<Header />

		<main>
			{@render children()}
		</main>

		<footer>
			<div class="inner">
				<p>
					© 2026 Jesper Andersson · {m.footer.data} ·
					<a href="/sources">{m.footer.sources}</a>
				</p>
				<a href="/report">{m.footer.report}</a>
			</div>
		</footer>
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

	/* Frosted like the header, so its small text reads over a background photo */
	footer {
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		color: var(--muted);
		font-size: 0.85rem;
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem 1.5rem;
		box-sizing: border-box;
		max-width: 72rem;
		margin: 0 auto;
		padding: 0.9rem 1rem;
	}

	p {
		margin: 0;
	}

	/* Padding for a taller tap area */
	a {
		padding-block: 0.4rem;
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 3px;
	}

	a:hover {
		color: var(--ink);
	}
</style>
