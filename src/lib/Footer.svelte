<!-- The foot of every page: the site's name as a dictionary entry of its own,
     the credit line, and the pages the header has no room for. Its top
     edge is the horizon the site is named after, sky over land. -->
<script lang="ts">
	import { page } from '$app/state';
	import { messagesFor } from '#lib/i18n.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import { useSettings } from '#lib/settings.ts';
	import Grammar from './Grammar.svelte';
	import Headword from './Headword.svelte';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// The dictionary has the word, so the name leads to its own page.
	const NAME = 'небокрай';
	const HEADWORD = 'небокра́й';

	// Only what the header does not already link to. The first two are the
	// ways into the dictionary without searching; from every page, they are
	// also how a search engine comes to the word pages.
	const links = $derived([
		{ href: '/common-words', label: m.footer.common },
		{ href: '/words', label: m.footer.words },
		{ href: '/sources', label: m.footer.sources },
		{ href: '/report', label: m.footer.report }
	]);

	// /words is the current page on /words/п too
	const current = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<footer>
	<div class="inner">
		<div>
			<p class="entry">
				<Headword text={HEADWORD} size="sm" href={wordPath(NAME)} />
				<Grammar pos="noun" inline />
				<span class="gloss">{m.footer.nameGloss}</span>
			</p>
			<p class="credit">© 2026 Jesper Andersson · {m.footer.data}</p>
		</div>

		<nav aria-label={m.footer.label}>
			{#each links as link (link.href)}
				<a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>{link.label}</a>
			{/each}
		</nav>
	</div>
</footer>

<style>
	/* Frosted like the header, so its small text reads over a background photo */
	footer {
		position: relative;
		background: var(--frame);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* The top edge is the header's hairline, and in the middle of it the gold
	   of the header's current page: the horizon, lit where the sun is */
	footer::before {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 1px;
		background: linear-gradient(90deg, var(--border) 20%, var(--gold) 50%, var(--border) 80%);
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem 2rem;
		box-sizing: border-box;
		max-width: var(--frame-width);
		margin: 0 auto;
		padding: 1rem 1rem 0.85rem;
	}

	p {
		margin: 0;
	}

	.entry {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.1rem 0.55rem;
	}

	.gloss {
		color: var(--ink-2);
		font-size: 1rem;
	}

	.credit {
		margin-top: 0.15rem;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.5rem;
	}

	/* Padding for a taller tap area */
	nav a {
		padding-block: 0.4rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	nav a[aria-current='page'] {
		color: var(--ink);
	}

	/* The gold line of the header's current page, here under whatever the
	   pointer is on */
	@media (hover: hover) {
		nav a:hover {
			color: var(--ink);
			text-decoration: underline;
			text-decoration-thickness: 2px;
			text-decoration-color: var(--gold);
			text-underline-offset: 4px;
		}
	}

	nav a:focus-visible {
		border-radius: var(--radius-sm);
	}

	@media (pointer: coarse) {
		nav a {
			padding-block: 0.6rem;
		}
	}
</style>
