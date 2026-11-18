<!-- /read: the stories to read, as a grid of covers (Figma, "Stories reader",
     List 2, picked 2026-11-18). The tabs choose a level, or all of them;
     /read?level=2 is a level's own address, which the learning path links to.
     Under each story, once the visitor has cards, the share of its words
     they know, from the cards in this browser (knownShare in texts.ts):
     nothing about the visitor is sent for it. -->
<script lang="ts">
	import { page } from '$app/state';
	import { coverOf } from '#lib/covers.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import PageMeta from '#lib/PageMeta.svelte';
	import { percent } from '#lib/coverage.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSettings } from '#lib/settings.ts';
	import Stressed from '#lib/Stressed.svelte';
	import { knownShare } from '#lib/texts.ts';

	let { data } = $props();

	const settings = useSettings();
	const review = useReview();
	let m = $derived(messagesFor(settings.lang));

	const LEVELS = [1, 2, 3, 4, 5];
	let asked = $derived(Number(page.url.searchParams.get('level')));
	let level = $derived(LEVELS.includes(asked) ? asked : null);
	let shown = $derived(level ? data.texts.filter((t) => t.level === level) : data.texts);
	let levels = $derived(LEVELS.filter((l) => data.texts.some((t) => t.level === l)));

	// The cards are read in the browser; the server page has none, so the
	// figure appears once the page is live.
	let hasCards = $state(false);
	$effect(() => {
		hasCards = [...review.cards.keys()].some((key) => !key.startsWith('grammar:'));
	});
	const now = Date.now();
	let known = $derived(
		hasCards ? new Map(data.texts.map((t) => [t.slug, percent(knownShare(t.vocab, review.cards, now))])) : null
	);
</script>

<PageMeta title="{m.pageTitle.read} · Nebokrai" description={m.meta.read} />

<div class="ui-page page">
	<h1 class="ui-title">{m.read.title}</h1>
	<p class="lead">{m.read.lead}</p>

	{#if data.texts.length}
		<nav class="ui-segmented levels" aria-label={m.read.levels}>
			<a class="ui-segment" href="/read" data-state={level === null ? 'checked' : undefined}
				aria-current={level === null ? 'page' : undefined}>{m.read.all}</a
			>
			{#each levels as l (l)}
				<a class="ui-segment" href="/read?level={l}" data-state={level === l ? 'checked' : undefined}
					aria-current={level === l ? 'page' : undefined}
					><span class="word">{m.read.levelShort}&nbsp;</span>{l}</a
				>
			{/each}
		</nav>

		<ul class="grid">
			{#each shown as text (text.slug)}
				{@const cover = coverOf(text.slug)}
				{@const share = known?.get(text.slug)}
				<li>
					<a href="/read/{text.slug}">
						{#if cover}
							<img class="cover" src={cover} alt="" loading="lazy" width="400" height="300" />
						{:else}
							<span class="cover blank" aria-hidden="true"></span>
						{/if}
						<b lang="uk"><Stressed text={text.title} /></b>
						<span class="english">{text.title_en}</span>
					</a>
					<span class="facts">
						{#if share !== undefined}
							<span class="meter" aria-hidden="true"><span style:width="{share}%"></span></span>
							{m.read.known(share)}
						{:else}
							{m.read.level(text.level ?? 0)} · {m.read.words(text.tokens)}
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">{m.read.none}</p>
	{/if}
</div>

<style>
	.page {
		max-width: var(--frame-width);
	}

	.lead {
		margin: 0 0 var(--gap-block);
		font-size: var(--text-lg);
		color: var(--on-page);
	}

	.levels {
		margin-bottom: var(--gap-block);
	}

	.levels a {
		text-decoration: none;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--gap-block) var(--gap-stack);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		gap: var(--gap-tight);
	}

	li a {
		display: flex;
		flex-direction: column;
		gap: var(--gap-tight);
		color: inherit;
		text-decoration: none;
	}

	.cover {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: var(--gap-inline);
	}

	.blank {
		background: var(--surface-2);
	}

	li b {
		font-family: var(--font-reading);
		font-size: var(--text-lg);
	}

	li a:hover b {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.english {
		color: var(--muted);
	}

	.facts {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-inline);
		font-size: var(--text-sm);
		color: var(--ink-2);
	}

	.meter {
		display: inline-block;
		width: 3.5rem;
		height: 4px;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
		overflow: hidden;
	}

	.meter span {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.muted {
		color: var(--muted);
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 600px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		/* "1" to "5": "Level 1" to "Level 5" do not fit beside "All" */
		.word {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
</style>
