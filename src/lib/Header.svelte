<!-- The top bar, set like the head of a dictionary page: the four pages as
     tabs on the left, the name in the middle, and on the right the link to
     support Ukraine, quick search and settings. A thick rule closes it. It
     stays at the top of the window while the page scrolls. -->
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

	// The rule under the bar is drawn by the current page's tab. A page that is
	// none of the four (/support, /sources, /report, an error) has no such tab, and the
	// bar then draws the rule itself, unbroken.
	let onATab = $derived(links.some((link) => current(link.href)));

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

<header class:ruled={!onATab}>
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
			<a
				class="support"
				href="/support"
				aria-current={current('/support') ? 'page' : undefined}
				title={m.support.hint}
			>
				<!-- A heart in the flag's two colours, the same blue and yellow as the
				     logo. The yellow half all but vanishes on the light bar, so the
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
				{m.support.label}
			</a>
			<!-- A hairline between the link to the funds and the site's own tools -->
			<span class="divider"></span>
			{#if !onSearchPage}
				<button type="button" class="search" aria-label={m.quick.open} onclick={() => (searchOpen = true)}>
					<Icon name="search" size={18} />
					<span class="label">{m.home.placeholder}</span>
					<kbd class="ui-kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
				</button>
			{/if}
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
		/* Room for the thick rule. The current tab draws it (below); the bar
		   draws it only on a page that has no tab. */
		border-bottom: 2px solid transparent;
		background: var(--frame);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		/* The rule runs a window's width each way from the tab; cut it at the
		   window's edges. `clip` only: `hidden` would cut the tab's foot too. */
		overflow-x: clip;
	}

	header.ruled {
		border-bottom-color: var(--ink);
	}

	/* Pages, name, tools. The outer two share what the name leaves, so the
	   name stands in the middle of the bar; each is at least as wide as what
	   it holds, and the name then gives way before anything is cut. */
	.inner {
		display: grid;
		grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
		align-items: center;
		gap: 0.5rem;
		box-sizing: border-box;
		max-width: var(--frame-width);
		height: 3.5rem;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.logo {
		display: flex;
		grid-row: 1;
		grid-column: 2;
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
		grid-row: 1;
		grid-column: 1;
		align-items: flex-end;
		align-self: end;
		justify-self: start;
		gap: 2px;
	}

	/* The pages are tabs standing on the rule, like the thumb index cut into
	   the edge of a printed dictionary, and lettered like the names of an
	   entry's parts (ui-label). */
	nav a {
		position: relative;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		height: 2.5rem;
		padding: 0 0.7rem;
		border: 1px solid transparent;
		border-bottom: 0;
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	/* The page you are on: an outlined tab that reaches down through the rule
	   and is open to the page under it. The padding keeps its word level
	   with the others. */
	nav a[aria-current='page'] {
		height: calc(2.5rem + 2px);
		margin-bottom: -2px;
		padding-bottom: 2px;
		border-color: var(--border-strong);
		color: var(--ink);
	}

	/* The rule, in two pieces that stop at the tab's sides. It is drawn, not
	   a border painted over under the tab: the bar is see-through, and over a
	   background photo there is no one colour to paint with. */
	nav a[aria-current='page']::before {
		content: '';
		position: absolute;
		right: calc(-100vw - 1px);
		bottom: 0;
		left: calc(-100vw - 1px);
		height: 2px;
		background:
			linear-gradient(var(--ink), var(--ink)) left / 100vw 100% no-repeat,
			linear-gradient(var(--ink), var(--ink)) right / 100vw 100% no-repeat;
		pointer-events: none;
	}

	/* A gold line along the tab's top edge: the horizon the site is named after */
	nav a[aria-current='page']::after {
		content: '';
		position: absolute;
		inset: -1px 0.7rem auto;
		height: 2px;
		border-radius: 2px;
		background: var(--gold);
	}

	@media (hover: hover) {
		nav a:not([aria-current]):hover {
			background: var(--surface-2);
			color: var(--ink);
		}
	}

	nav a:focus-visible,
	.logo:focus-visible,
	.search:focus-visible,
	.support:focus-visible {
		/* Inside the edge: the sticky header would cut a ring outside it */
		outline-offset: -2px;
	}

	.logo:focus-visible,
	.support:focus-visible {
		border-radius: var(--radius-md);
	}

	.tools {
		display: flex;
		grid-row: 1;
		grid-column: 3;
		align-items: center;
		justify-self: end;
		gap: 0.35rem;
	}

	/* The way to /support, the funds to donate to. No frame: a box here was
	   the heaviest thing in the bar. It keeps its words at every width; a
	   heart alone does not say where it leads. */
	.support {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		box-sizing: border-box;
		height: 2.25rem;
		padding: 0 0.5rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	.support svg {
		flex: none;
	}

	/* On its own page it takes the ink of a current tab */
	.support[aria-current='page'] {
		color: var(--ink);
	}

	@media (hover: hover) {
		.support:hover {
			color: var(--ink);
		}
	}

	.divider {
		flex: none;
		width: 1px;
		height: 1.25rem;
		margin: 0 0.3rem;
		background: var(--border);
	}

	/* A button that looks like a search field and opens the quick search */
	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		box-sizing: border-box;
		/* As wide as "Шукати слово…" and the key beside it need, and no wider:
		   the Ukrainian tools then just fit their third of the bar */
		width: 13rem;
		height: 2.25rem;
		padding: 0 0.5rem 0 0.65rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--surface-2);
		color: var(--muted);
		font-size: var(--text-sm);
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
			color: var(--ink);
		}
	}

	/* Three groups in one line are a tight fit: the search field shrinks to
	   its icon as soon as the window is narrower than the full bar. */
	@media (max-width: 1120px) {
		.search {
			justify-content: center;
			width: 2.25rem;
			padding: 0;
			background: none;
		}

		.search .label,
		.search .ui-kbd {
			display: none;
		}
	}

	/* Narrower, and the name could no longer stand in the middle: the
	   Ukrainian tabs, ЗБЕРЕЖЕНЕ and ПРО ПРОЄКТ among them, need about 400px
	   on its left. Name and tools take the first line, the tabs the second. */
	@media (max-width: 1000px) {
		.inner {
			display: flex;
			flex-wrap: wrap;
			gap: 0 0.5rem;
			height: auto;
		}

		.logo {
			height: 3rem;
		}

		.tools {
			margin-left: auto;
		}

		nav {
			order: 1;
			flex: 0 0 100%;
		}
	}

	/* Phones. The name's line has no room for "Підтримати Україну", and the
	   words must stay, so the link takes a slim line of its own above the
	   name. The tools' box dissolves to let it out. The tabs share the width. */
	@media (max-width: 740px) {
		.inner {
			padding: 0 0.6rem;
		}

		.tools {
			display: contents;
		}

		.logo {
			margin-right: auto;
		}

		.support {
			order: -1;
			flex: 0 0 100%;
			height: 2rem;
			padding: 0;
			border-bottom: 1px solid var(--border);
			font-size: var(--text-xs);
		}

		.support svg {
			width: 15px;
			height: 15px;
		}

		.divider {
			display: none;
		}

		nav a {
			flex: 1 0 auto;
			justify-content: center;
			height: 2.75rem;
			padding: 0 0.3rem;
			font-size: clamp(0.6rem, 2.9vw, var(--text-xs));
		}

		nav a[aria-current='page'] {
			height: calc(2.75rem + 2px);
			padding-bottom: 2px;
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
