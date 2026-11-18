<!-- /read/<story>: one story as continuous prose (Figma, "Stories reader",
     Reader 1 v2 with the comments of 2026-11-18):

       ← Stories
       [cover]  Ду́же висо́кий чолові́к
                Level 2 · 11 pages · 74 words · you know 81%
       Cornelius Gulere, illustrated by …, read by Oksana Duchak · Storybooks Canada, CC BY 3.0
       [▶ Page 3 of 11 · Read by Oksana Duchak ─────── 1×  |  English ○]
       Underlined words are ones you have not learnt yet. Tap any word for its meaning.
       ▶ Його моти́ка була́ закоротка.
       ▶ Две́рі його до́му були́ занизькі.
       …
       [Add the 9 new words to “Дуже високий чоловік”]
       About this story: the full credits.

     The player holds under the header while the story scrolls. It plays the
     human recordings page by page (one file per page, data/fetch_story_audio.py),
     never the browser's voice; until the recordings are on the site it is
     not shown. The English title and the English of each page show only with
     English switched on. A word is underlined when the reader has 20 cards or
     more and none of the entries it may be is known (stateOf): before that,
     every word would be. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { coverOf } from '#lib/covers.ts';
	import { percent } from '#lib/coverage.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { stateOf } from '#lib/practice/round.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import Sentence from '#lib/Sentence.svelte';
	import { useSettings } from '#lib/settings.ts';
	import Stressed from '#lib/Stressed.svelte';
	import { knownShare } from '#lib/texts.ts';
	import { useToasts } from '#lib/toasts.ts';

	let { data } = $props();

	const settings = useSettings();
	const review = useReview();
	const saved = useSaved();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));
	let text = $derived(data.text);

	/** The underlines begin once the reader has this many word cards. */
	const MARK_FROM = 20;
	const SPEEDS = [1, 0.75];

	// Page 1 is the title page, whose one sentence is the title above.
	let pages = $derived(text.contents.filter((p) => p.page > 1));
	let title = $derived(text.title.replaceAll('́', ''));
	let cover = $derived(coverOf(text.slug));
	let readBy = $derived(text.credits.filter((c) => c.role === 'Read by').map((c) => c.name).join(', '));
	/** "written by Cornelius Gulere", in the page's language; a role the colophon names otherwise stays as it is. */
	const credit = (c: { role: string; name: string }) => `${m.read.role[c.role] ?? c.role.toLowerCase()} ${c.name}`;
	const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
	let credits = $derived(capital(text.credits.map(credit).join(', ')));

	let english = $state(false);

	// What the reader knows comes from the cards in this browser, so the
	// server page has none of it: it is worked out once the page is live.
	let live = $state(false);
	const now = Date.now();
	let wordCards = $derived(live ? [...review.cards.keys()].filter((key) => !key.startsWith('grammar:')).length : 0);
	let marking = $derived(wordCards >= MARK_FROM);
	let share = $derived(wordCards ? percent(knownShare(text.vocab, review.cards, now)) : null);
	const isKnown = (lemmas: string[]) => lemmas.some((w) => stateOf(review.cards.get(w), now) === 'known');

	/** The words to offer at the end: the commonest entry of each word not known, not yet saved. */
	let newWords = $derived.by(() => {
		if (!live) return [];
		const out = new Set<string>();
		for (const [lemmas] of text.vocab) if (!isKnown(lemmas) && !saved.has(lemmas[0])) out.add(lemmas[0]);
		return [...out];
	});
	let adding = $state(false);

	async function addWords() {
		adding = true;
		const words = newWords;
		const added = await saved.importWords(words, title);
		adding = false;
		if (added === null) toaster.addToast({ data: { title: m.read.addFailed } });
		else toaster.addToast({ data: { title: m.read.added(added, title) } });
	}

	// ---------------------------------------------------------------- the player
	let audio: HTMLAudioElement | null = null;
	let hasAudio = $state(false);
	/** The page being played, or the one the player will start from. */
	let current = $state(0);
	let playing = $state(false);
	let progress = $state(0);
	let speed = $state(1);
	let header = $state(0);

	function load(index: number) {
		if (!audio) return;
		current = index;
		audio.src = pages[index].audio;
		audio.playbackRate = speed;
	}

	async function play(index = current) {
		if (!audio) return;
		if (index !== current || !audio.src) load(index);
		try {
			await audio.play();
		} catch {
			playing = false;
		}
	}

	function toggle() {
		if (playing) audio?.pause();
		else void play();
	}

	function playPage(index: number) {
		if (playing && index === current) audio?.pause();
		else void play(index);
	}

	function nextSpeed() {
		speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
		if (audio) audio.playbackRate = speed;
	}

	onMount(() => {
		live = true;
		const bar = document.querySelector('header');
		const measure = () => (header = bar?.getBoundingClientRect().height ?? 0);
		measure();
		const watch = new ResizeObserver(measure);
		if (bar) watch.observe(bar);

		// The recordings may not be on the site yet: ask for the first page's
		// before showing the player at all.
		let gone = false;
		if (pages.length) {
			void fetch(pages[0].audio, { method: 'HEAD' })
				.then((r) => {
					if (gone || !r.ok) return;
					audio = new Audio();
					audio.preload = 'none';
					audio.addEventListener('play', () => (playing = true));
					audio.addEventListener('pause', () => (playing = false));
					audio.addEventListener('timeupdate', () => {
						const done = audio && audio.duration ? audio.currentTime / audio.duration : 0;
						progress = (current + done) / pages.length;
					});
					audio.addEventListener('ended', () => {
						if (current + 1 < pages.length) void play(current + 1);
						else {
							current = 0;
							progress = 0;
						}
					});
					hasAudio = true;
				})
				.catch(() => {});
		}
		return () => {
			gone = true;
			watch.disconnect();
			audio?.pause();
		};
	});

	/** For each word of a sentence, in order: underline it? */
	function marks(lemmas: string[][]): boolean[] | undefined {
		if (!marking) return undefined;
		return lemmas.map((l) => l.length > 0 && !isKnown(l));
	}
</script>

<PageMeta title="{title} · {m.read.title} · Nebokrai" description={m.meta.readStory(title, text.title_en, text.level)} />

<article class="ui-page page">
	<p class="back"><a href="/read"><Icon name="arrow-left" size={14} /> {m.read.back}</a></p>

	<header class="head">
		{#if cover}
			<img class="cover" src={cover} alt="" width="132" height="132" />
		{:else}
			<span class="cover blank" aria-hidden="true"></span>
		{/if}
		<div>
			<h1 class="ui-title" lang="uk"><Stressed text={text.title} /></h1>
			{#if english}<p class="english-title">{text.title_en}</p>{/if}
			<p class="facts">
				{[
					text.level ? m.read.level(text.level) : null,
					m.read.pages(pages.length),
					m.read.words(text.tokens),
					share !== null ? m.read.known(share) : null
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
		</div>
	</header>
	<p class="credit">
		{credits} · <a href={text.url} rel="noopener">Storybooks Canada</a>,
		<a href={text.licence_url} rel="license noopener">{text.licence}</a>
	</p>

	<div class="player" class:bare={!hasAudio} style:top="{header}px">
		{#if hasAudio}
			<button type="button" class="round" onclick={toggle} aria-label={playing ? m.read.pause : m.read.play}>
				<Icon name={playing ? 'stop' : 'play'} size={18} filled />
			</button>
			<span class="where">
				<b>{m.read.pageOf(current + 1, pages.length)}</b>
				{#if readBy}<span class="muted">{m.read.readBy(readBy)}</span>{/if}
			</span>
			<span class="track" aria-hidden="true"><span style:width="{progress * 100}%"></span></span>
			<button type="button" class="speed" onclick={nextSpeed} title={m.read.speed} aria-label={m.read.speed}>{speed}×</button>
			<span class="divider" aria-hidden="true"></span>
		{/if}
		<label class="switch">
			<input type="checkbox" bind:checked={english} />
			<span class="knob" aria-hidden="true"></span>
			{m.read.english}
		</label>
	</div>
	<p class="key">{marking ? m.read.key : m.read.keyNew}</p>

	<div class="pages">
		{#each pages as page, i (page.page)}
			<section class="story-page" class:playing={hasAudio && playing && current === i}>
				{#if hasAudio}
					<button
						type="button"
						class="ui-icon-btn page-play"
						onclick={() => playPage(i)}
						aria-label={playing && current === i ? m.read.stopPage(page.page) : m.read.playPage(page.page)}
					>
						<Icon name={playing && current === i ? 'stop' : 'play'} size={14} filled />
					</button>
				{/if}
				<div class="text">
					<p class="uk">
						{#each page.sentences as sentence, n (sentence.n)}{#if n}{' '}{/if}<Sentence
								text={sentence.uk}
								unknown={marks(sentence.lemmas)}
							/>{/each}
					</p>
					{#if english}<p class="en">{page.en}</p>{/if}
				</div>
			</section>
		{/each}
	</div>

	{#if live}
		<p class="end">
			{#if newWords.length}
				<button type="button" class="ui-btn" onclick={addWords} disabled={adding}>
					{m.read.addWords(newWords.length, title)}
				</button>
			{:else}
				<span class="muted">{m.read.allSaved}</span>
			{/if}
		</p>
	{/if}

	<footer class="colophon">
		<h2>{m.read.colophon}</h2>
		<ul>
			{#each text.credits as c (c.role + c.name)}
				<li>{capital(credit(c))}</li>
			{/each}
		</ul>
		{#if text.origin}
			<p>
				{m.read.origin(text.origin.title)} <a href={text.origin.url} rel="noopener">{text.origin.site}</a>.
			</p>
		{/if}
		<p>
			{m.read.from}: <a href={text.url} rel="noopener">Storybooks Canada</a>,
			<a href={text.licence_url} rel="license noopener">{text.licence}</a>. {m.read.changes}
		</p>
	</footer>
</article>

<style>
	.page {
		max-width: var(--prose);
	}

	.back {
		margin: 0 0 var(--gap-stack);
		font-size: var(--text-sm);
	}

	.back a {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-tight);
	}

	.head {
		display: flex;
		gap: var(--gap-stack);
		align-items: center;
	}

	.head .ui-title {
		margin: 0;
	}

	.cover {
		flex: none;
		width: 132px;
		height: 132px;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}

	.blank {
		display: block;
		background: var(--surface-2);
	}

	.english-title {
		margin: 0;
		color: var(--muted);
	}

	.facts {
		margin: var(--gap-tight) 0 0;
		font-size: var(--text-sm);
		color: var(--ink-2);
	}

	.credit {
		margin: var(--gap-inline) 0 var(--gap-block);
		font-size: var(--text-xs);
		color: var(--muted);
	}

	.player {
		position: sticky;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: var(--gap-stack);
		padding: var(--gap-inline) var(--gap-stack);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--panel);
		margin-bottom: var(--gap-inline);
	}

	/* No recordings on the site yet: the English switch alone, no bar */
	.player.bare {
		position: static;
		padding: 0;
		border: 0;
		background: none;
	}

	.round {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--bg);
		cursor: pointer;
	}

	.where {
		display: flex;
		flex-direction: column;
		font-size: var(--text-sm);
	}

	.muted {
		color: var(--muted);
	}

	.track {
		flex: 1;
		min-width: 3rem;
		height: 4px;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
		overflow: hidden;
	}

	.track span {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.speed {
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.divider {
		width: 1px;
		align-self: stretch;
		background: var(--border);
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-inline);
		margin-left: auto;
		font-size: var(--text-sm);
		color: var(--ink-2);
		cursor: pointer;
	}

	.switch input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.knob {
		position: relative;
		width: 30px;
		height: 18px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--surface-2);
		transition: background var(--duration);
	}

	.knob::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--muted);
		transition: left var(--duration);
	}

	.switch input:checked + .knob {
		border-color: var(--accent);
		background: var(--accent);
	}

	.switch input:checked + .knob::after {
		left: 14px;
		background: var(--bg);
	}

	.switch input:focus-visible + .knob {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.key {
		margin: 0 0 var(--gap-stack);
		font-size: var(--text-xs);
		color: var(--muted);
	}

	.story-page {
		display: flex;
		gap: var(--gap-inline);
		align-items: baseline;
		margin-left: -2.5rem;
		padding: var(--gap-tight) 0;
		border-radius: var(--radius-sm);
	}

	.page-play {
		flex: none;
		width: 2rem;
		color: var(--muted);
	}

	.text {
		flex: 1;
		min-width: 0;
		padding-left: 0.5rem;
	}

	.story-page:not(:has(.page-play)) .text {
		padding-left: 2.5rem;
	}

	.story-page.playing .text {
		background: var(--accent-soft);
		box-shadow: 0 0 0 0.35rem var(--accent-soft);
		border-radius: var(--radius-sm);
	}

	.story-page.playing .page-play {
		color: var(--accent);
	}

	.uk {
		margin: 0;
		font-family: var(--font-reading);
		font-size: var(--text-xl);
		line-height: 1.55;
	}

	.en {
		margin: var(--gap-tight) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}

	.end {
		margin: var(--gap-block) 0;
	}

	.colophon {
		margin-top: var(--gap-section);
		padding-top: var(--gap-stack);
		border-top: 1px solid var(--border);
		font-size: var(--text-sm);
		color: var(--ink-2);
	}

	.colophon h2 {
		margin: 0 0 var(--gap-inline);
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	.colophon ul {
		margin: 0 0 var(--gap-inline);
		padding: 0;
		list-style: none;
	}

	.colophon p {
		margin: var(--gap-tight) 0;
	}

	@media (max-width: 760px) {
		.story-page {
			margin-left: 0;
		}

		.story-page:not(:has(.page-play)) .text {
			padding-left: 0;
		}

		.cover {
			width: 88px;
			height: 88px;
		}

		.uk {
			font-size: var(--text-lg);
		}

		.player {
			flex-wrap: wrap;
			gap: var(--gap-inline);
		}

		.track {
			flex-basis: 100%;
			order: 9;
		}

		.divider {
			display: none;
		}
	}
</style>
