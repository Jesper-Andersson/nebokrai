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
	import { weekProgress } from '#lib/review/days.ts';
	import { dayNumber } from '#lib/review/fsrs.ts';
	import { COMMON_DECKS, reviewWords } from '#lib/review/decks.ts';
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
		{ href: '/learn', label: m.nav.learn },
		{ href: '/resources', label: m.nav.resources },
		{ href: '/saved', label: m.nav.saved }
	]);

	// The pages /learn leads to. They stay under its tab, so the way back to
	// the others is one press away; /common-words/2 is one of them too.
	// The flashcards are among them (2026-11-13): /learn sends a newcomer
	// there, who then looked in vain for the way back.
	const LEARN = ['/alphabet', '/common-words', '/grammar', '/practice', '/review'];
	const within = (path: string) => page.url.pathname === path || page.url.pathname.startsWith(path + '/');

	// A word's page belongs to the dictionary.
	const current = (href: string) =>
		page.url.pathname === href ||
		(href === '/' && page.url.pathname.startsWith('/word/')) ||
		(href === '/learn' && LEARN.some(within));

	// The ribbon under the bar is drawn by the current page's tab. A page that is
	// none of the four (/support, /about, /sources, an error) has no such tab, and the
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
		// Every deck not paused: a word begun in a deck no longer ticked still comes back
		if (review.cards.size) {
			review.fetchDecks(COMMON_DECKS.map((deck) => deck.id as string).filter((id) => !review.settings.paused.includes(id)));
		}
	});
	let due = $derived.by(() => {
		if (!review.cards.size || !saved.ready) return 0;
		const savedWords = saved.items.map((item) => item.word);
		const words = reviewWords(review.settings, savedWords, saved.lists, review.common);
		// New words are not counted: they wait for the visitor, nothing is lost by leaving them.
		const today = plan(review.cards, words, 0, Date.now());
		return today.learning.length + today.due.length;
	});

	// The weekly goal on the same button, as /learn's ring draws it: days
	// practised this week against the goal ("3/4"). It replaced a streak of
	// days in a row (2026-11-15), whose flame asked to be kept alive. Without
	// a goal there is nothing to count against, and nothing is shown.
	let goal = $derived.by(() => {
		const days = review.settings.goal_days;
		if (!days) return null;
		const done = weekProgress(review.days, dayNumber(Date.now())).week;
		return { days, done, met: done >= days };
	});
	// The small ring: r = 7.5 in a 20-unit box
	const ROUND = 2 * Math.PI * 7.5;
	let cardsLabel = $derived(
		[due ? m.review.openDue(due) : m.review.open, ...(goal ? [m.review.goal.week(goal.done, goal.days)] : [])]
			.join('. '));

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
				<span class="support-label">{m.support.label}</span>
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
				{#if due}<span class="count" aria-hidden="true">{due > 99 ? '99+' : due}</span>{/if}
				<Icon name="cards" size={20} />
				{#if goal}
					<span class="goal" class:met={goal.met} aria-hidden="true">
						<svg class="ring" viewBox="0 0 20 20">
							<circle class="track" cx="10" cy="10" r="7.5" />
							{#if !goal.met && goal.done}
								<circle
									class="fill"
									cx="10"
									cy="10"
									r="7.5"
									stroke-dasharray="{(goal.done / goal.days) * ROUND} {ROUND}"
									transform="rotate(-90 10 10)"
								/>
							{/if}
						</svg>
						{goal.done}/{goal.days}
					</span>
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
		--ribbon-shade: linear-gradient(rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 50%, rgb(0 0 0 / 0.12));
		--ribbon-stripes: repeating-linear-gradient(
			135deg,
			var(--flag-blue) 0 9.65px,
			var(--flag-yellow) 9.9px 19.55px,
			var(--flag-blue) 19.8px
		);
		--ribbon:
			var(--ribbon-shade) 0 0 / 100% 100% no-repeat,
			var(--ribbon-stripes) 0 0 / 28px 28px repeat fixed;
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

	/* A short piece of the same ribbon along the tab's top edge. It was a
	   plain gold line until 2026-11-13. Its stripes are its own, not fixed to
	   the window: fixed, the piece was cut wherever the tab happened to stand
	   and could end in a sliver of yellow.

	   It holds whole stripes only, and is blue at both ends. A pair of
	   stripes is 28px of the ribbon's length, so the piece is as many pairs
	   as fit over the tab's word and one blue stripe more, centred. It stops
	   4px short of that stripe's end: the stripes slant, and a square end
	   any further on would take the corner off the next yellow one. (Ends
	   cut on the slant were tried and looked like a pair of stray strokes.
	   Stretching the stripes to fit with `background-repeat: round` left
	   seams: the browser draws them again at the new size. Where `round()`
	   is not known the piece is as wide as the word and may end part-way
	   through a stripe.) */
	nav a[aria-current='page']::after {
		content: '';
		position: absolute;
		top: -1px;
		left: 50%;
		width: calc(100% - 1.4rem);
		width: calc(round(down, 100% - 1.4rem - 10px, 28px) + 10px);
		height: var(--ribbon-height);
		border-radius: 2px;
		translate: -50% 0;
		background:
			var(--ribbon-shade) 0 0 / 100% 100% no-repeat,
			var(--ribbon-stripes) 0 0 / 28px 28px repeat;
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

	/* The way to the flashcards, and what waits there, read in a row: how
	   many are due, the cards, then the week against the goal (until
	   2026-11-15, the days of a streak and its flame). Until
	   2026-11-13 the count sat on the button's upper left corner and the flame,
	   with the days written in it, on its upper right: two marks piled on one
	   small icon, the flame hanging over the edge of the bar. Side by side
	   each can be read, and the button is as wide as what it has to say: with
	   nothing due and no goal it is the square it was. */
	.cards {
		gap: 0.3rem;
		width: auto;
		min-width: 2.25rem;
		padding: 0 0.5rem;
		font-size: var(--text-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.cards[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent);
	}

	/* How many are due: a figure in the links' colour, not a badge */
	.count {
		color: var(--accent);
	}

	/* The week against the goal, a little apart from the count: a small ring
	   and "3/4". Met, the ring is whole and green. */
	.goal {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		margin-left: 0.3rem;
		color: var(--ink);
	}

	.ring {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke-width: 3;
	}

	.track {
		stroke: var(--border);
	}

	.fill {
		stroke: var(--accent);
	}

	.goal.met .track {
		stroke: var(--right);
	}

	@media (pointer: coarse) {
		.cards {
			min-width: 2.75rem;
		}
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
	   Ukrainian tabs, НАВЧАННЯ and ЗБЕРЕЖЕНЕ among them, need nearly 400px
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

	/* Phones. The bar is two lines: the mark, "Support Ukraine" and the tools,
	   then the tabs. Until 2026-11-15 the link had a slim line of its own
	   above the name, and the bar took 116px of every screen; it takes 84px
	   now. The tools' box dissolves to let the link out, to stand beside the
	   name. The tabs share the width, a little lower than on a desktop. */
	@media (max-width: 740px) {
		.inner {
			padding: 0 0.6rem;
		}

		.tools {
			display: contents;
		}

		.logo {
			flex: none;
			height: 2.75rem;
			margin-right: 0.35rem;
		}

		/* The words stay (user, 2026-11-14, taking back the heart alone of
		   #33). The link pushes the tools to the right edge, and is what gives
		   way before they wrap: with a phone's text set larger, the deck count
		   and the weekly goal once left no room for the settings button, and
		   it fell to a line of its own (2026-11-14). A basis of 0 keeps the
		   line from wrapping: the link takes what room is left, and its words
		   end in an ellipsis when that is too little, which is better than a
		   third line. */
		.support {
			flex: 1 1 0;
			justify-content: flex-start;
			min-width: 0;
			height: 2.75rem;
			padding: 0;
			font-size: var(--text-xs);
		}

		.support-label {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
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
			height: 2.3rem;
			padding: 0 0.3rem;
			font-size: clamp(0.6rem, 2.9vw, var(--text-xs));
		}

		nav a[aria-current='page'] {
			height: calc(2.3rem + var(--ribbon-height));
		}

		/* The tabs share the bar's width here and their words stand in the
		   middle: the piece keeps 0.5rem from each side, in whole stripes */
		nav a[aria-current='page']::after {
			width: calc(100% - 1rem);
			width: calc(round(down, 100% - 1rem - 10px, 28px) + 10px);
		}

		.search {
			width: 2.75rem;
			height: 2.75rem;
		}

		/* The tools stand against the right edge here, and the search button
		   is the leftmost of them: taking it away moves nothing, and gives its
		   width back to the name */
		.search.away {
			display: none;
		}
	}

	/* A narrow phone has no room for the name and «Підтримати Україну» on one
	   line (the two and three tools need about 480px), so the mark stands
	   alone for the name; the footer and the page's title still spell it. The
	   wordmark is cut to nothing, not removed, so the link home keeps its
	   name for a screen reader. The tools stand closer together. */
	@media (max-width: 520px) {
		.inner {
			column-gap: 0.15rem;
		}

		/* Not in a practice round (below): the link is away there, and the
		   name has the line to itself as before */
		:global(html:not([data-practising])) .logo img {
			top: 0;
		}

		:global(html:not([data-practising])) .logo :global(svg) {
			position: absolute;
			width: 1px;
			height: 1px;
			clip-path: inset(50%);
		}
	}

	/* A practice round on a phone (PracticeRound.svelte marks the page while
	   it runs): the "Support Ukraine" line and the tabs step aside so the
	   sentence and the answers fit on the screen, and come back when the round
	   stops. The ribbon closes the bar as on a page with no tab. */
	@media (max-width: 600px) {
		:global(html[data-practising]) .support,
		:global(html[data-practising]) nav {
			display: none;
		}

		:global(html[data-practising]) header::after {
			content: '';
			position: absolute;
			inset: 100% 0 auto;
			height: var(--ribbon-height);
			background: var(--ribbon);
			pointer-events: none;
		}
	}

</style>
