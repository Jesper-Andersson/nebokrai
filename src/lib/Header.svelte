<!-- The top bar: logo, the four pages, quick search and settings. It stays at
     the top of the window while the page scrolls. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import uaFlag from '#lib/assets/flag-ukraine.svg';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import QuickSearch from './QuickSearch.svelte';
	import SettingsMenu from './SettingsMenu.svelte';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const links = $derived([
		{ href: '/', label: m.nav.dictionary },
		{ href: '/resources', label: m.nav.resources },
		{ href: '/saved', label: m.nav.saved },
		{ href: '/about', label: m.nav.about }
	]);

	// A word's page belongs to the dictionary.
	const current = (href: string) =>
		page.url.pathname === href || (href === '/' && page.url.pathname.startsWith('/word/'));

	let searchOpen = $state(false);

	// Known only in the browser; the server always renders "Ctrl K".
	let mac = $state(false);
	onMount(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform);
	});
</script>

<header>
	<div class="inner">
		<a class="logo" href="/">
			<img src={uaFlag} alt="" />
			Nebokrai
		</a>
		<nav aria-label={m.nav.label}>
			{#each links as link (link.href)}
				<a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>{link.label}</a>
			{/each}
		</nav>
		<div class="tools">
			<button type="button" class="search" aria-label={m.quick.open} onclick={() => (searchOpen = true)}>
				<Icon name="search" size={18} />
				<span class="label">{m.home.placeholder}</span>
				<kbd class="ui-kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
			</button>
			<SettingsMenu />
		</div>
	</div>
</header>

<QuickSearch bind:open={searchOpen} />

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 30;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}

	.inner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		box-sizing: border-box;
		max-width: 72rem;
		height: 3.5rem;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--ink);
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 800;
	}

	.logo img {
		height: 1.05em;
		border-radius: 3px;
	}

	nav {
		display: flex;
		align-self: stretch;
		margin-left: 1rem;
	}

	/* The page you are on sits on a gold line: the horizon the site is named after */
	nav a {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0 0.75rem;
		color: var(--muted);
		font-size: 0.95rem;
		font-weight: 600;
		white-space: nowrap;
	}

	nav a[aria-current='page'] {
		color: var(--ink);
	}

	nav a[aria-current='page']::after {
		content: '';
		position: absolute;
		inset: auto 0.75rem -1px;
		height: 2px;
		border-radius: 2px;
		background: var(--gold);
	}

	@media (hover: hover) {
		nav a:hover {
			color: var(--ink);
		}
	}

	nav a:focus-visible,
	.logo:focus-visible,
	.search:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 8px;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
	}

	/* A button that looks like a search field and opens the quick search */
	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 15rem;
		height: 2.25rem;
		padding: 0 0.5rem 0 0.65rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.search .label {
		flex: 1;
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (hover: hover) {
		.search:hover {
			border-color: var(--border-strong);
		}
	}

	/* Narrow windows: the search field shrinks to its icon */
	@media (max-width: 980px) {
		.search {
			justify-content: center;
			width: 2.25rem;
			padding: 0;
			border-color: transparent;
			background: none;
		}

		.search .label,
		.search .ui-kbd {
			display: none;
		}
	}

	/* Phones: logo and tools on the first line, the four pages across the second */
	@media (max-width: 740px) {
		.inner {
			flex-wrap: wrap;
			gap: 0 0.5rem;
			height: auto;
			padding: 0 0.6rem;
		}

		.logo {
			height: 3rem;
		}

		nav {
			order: 1;
			flex: 0 0 100%;
			margin: 0;
			overflow-x: auto;
			border-top: 1px solid var(--border);
			scrollbar-width: none;
		}

		nav a {
			flex: 1 0 auto;
			justify-content: center;
			height: 2.75rem;
			padding: 0 0.5rem;
			font-size: clamp(0.82rem, 3.7vw, 0.95rem);
		}

		nav a[aria-current='page']::after {
			inset-inline: 0.5rem;
		}

		.search {
			width: 2.75rem;
			height: 2.75rem;
		}
	}
</style>
