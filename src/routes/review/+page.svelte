<!-- Flashcards. The words come from the saved list and from decks of common
     words; when each is shown is worked out in the browser by FSRS-6
     (src/lib/review/fsrs.ts) and kept by review.svelte.ts, in this browser and,
     signed in, in the account. A card shows the word; the answer is the same
     content as the Anki export, from /api/words/cards. Two answers only:
     "Again" and "Good". The card lies on a pile: answered, it leaves to the
     left for "Again" and to the right for "Good", and the next one comes up. -->
<script lang="ts">
	import { RadioGroup, Switch } from 'bits-ui';
	import { onMount } from 'svelte';
	import Grammar from '#lib/Grammar.svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useRadio } from '#lib/radio.svelte.ts';
	import { nextUp, plan, span } from '#lib/review/cards.ts';
	import { COMMON_DECKS, DECK_IDS, NEW_PER_DAY, SAVED_DECK } from '#lib/review/decks.ts';
	import { AGAIN, GOOD, answer, newCard, preview, type Grade, type ReviewCard } from '#lib/review/fsrs.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { SUMMARY_MAX } from '#lib/saved.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordCard } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';
	import { useToasts } from '#lib/toasts.ts';

	const settings = useSettings();
	const saved = useSaved();
	const review = useReview();
	const radio = useRadio();
	const toaster = useToasts();
	let m = $derived(messagesFor(settings.lang));

	/** What each word's card shows. */
	let content = $state.raw(new Map<string, WordCard>());
	/** Words the dictionary no longer has: they are passed over. */
	let gone = $state.raw(new Set<string>());
	let failed = $state(false);
	const asked = new Set<string>();

	// Moved on by every answer, and by the clock while the page is open, so a
	// card on a learning step turns up when its minutes have passed.
	let now = $state(Date.now());

	let started = $state(false);
	let current = $state.raw<ReviewCard | null>(null);
	let flipped = $state(false);
	let reviewed = $state(0);
	/** The last answer, for Undo: the word, and its card as it was before. */
	let last = $state.raw<{ word: string; before: ReviewCard | null } | null>(null);
	/** The side the answered card is leaving by, while it leaves. */
	let leaving = $state<'left' | 'right' | null>(null);
	/** Counts the cards shown, so that each new one comes up afresh. */
	let shown = $state(0);
	const LEAVE_MS = 260;

	onMount(() => {
		void review.load();
		// All of them, switched on or not: the list of decks says how far each has got.
		review.fetchDecks(COMMON_DECKS.map((deck) => deck.id));
		const tick = setInterval(() => (now = Date.now()), 20_000);
		return () => clearInterval(tick);
	});

	const wordsOf = (deck: string): string[] =>
		deck === SAVED_DECK ? saved.items.map((item) => item.word) : (review.common.get(deck) ?? []);

	// Saved words first, newest first: they are the ones the visitor asked for.
	let words = $derived(review.settings.decks.flatMap(wordsOf).filter((word) => !gone.has(word)));
	let today = $derived(plan(review.cards, words, review.settings.new_per_day, now));
	let left = $derived(today.learning.length + today.due.length + today.fresh.length);
	let ready = $derived(review.ready && saved.ready);
	let info = $derived(current ? content.get(current.word) : undefined);
	let ahead = $derived(current ? preview(current, now) : null);
	let canUndo = $derived(last !== null && review.canUndo(last.word));

	/** When the next card in the decks falls due, once today's are done. */
	let nextDue = $derived.by(() => {
		let soonest = Infinity;
		for (const word of words) soonest = Math.min(soonest, review.cards.get(word)?.due ?? Infinity);
		return soonest;
	});

	// Ask for what today's cards show, a few hundred at a time.
	$effect(() => {
		if (!started) return;
		const missing = [...today.learning, ...today.due].map((card) => card.word).concat(today.fresh)
			.filter((word) => !asked.has(word));
		if (!missing.length) return;
		for (const word of missing) asked.add(word);
		void fetchContent(missing);
	});

	async function fetchContent(wanted: string[]) {
		try {
			for (let i = 0; i < wanted.length; i += SUMMARY_MAX) {
				const batch = wanted.slice(i, i + SUMMARY_MAX);
				const res = await fetch('/api/words/cards', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ words: batch })
				});
				if (!res.ok) throw new Error(String(res.status));
				const found: WordCard[] = (await res.json()).words;
				content = new Map([...content, ...found.map((card) => [card.word, card] as const)]);
				const has = new Set(found.map((card) => card.word));
				const lost = batch.filter((word) => !has.has(word));
				if (lost.length) gone = new Set([...gone, ...lost]);
				// The card on show is one of them: move on from it.
				if (current && gone.has(current.word)) advance();
			}
		} catch {
			// Asked again by "Try again".
			for (const word of wanted) if (!content.has(word)) asked.delete(word);
			failed = true;
		}
	}

	function advance() {
		now = Date.now();
		current = nextUp(today, now);
		flipped = false;
		leaving = null;
		shown += 1;
	}

	function start() {
		started = true;
		reviewed = 0;
		last = null;
		advance();
	}

	function stop() {
		started = false;
		current = null;
		void review.sync();
	}

	function retry() {
		failed = false;
		now = Date.now(); // runs the effect that asks again
	}

	function give(grade: Grade) {
		if (!current || !flipped || leaving) return;
		const card = current;
		last = { word: card.word, before: review.cards.get(card.word) ?? null };
		review.record(answer(card, grade, Date.now()));
		reviewed += 1;
		// The card is seen off before the next one is shown, unless the
		// visitor's system asks for no motion.
		leaving = grade === AGAIN ? 'left' : 'right';
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		setTimeout(() => {
			// Undone or stopped in the meantime: the card on show is no longer this one.
			if (current !== card) return;
			advance();
			// The day's last answer has no next answer to send it along.
			if (!current) void review.sync();
		}, still ? 0 : LEAVE_MS);
	}

	function undo() {
		if (!last || !review.canUndo(last.word)) return;
		review.undo(last.word, last.before);
		reviewed -= 1;
		now = Date.now();
		current = last.before ?? newCard(last.word, now);
		flipped = false;
		leaving = null;
		shown += 1;
		last = null;
		toaster.addToast({ data: { title: m.review.undone } });
	}

	// The radio may be playing: it is turned down while the word sounds.
	function play(url: string) {
		const done = radio.duck();
		const audio = new Audio(url);
		audio.addEventListener('ended', done);
		audio.addEventListener('error', done);
		audio.play().catch(done);
	}

	function onkeydown(event: KeyboardEvent) {
		if (!started || !current || !info) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
			if (canUndo) {
				event.preventDefault();
				undo();
			}
			return;
		}
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		// A focused button or field handles its own keys.
		if (event.target instanceof Element && event.target.closest('button, a, input, textarea, [role="dialog"]')) return;
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (flipped) give(GOOD);
			else flipped = true;
		} else if (event.key === '1' || event.key === 'ArrowLeft') give(AGAIN);
		else if (event.key === '2' || event.key === 'ArrowRight') give(GOOD);
	}

	function toggleDeck(deck: string, on: boolean) {
		const decks = on ? [...review.settings.decks, deck] : review.settings.decks.filter((id) => id !== deck);
		review.change({ decks: DECK_IDS.filter((id) => decks.includes(id)) });
		now = Date.now();
	}

	const label = (ms: number) => {
		const { n, unit } = span(ms);
		return m.review.span[unit](n);
	};
</script>

<svelte:window {onkeydown} />

<PageMeta title="{m.pageTitle.review} · Nebokrai" description={m.meta.review} />

<div class="ui-page page">
	<header>
		<h1 class="ui-title">{m.pageTitle.review}</h1>
		{#if started && current}
			<span class="ui-badge">{m.review.left(left)}</span>
			<button type="button" class="ui-btn stop" onclick={stop}>{m.review.end}</button>
		{/if}
	</header>

	{#if !started}
		<p class="lead">{m.review.lead}</p>

		<section class="ui-card today" aria-busy={!ready}>
			<dl>
				<div><dt>{m.review.learning}</dt><dd>{ready ? today.learning.length : '–'}</dd></div>
				<div><dt>{m.review.due}</dt><dd>{ready ? today.due.length : '–'}</dd></div>
				<div><dt>{m.review.fresh}</dt><dd>{ready ? today.fresh.length : '–'}</dd></div>
			</dl>
			<button type="button" class="ui-btn ui-btn-primary" disabled={!ready || !left} onclick={start}>
				{m.review.start}
			</button>
			{#if ready && !left}
				<p class="muted">
					{words.length ? m.review.nothingToday : m.review.noWords}
					{#if words.length && nextDue < Infinity && nextDue > now}{m.review.next(label(nextDue - now))}{/if}
				</p>
			{/if}
		</section>

		<section class="ui-card options">
			<h2 class="ui-label">{m.review.decks}</h2>
			<ul>
				{#each DECK_IDS as deck (deck)}
					{@const all = wordsOf(deck)}
					<li>
						<span class="name" id="deck-{deck}">{m.review.deck[deck]}</span>
						<span class="muted">
							{#if deck === SAVED_DECK ? saved.ready : review.common.has(deck)}
								{m.review.progress(all.filter((word) => review.cards.has(word)).length, all.length)}
							{/if}
						</span>
						<Switch.Root
							class="ui-switch"
							aria-labelledby="deck-{deck}"
							checked={review.settings.decks.includes(deck)}
							onCheckedChange={(on) => toggleDeck(deck, on)}
						>
							<Switch.Thumb class="ui-switch-thumb" />
						</Switch.Root>
					</li>
				{/each}
			</ul>

			<h2 class="ui-label" id="new-per-day">{m.review.newPerDay}</h2>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-labelledby="new-per-day"
				value={String(review.settings.new_per_day)}
				onValueChange={(value) => review.change({ new_per_day: Number(value) })}
			>
				{#each NEW_PER_DAY as n (n)}
					<RadioGroup.Item class="ui-segment" value={String(n)}>{n}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
			<p class="muted">{saved.signedIn ? m.review.keptAccount : m.review.kept}</p>
		</section>
	{:else if current && info}
		<div class="pile">
			{#if left > 2}<div class="ui-card under two"></div>{/if}
			{#if left > 1}<div class="ui-card under one"></div>{/if}
			{#key shown}
				<article class="ui-card card" data-leaving={leaving}>
					<div class="front">
						<Headword text={info.headword} size="lg" tag="span" />
						{#if info.audio_url}
							{@const url = info.audio_url}
							<button type="button" class="ui-icon-btn" aria-label={m.word.playRecording} onclick={() => play(url)}>
								<Icon name="speaker" />
							</button>
						{/if}
					</div>
					{#if flipped}
						<div class="back">
							<p class="grammar">
								<Grammar pos={info.pos} tags={info.tags} inline />
								{#if info.ipa}<span class="ipa">{info.ipa}</span>{/if}
							</p>
							<ol class="glosses">
								{#each info.glosses as gloss (gloss)}<li>{gloss}</li>{/each}
							</ol>
							{#if info.example}
								<p class="example">
									<span lang="uk">{info.example.uk}</span>
									<span class="muted">{info.example.en}</span>
								</p>
							{/if}
							<a class="more" href={wordPath(info.word)}>{m.review.openWord}</a>
						</div>
					{/if}
				</article>
			{/key}
		</div>

		{#if flipped && ahead}
			<div class="answers">
				<button type="button" class="ui-btn answer again" onclick={() => give(AGAIN)}>
					<span class="when">{label(ahead.again - now)}</span>
					<span class="what"><Icon name="arrow-left" size={16} />{m.review.again} <kbd class="ui-kbd">1</kbd></span>
				</button>
				<button type="button" class="ui-btn ui-btn-primary answer" onclick={() => give(GOOD)}>
					<span class="when">{label(ahead.good - now)}</span>
					<span class="what">{m.review.good} <kbd class="ui-kbd">2</kbd><Icon name="arrow-right" size={16} /></span>
				</button>
			</div>
		{:else}
			<div class="answers">
				<button type="button" class="ui-btn ui-btn-primary show" onclick={() => (flipped = true)}>
					{m.review.show}
				</button>
			</div>
		{/if}
		<p class="under">
			<span class="muted keys">{m.review.keys}</span>
			{#if canUndo}<button type="button" class="ui-btn" onclick={undo}>{m.review.undo}</button>{/if}
		</p>
	{:else if current}
		<section class="ui-card end" role="status">
			{#if failed}
				<p>{m.review.loadFailed}</p>
				<button type="button" class="ui-btn" onclick={retry}>{m.review.retry}</button>
			{:else}
				<p class="muted">{m.review.loading}</p>
			{/if}
		</section>
	{:else}
		<section class="ui-card end" role="status">
			<h2>{m.review.done}</h2>
			<p>
				{m.review.reviewed(reviewed)}
				{#if nextDue < Infinity && nextDue > now}{m.review.next(label(nextDue - now))}{/if}
			</p>
			<div class="answers">
				{#if canUndo}<button type="button" class="ui-btn" onclick={undo}>{m.review.undo}</button>{/if}
				<button type="button" class="ui-btn ui-btn-primary" onclick={stop}>{m.review.backToDecks}</button>
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		/* A card leaving the pile must not widen the page */
		overflow-x: clip;
		display: grid;
		gap: 1rem;
		max-width: var(--prose);
		padding-top: 1.75rem;
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.stop {
		margin-left: auto;
	}

	p,
	h2,
	dl,
	dd,
	ul,
	ol {
		margin: 0;
	}

	.lead {
		color: var(--on-page);
	}

	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.today,
	.options,
	.end {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}

	.today,
	.end {
		justify-items: center;
		text-align: center;
	}

	dl {
		display: flex;
		gap: 2rem;
	}

	dt {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	dd {
		font-family: var(--font-heading);
		font-size: var(--title);
		font-variant-numeric: tabular-nums;
	}

	.options ul {
		display: grid;
		gap: 0.75rem;
		padding: 0;
		list-style: none;
	}

	.options li {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 0.75rem;
	}

	.options li .muted {
		grid-row: 2;
	}

	.options li :global(.ui-switch) {
		grid-row: 1 / span 2;
		grid-column: 2;
	}

	.options :global(.ui-segmented) {
		justify-self: start;
	}

	/* The pile: the card on show, and the edges of up to two more under it */
	.pile {
		display: grid;
		margin-bottom: 1rem;
	}

	.pile > * {
		grid-area: 1 / 1;
	}

	.under.one {
		transform: translateY(0.6rem) scale(0.96);
	}

	.under.two {
		transform: translateY(1.2rem) scale(0.92);
		opacity: 0.7;
	}

	.card {
		position: relative;
		display: grid;
		gap: 1.25rem;
		min-height: 16rem;
		padding: 2rem 1.25rem;
		align-content: center;
		animation: come-up 0.24s ease-out both;
		transition:
			transform 0.26s ease-in,
			opacity 0.26s ease-in;
	}

	.card[data-leaving='left'] {
		transform: translateX(-110%) rotate(-10deg);
		opacity: 0;
	}

	.card[data-leaving='right'] {
		border-color: var(--accent);
		transform: translateX(110%) rotate(10deg);
		opacity: 0;
	}

	.back {
		animation: come-up 0.2s ease-out both;
	}

	@keyframes come-up {
		from {
			opacity: 0;
			transform: translateY(0.75rem) scale(0.98);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.back {
			animation: none;
			transition: none;
		}
	}

	.front {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
	}

	.back {
		display: grid;
		gap: 0.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
	}

	.grammar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.ipa {
		font-family: var(--font-ipa);
	}

	.glosses {
		display: grid;
		gap: 0.25rem;
		padding-left: 1.25rem;
		font-size: var(--text-lg);
	}

	/* One meaning needs no number */
	.glosses li:only-child {
		margin-left: -1.25rem;
		list-style: none;
	}

	.example {
		display: grid;
		gap: 0.15rem;
	}

	.more {
		justify-self: start;
		font-size: var(--text-sm);
	}

	.answers {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
	}

	.answers .ui-btn {
		flex: 1;
		justify-content: center;
		max-width: 14rem;
		min-height: 3rem;
	}

	/* When the card comes back, over what the answer is */
	.answer {
		flex-direction: column;
		gap: 0.1rem;
	}

	.what {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.when {
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.again .when {
		color: var(--muted);
	}

	.under {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.5rem;
	}

	/* No keyboard to speak of on a phone */
	@media (hover: none) {
		.keys,
		.answers kbd {
			display: none;
		}

		.under {
			justify-content: flex-end;
		}
	}
</style>
