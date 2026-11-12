<!-- The top bar, set like the head of a dictionary page: the four pages as
     tabs on the left, the name in the middle, and on the right the link to
     support Ukraine, quick search and settings. A ribbon in the flag's colours closes it. It
     stays at the top of the window while the page scrolls. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import logoIcon from '#lib/assets/logo-icon.svg';
	import { messagesFor } from '#lib/i18n.ts';
	import { useQuickSearch } from '#lib/quick-search.svelte.ts';
	import { plan } from '#lib/review/cards.ts';
	import { keyOfDay, reviewStats } from '#lib/review/days.ts';
	import { dayNumber } from '#lib/review/fsrs.ts';
	import { SAVED_DECK } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
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

	// The ribbon under the bar is drawn by the current page's tab. A page that is
	// none of the four (/support, /sources, /report, an error) has no such tab, and the
	// bar then draws the ribbon itself, unbroken.
	let onATab = $derived(links.some((link) => current(link.href)));

	const quick = useQuickSearch();

	// How many flashcards are due, on the button that leads to them. Counted
	// from what this browser holds, with no request to the account; and for a
	// visitor who has never reviewed a card, with no request at all.
	const review = useReview();
	const saved = useSaved();
	onMount(() => review.peek());
	$effect(() => {
		if (review.cards.size) review.fetchDecks(review.settings.decks);
	});
	let due = $derived.by(() => {
		if (!review.cards.size || !saved.ready) return 0;
		const words = review.settings.decks.flatMap((deck) =>
			deck === SAVED_DECK ? saved.items.map((item) => item.word) : (review.common.get(deck) ?? []));
		// New words are not counted: they wait for the visitor, nothing is lost by leaving them.
		const today = plan(review.cards, words, 0, Date.now());
		return today.learning.length + today.due.length;
	});

	// The streak, in a flame on the same button. The flame burns once a card
	// has been reviewed today; until then it is an outline, the streak still
	// standing but not yet kept.
	let streak = $derived.by(() => {
		const today = dayNumber(Date.now());
		return { days: reviewStats(review.days, today).streak, lit: (review.days[keyOfDay(today)] ?? 0) > 0 };
	});
	let cardsLabel = $derived(
		[
			due ? m.review.openDue(due) : m.review.open,
			...(streak.days ? [m.review.streakDays(streak.days)] : []),
			...(streak.days && !streak.lit ? [m.review.streakWaits] : [])
		].join('. '));

	// The search page has its own box right under the header: a second field
	// beside it only repeats it. The button is hidden there but keeps its
	// place, so the rest of the bar stands still from one page to the next.
	// Ctrl+K still opens the quick search there.
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
			<button
				type="button"
				class="search"
				class:away={onSearchPage}
				aria-label={m.quick.open}
				onclick={() => (quick.open = true)}
			>
				<Icon name="search" size={18} />
				<span class="label">{m.home.placeholder}</span>
				<kbd class="ui-kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
			</button>
			<a
				class="ui-icon-btn cards"
				href="/review"
				aria-current={current('/review') ? 'page' : undefined}
				aria-label={cardsLabel}
				title={cardsLabel}
			>
				<Icon name="cards" size={20} />
				{#if due}<span class="count" aria-hidden="true">{due > 99 ? '99+' : due}</span>{/if}
				{#if streak.days}
					<!-- Two shapes: the flame, red at the tip and amber below, and a
					     bright heart low in it for the number to stand on -->
					<svg class="flame" class:lit={streak.lit} viewBox="0 0 24 24" aria-hidden="true">
						<defs>
							<linearGradient id="ui-flame-body" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" style="stop-color: var(--flame-tip)" />
								<stop offset="70%" style="stop-color: var(--flame)" />
							</linearGradient>
						</defs>
						<path
							class="body"
							fill="url(#ui-flame-body)"
							d="M13 1c.6 3.2 3 4.9 4.7 7.2 1.4 1.9 2.3 4 2.3 6.3A8 8 0 0 1 4 14.5c0-2.6 1.1-4.9 2.7-6.6.3 1.6 1 2.7 2.2 3.3C8.6 7.6 10 3.6 13 1z"
						/>
						<path class="core" d="M12 9c3 2 5.5 4 5.5 7a5.5 5.5 0 0 1-11 0c0-3 2.5-5 5.5-7z" />
						<text x="12" y="19" text-anchor="middle" class:long={streak.days > 99}>
							{Math.min(streak.days, 999)}
						</text>
					</svg>
				{/if}
			</a>
			<SettingsMenu />
		</div>
	</div>
</header>

<QuickSearch />

<style>
	/* Under the bar runs a ribbon in the flag's colours, wound round a pole
	   like the stripes of a barber's: blue and yellow turn about, at 45
	   degrees. It was a plain rule in the text colour until 2026-11-12.

	   Whole pixels thick. At 2.5px it was three screen pixels on a page with
	   no tab and two and a half beside a tab: the mask (below) draws the half,
	   and a box without one is drawn to the nearest whole.

	   The colours are the flag's own, the same in both themes, as in the
	   heart beside "Support Ukraine".

	   It is painted in two layers. The first is a little light along the top
	   and shade along the bottom, fitted to the strip: enough to round it, and
	   the colours stay nearly as flat as the flag's. The second is the
	   stripes, and they are fixed to the window, not to whatever draws them:
	   the ribbon is drawn by the current tab, and stripes that started from
	   the tab would shift from page to page. One blue and one yellow stripe
	   take 28px of the ribbon's length, 19.8px along a line at 45 degrees, so
	   a tile 28px square repeats without a seam. (iOS Safari does not fix a
	   background to the window; there the stripes start from the tab.) */
	header {
		--ribbon-height: 3px;
		--flag-blue: #005bbb;
		--flag-yellow: #ffd500;
		--ribbon:
			linear-gradient(rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 50%, rgb(0 0 0 / 0.12)) 0 0 / 100% 100%
				no-repeat,
			repeating-linear-gradient(
					135deg,
					var(--flag-blue) 0 9.65px,
					var(--flag-yellow) 9.9px 19.55px,
					var(--flag-blue) 19.8px
				)
				0 0 / 28px 28px repeat fixed;
		position: sticky;
		top: 0;
		z-index: 30;
		/* Room for the ribbon. The current tab draws it (below); the bar
		   draws it only on a page that has no tab. */
		border-bottom: var(--ribbon-height) solid transparent;
		background: var(--frame);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		/* The ribbon runs a window's width each way from the tab; cut it at the
		   window's edges. `clip` only: `hidden` would cut the tab's foot too. */
		overflow-x: clip;
	}

	/* A page with no tab: the bar lays the ribbon over its own bottom border */
	header.ruled::after {
		content: '';
		position: absolute;
		inset: 100% 0 auto;
		height: var(--ribbon-height);
		background: var(--ribbon);
		pointer-events: none;
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

	/* The pages are tabs standing on the ribbon, like the thumb index cut into
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

	/* The page you are on: an outlined tab that reaches down through the
	   ribbon and is open to the page under it. The padding keeps its word
	   level with the others. */
	nav a[aria-current='page'] {
		height: calc(2.5rem + var(--ribbon-height));
		margin-bottom: calc(-1 * var(--ribbon-height));
		padding-bottom: var(--ribbon-height);
		border-color: var(--border-strong);
		color: var(--ink);
	}

	/* The ribbon, in two pieces that stop at the tab's sides: a strip a
	   window's width each way from the tab, and a mask that keeps the two
	   pieces beside the tab and leaves the tab's own width open. It is cut
	   open, not painted over under the tab: the bar is see-through, and over
	   a background photo there is no one colour to paint with. */
	nav a[aria-current='page']::before {
		--beside:
			linear-gradient(#000, #000) left / 100vw 100% no-repeat,
			linear-gradient(#000, #000) right / 100vw 100% no-repeat;
		content: '';
		position: absolute;
		right: calc(-100vw - 1px);
		bottom: 0;
		left: calc(-100vw - 1px);
		height: var(--ribbon-height);
		background: var(--ribbon);
		-webkit-mask: var(--beside);
		mask: var(--beside);
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

	/* The way to the flashcards, with how many are due on its corner */
	.cards {
		position: relative;
	}

	.cards[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent);
	}

	/* The streak: a flame on the upper left corner with the days written in it.
	   The count of cards due has the upper right. */
	.flame {
		position: absolute;
		top: -0.9rem;
		left: -0.8rem;
		width: 1.75rem;
		height: 1.75rem;
		overflow: visible;
		pointer-events: none;
	}

	/* Not yet kept today: the same flame, gone grey */
	.flame:not(.lit) .body {
		fill: var(--surface-2);
		stroke: var(--muted);
		stroke-width: 1.2;
		stroke-linejoin: round;
	}

	.flame:not(.lit) .core {
		fill: var(--surface);
	}

	.flame text {
		fill: var(--muted);
		font-family: var(--font-text);
		font-size: 8.5px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.flame text.long {
		font-size: 6px;
	}

	/* Lit: a card has been reviewed today. It glows, and it flickers: the
	   body sways from its foot while the heart beats a little out of step. */
	.flame.lit {
		filter: drop-shadow(0 0 3px color-mix(in oklab, var(--flame) 70%, transparent));
	}

	.flame.lit .body {
		stroke: none;
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: flame-sway 1.7s ease-in-out infinite alternate;
	}

	.flame.lit .core {
		fill: var(--flame-core);
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: flame-beat 1.1s ease-in-out infinite alternate;
	}

	.flame.lit text {
		fill: var(--flame-ink);
	}

	@keyframes flame-sway {
		from {
			transform: scale(1, 0.96) skewX(-2.5deg);
		}

		50% {
			transform: scale(0.97, 1.04) skewX(1.5deg);
		}

		to {
			transform: scale(1.02, 0.98) skewX(3deg);
		}
	}

	@keyframes flame-beat {
		from {
			transform: scale(0.94, 0.96);
		}

		to {
			transform: scale(1.04, 1.05);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flame.lit .body,
		.flame.lit .core {
			animation: none;
		}
	}

	.count {
		position: absolute;
		top: -0.15rem;
		right: -0.3rem;
		min-width: 1.1rem;
		padding: 0 0.3rem;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1.1rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
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

	/* On the search page: not shown, not reachable by Tab and not read out,
	   but still as wide, so nothing beside it moves */
	.search.away {
		visibility: hidden;
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
			height: calc(2.75rem + var(--ribbon-height));
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
