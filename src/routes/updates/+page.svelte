<!-- What was added to the site and what changed, newest first, under a heading
     for each month. The entries are in src/lib/updates.ts. Opening this page
     is what clears the coloured "Updates" link in the footer. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import TextPage from '#lib/TextPage.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { applySetting, useSettings } from '#lib/settings.ts';
	import { byMonth, latestId, type Update } from '#lib/updates.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));
	let uk = $derived(settings.lang === 'uk');

	// UTC, so the server and the browser print the same day
	let monthName = $derived(
		new Intl.DateTimeFormat(uk ? 'uk' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
	);
	let dayName = $derived(new Intl.DateTimeFormat(uk ? 'uk' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }));

	// «листопад 2026 р.» begins a heading, so it takes a capital like the English
	const heading = (month: string) => {
		const name = monthName.format(new Date(`${month}-01`));
		return name.charAt(0).toUpperCase() + name.slice(1);
	};

	// A link is named after the page it leads to: /import is "Import words"
	// (tests/updates.test.ts checks that each such page has a title)
	const pageName = (href: string) => m.pageTitle[href.slice(1) as keyof typeof m.pageTitle];

	const meta = (u: Update) =>
		u.kind === 'fixes' ? dayName.format(new Date(u.date)) : `${dayName.format(new Date(u.date))} · ${m.updates.kinds[u.kind]}`;

	// The visitor has now seen the newest entry: remember it, and the footer's
	// link goes back to its own colour.
	onMount(() => {
		if (settings.seen === latestId()) return;
		applySetting('seen', latestId());
		settings.seen = latestId();
	});
</script>

<TextPage title={m.pageTitle.updates} description={m.meta.updates}>
	<p class="lead">{m.updates.intro}</p>

	{#each byMonth() as group (group.month)}
		<h2>{heading(group.month)}</h2>
		<ul>
			{#each group.items as u (u.id)}
				<li>
					<div class="meta"><time datetime={u.date}>{meta(u)}</time></div>
					<h3>{u.title ? u.title[settings.lang] : m.updates.fixes}</h3>
					<p>
						{u.body[settings.lang]}
						{#if u.href}<a href={u.href}>{pageName(u.href)}</a>{/if}
					</p>
				</li>
			{/each}
		</ul>
	{/each}
</TextPage>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A hairline between entries, none above the first: the month's heading is there */
	li {
		padding: 0.75rem 0;
		border-top: 1px solid var(--border);
	}

	li:first-child {
		padding-top: 0.25rem;
		border-top: 0;
	}

	/* The date and the kind are for finding one's place, so they stay in the
	   interface's face while the sentence under them reads in the serif. A
	   div, not a p: TextPage sets every p in the reading face. */
	.meta {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-sm);
	}

	h3 {
		margin: 0.05rem 0 0.1rem;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.35;
	}

	li p:last-child {
		margin: 0;
		color: var(--ink-2);
	}

	/* The page's name after the sentence: one thing to press, so it does not break */
	li a {
		font-family: var(--font-text);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
</style>
