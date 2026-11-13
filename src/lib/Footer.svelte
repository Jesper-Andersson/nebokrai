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

	// The invite to the community's Discord server. It has to be one that never
	// expires, or the button leads to "Invite invalid" a week later.
	const DISCORD = 'https://discord.gg/KFankcC5Tc';

	// Only what the header does not already link to: the pages about the site,
	// and the whole dictionary by letter, which from every page is also how a
	// search engine comes to the word pages. The pages for learning are under
	// the header's Learn tab, and the site's own source, which its licence
	// asks every copy to offer, is linked from About and from Sources.
	// After them comes the one way out of the site: the community's Discord.
	const links = $derived([
		{ href: '/about', label: m.footer.about },
		{ href: '/words', label: m.footer.words },
		{ href: '/sources', label: m.footer.sources },
		{ href: '/privacy', label: m.footer.privacy },
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
			<a class="ui-btn discord" href={DISCORD} rel="noopener">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="currentColor"
						d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
					/>
				</svg>
				{m.footer.discord}
			</a>
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

	/* The top edge: a plain hairline in the grey of every other border */
	footer::before {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 1px;
		background: var(--border);
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
		align-items: center;
		gap: 0 1.5rem;
	}

	/* Padding for a taller tap area */
	nav a:not(.discord) {
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
		nav a:not(.discord):hover {
			color: var(--ink);
			text-decoration: underline;
			text-decoration-thickness: 2px;
			text-decoration-color: var(--gold);
			text-underline-offset: 4px;
		}
	}

	nav a:not(.discord):focus-visible {
		border-radius: var(--radius-sm);
	}

	/* The way out to the community: the one link here that leaves the site, so
	   it is a button and not one more word in the row. Smaller than a button
	   in a form, to sit on the links' line. */
	.discord {
		padding: 0.3rem 0.7rem;
		color: var(--ink-2);
		text-decoration: none;
	}

	.discord svg {
		flex: none;
		width: 1rem;
		height: 1rem;
	}

	@media (hover: hover) {
		.discord:hover {
			color: var(--ink);
		}
	}

	@media (pointer: coarse) {
		nav a:not(.discord) {
			padding-block: 0.6rem;
		}

		.discord {
			margin-block: 0.3rem;
			padding-block: 0.55rem;
		}
	}
</style>
