<!-- The top bar: logo, the four pages, quick search, the link to support
     Ukraine and settings. It stays at
     the top of the window while the page scrolls. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import logoIcon from '#lib/assets/logo-icon.svg';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';
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

	// United24 is the Ukrainian state's own fundraising platform.
	const SUPPORT_URL = 'https://u24.gov.ua/';

	let searchOpen = $state(false);

	// The search page has its own box right under the header: a second field
	// beside it only repeats it. Ctrl+K still opens the quick search there.
	let onSearchPage = $derived(page.url.pathname === '/');

	// Known only in the browser; the server always renders "Ctrl K".
	let mac = $state(false);
	onMount(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform);
	});
</script>

<header>
	<div class="inner">
		<a class="logo" href="/">
			<!-- The same drawing as the site's icon; the wordmark beside it carries the name -->
			<img src={logoIcon} alt="" />
			<Logo script={settings.lang === 'uk' ? 'uk' : 'en'} />
		</a>
		<nav aria-label={m.nav.label}>
			{#each links as link (link.href)}
				<a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>{link.label}</a>
			{/each}
		</nav>
		<div class="tools">
			{#if !onSearchPage}
				<button type="button" class="search" aria-label={m.quick.open} onclick={() => (searchOpen = true)}>
					<Icon name="search" size={18} />
					<span class="label">{m.home.placeholder}</span>
					<kbd class="ui-kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
				</button>
			{/if}
			<a class="support" href={SUPPORT_URL} rel="noopener" aria-label={m.support.label} title={m.support.hint}>
				<!-- A heart in the flag's two colours, the same blue and yellow as the
				     logo. The yellow half all but vanishes on a white button, so the
				     heart is outlined, in a darker amber under the blue. -->
				<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
					<defs>
						<linearGradient id="ui-flag-heart" x1="0" y1="0" x2="0" y2="1">
							<stop offset="50%" stop-color="#005bbb" />
							<stop offset="50%" stop-color="#ffd500" />
						</linearGradient>
						<linearGradient id="ui-flag-heart-line" x1="0" y1="0" x2="0" y2="1">
							<stop offset="50%" stop-color="#005bbb" />
							<stop offset="50%" stop-color="#b88a00" />
						</linearGradient>
					</defs>
					<path
						fill="url(#ui-flag-heart)"
						stroke="url(#ui-flag-heart-line)"
						stroke-width="1.5"
						stroke-linejoin="round"
						d="M12 20.5 4.6 13.1a4.9 4.9 0 0 1 6.9-6.9l.5.5.5-.5a4.9 4.9 0 0 1 6.9 6.9z"
					/>
				</svg>
				<span class="label">{m.support.label}</span>
			</a>
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
		background: var(--frame);
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
		/* The wordmark's box has a little air on its left already */
		gap: 0.25rem;
	}

	/* The icon is sized to the wordmark's capitals and lifted to stand with
	   them: the wordmark's box keeps room under the baseline for descenders,
	   so its letters sit above the middle of it. */
	.logo img {
		position: relative;
		top: -0.19rem;
		width: 1.75rem;
		height: 1.75rem;
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
	.search:focus-visible,
	.support:focus-visible {
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

	/* The way out to United24. Framed like the search field beside it and on
	   the tools' side of the bar, so it does not read as a fifth page. */
	.support {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		box-sizing: border-box;
		height: 2.25rem;
		padding: 0 0.8rem 0 0.65rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.support svg {
		flex: none;
	}

	@media (hover: hover) {
		.support:hover {
			border-color: var(--border-strong);
		}
	}

	/* Narrow windows: the search field shrinks to its icon. In Ukrainian the
	   whole bar needs 1040px, "Підтримати Україну" being the longer label. */
	@media (max-width: 1080px) {
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

	/* Narrower still: the support link keeps only its heart */
	@media (max-width: 880px) {
		.support {
			width: 2.25rem;
			padding: 0;
		}

		.support .label {
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

		.search,
		.support {
			width: 2.75rem;
			height: 2.75rem;
		}
	}
</style>
