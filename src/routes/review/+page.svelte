<!-- Flashcards. The words come from the saved list and from decks of common
     words; when each is shown is worked out in the browser by FSRS-6
     (src/lib/review/fsrs.ts) and kept by review.svelte.ts, in this browser and,
     signed in, in the account. A card shows the word; the answer is the same
     content as the Anki export, from /api/words/cards. Two answers only:
     "Again" and "Good". The card lies on a pile: answered, it leaves to the
     left for "Again" and to the right for "Good", and the next one comes up.
     A finger can send it there by swiping; the keys are Anki's. Under the
     decks, a calendar of the reviews done each day, with the streak.
     A tick on a deck says where new words come from; every word started
     comes back for review whichever decks are ticked, unless its deck is
     paused (decks.ts). One list of saved words (saved.ts) can be chosen in
     place of all of them; and /review?list=<id>, where the Saved page's
     Practise button leads from a list, practises that list alone for the
     visit without changing the decks.
     A word that has held for a week is answered by typing instead (RecallCard.svelte):
     its meaning is shown, the Ukrainian word typed, then its form in the
     card's sentence; the answer it suggests comes first. The visitor can
     switch typing off under the decks. -->
<script lang="ts">
	import { DropdownMenu, RadioGroup, Switch } from 'bits-ui';
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import Grammar from '#lib/Grammar.svelte';
	import Headword from '#lib/Headword.svelte';
	import Icon from '#lib/Icon.svelte';
	import { COMMON_PER_PAGE, COMMON_WORDS, commonPath } from '#lib/browse.ts';
	import PageMeta from '#lib/PageMeta.svelte';
	import RecallCard from '#lib/RecallCard.svelte';
	import ReviewHeatmap from '#lib/ReviewHeatmap.svelte';
	import ReviewHelp from '#lib/ReviewHelp.svelte';
	import ReviewKeys from '#lib/ReviewKeys.svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useRadio } from '#lib/radio.svelte.ts';
	import { stateOf } from '#lib/practice/round.ts';
	import { nextUp, plan, span } from '#lib/review/cards.ts';
	import { keyOfDay, type DayCounts } from '#lib/review/days.ts';
	import {
		COMMON_DECKS, DECK_IDS, MAX_GOAL_DAYS, MAX_PLAN_LENGTH, NEW_PER_DAY, SAVED_DECK, cleanPlan, listDeck, listOfDeck,
		newWords, reviewEstimate, reviewWords, wordsOfDeck
	} from '#lib/review/decks.ts';
	import {
		AGAIN, GOOD, REVIEW, answer, dayNumber, newCard, preview, type Grade, type ReviewCard
	} from '#lib/review/fsrs.ts';
	import {
		DEFAULT_KEYS, actionFor, bindable, isDefault, keyLabel, parseBindings, rebind, type Action
	} from '#lib/review/keys.ts';
	import { suggested, typable, type Recalled } from '#lib/review/recall.ts';
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

	// Typing the answer: on for a word that has held for a week (typable,
	// review/recall.ts), where the card has what typing needs. Whether it is
	// on at all is kept in this browser only, like the keys.
	const TYPING_KEY = 'review-typing';
	let typingOn = $state(true);
	/** How the typed card went, once it has; the step it is on meanwhile. */
	let recalled = $state.raw<Recalled | null>(null);
	let recallStep = $state<'word' | 'form' | 'done'>('word');

	onMount(() => {
		try {
			typingOn = localStorage.getItem(TYPING_KEY) !== '0';
		} catch {
			// storage blocked: typing stays on
		}
	});

	function setTyping(on: boolean) {
		typingOn = on;
		try {
			if (on) localStorage.removeItem(TYPING_KEY);
			else localStorage.setItem(TYPING_KEY, '0');
		} catch {
			// storage blocked: the choice lasts until the page is closed
		}
	}

	onMount(() => {
		void review.load();
		// All of them, switched on or not: the list of decks says how far each has got.
		review.fetchDecks(COMMON_DECKS.map((deck) => deck.id));
		const tick = setInterval(() => (now = Date.now()), 20_000);
		return () => clearInterval(tick);
	});

	let savedWords = $derived(saved.items.map((item) => item.word));
	const wordsOf = (deck: string): string[] => wordsOfDeck(deck, savedWords, saved.lists, review.common);

	// Saved words first, newest first: they are the ones the visitor asked for.
	// Every choice of deck there is: the saved words, each list of them, the common words.
	let decks = $derived([
		SAVED_DECK, ...saved.lists.map((list) => listDeck(list.id)), ...COMMON_DECKS.map((deck) => deck.id as string)
	]);
	const deckName = (deck: string) =>
		saved.lists.find((list) => list.id === listOfDeck(deck))?.name ?? m.review.deck[deck] ?? deck;
	/** The saved words new ones come from: "saved" for all, a list's deck for that list, null when not ticked. */
	let savedScope = $derived(
		review.settings.decks.find((deck) => deck === SAVED_DECK || (listOfDeck(deck) !== null && decks.includes(deck)))
			?? null);
	const isTicked = (deck: string) => (deck === SAVED_DECK ? savedScope !== null : review.settings.decks.includes(deck));
	const isPaused = (deck: string) => review.settings.paused.includes(deck);
	/** How far a deck has got, as /learn's bar counts it: known, learning (shaky ones too), and the rest. */
	function progressOf(words: string[]) {
		const pool = new Set(words);
		let known = 0;
		let learning = 0;
		for (const word of pool) {
			const state = stateOf(review.cards.get(word), now);
			if (state === 'known') known += 1;
			else if (state !== 'new') learning += 1;
		}
		return { known, learning, left: pool.size - known - learning, total: pool.size };
	}
	/** A share of a bar in per cent; a single word still shows as a sliver. */
	const share = (n: number, total: number) => (total ? Math.max(n ? 1.5 : 0, (n / total) * 100) : 0);

	/** Where a deck's words can be read: the Saved page, or the page of /common-words it starts on. */
	function wordsHref(deck: string): string | null {
		if (deck === SAVED_DECK) return '/saved';
		const common = COMMON_DECKS.find((d) => d.id === deck);
		return common && common.to <= COMMON_WORDS ? commonPath(Math.floor((common.from - 1) / COMMON_PER_PAGE) + 1) : null;
	}

	// The one deck this visit is for, if it is one there is: /review?list=<id>
	// for one of the visitor's lists, /review?deck=<id> for any deck (the chips
	// on /learn: saved, common-500, list:<id>). Switched on or not.
	let only = $derived.by(() => {
		const params = page.url.searchParams;
		const list = params.get('list');
		const deck = list ? listDeck(list) : params.get('deck');
		return deck && decks.includes(deck) ? deck : null;
	});

	// Reviews from every deck not paused, new words from the decks ticked;
	// one deck practised alone gives both.
	let words = $derived(
		(only ? wordsOf(only) : reviewWords(review.settings, savedWords, saved.lists, review.common))
			.filter((word) => !gone.has(word)));
	let newFrom = $derived(
		(only ? wordsOf(only) : newWords(review.settings, savedWords, saved.lists, review.common))
			.filter((word) => !gone.has(word)));
	let today = $derived(plan(review.cards, words, review.settings.new_per_day, now, newFrom));
	let estimate = $derived(reviewEstimate(review.settings.new_per_day));
	let left = $derived(today.learning.length + today.due.length + today.fresh.length);
	let ready = $derived(review.ready && saved.ready);
	let info = $derived(current ? content.get(current.word) : undefined);
	// An entry can give the same meaning for several senses (вони: "they" three
	// times over): on a card it is said once.
	let glosses = $derived([...new Set(info?.glosses)]);
	let ahead = $derived(current ? preview(current, now) : null);
	let canUndo = $derived(last !== null && review.canUndo(last.word));
	let typing = $derived(typingOn && typable(current) && !!info?.recall);
	/** The words loaded for today, to offer beside a word that is to be picked out from four. */
	let others = $derived([...content.values()]);
	/** The answer offered first: what the typing suggests, or Good as ever. */
	let suggestion = $derived(typing && recalled ? suggested(recalled) : 'good');

	// /review?start, where /learn's "first words" lead: the deck was switched
	// on there, and the first card comes up without a second button to find.
	// Once only: stopping the round must not start it again.
	let begin = page.url.searchParams.has('start');
	$effect(() => {
		if (!begin || !ready || !left || started) return;
		begin = false;
		untrack(start);
	});

	/** How many cards fall due on each of the days to come, for the calendar. */
	let forecast = $derived.by(() => {
		const today = dayNumber(now);
		const due: DayCounts = {};
		for (const word of new Set(words)) {
			const card = review.cards.get(word);
			if (!card || card.state !== REVIEW) continue;
			const day = dayNumber(card.due);
			if (day > today) due[keyOfDay(day)] = (due[keyOfDay(day)] ?? 0) + 1;
		}
		return due;
	});

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
					body: JSON.stringify({ words: batch, recall: true })
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
		recalled = null;
		recallStep = 'word';
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
		changing = null;
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
		recalled = null;
		recallStep = 'word';
		leaving = null;
		shown += 1;
		last = null;
		toaster.addToast({ data: { title: m.review.undone } });
	}

	// A finger on the card: a tap turns it, and once the answer shows, a swipe
	// answers it, left for "Again" and right for "Good". The card follows the
	// finger; let go past a quarter of its width and it leaves that way,
	// short of that it springs back. Up and down still scroll the page.
	/** How far the card has been dragged sideways, in pixels. */
	let drag = $state(0);

	function swipe(node: HTMLElement) {
		let pointer = -1;
		let startX = 0;
		let startY = 0;
		let moved = false;
		const down = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' || leaving) return;
			// Links, the play button and the fields to type in keep their own taps.
			if (event.target instanceof Element && event.target.closest('a, button, input')) return;
			pointer = event.pointerId;
			startX = event.clientX;
			startY = event.clientY;
			moved = false;
		};
		const move = (event: PointerEvent) => {
			if (event.pointerId !== pointer || !flipped) return;
			const dx = event.clientX - startX;
			if (!moved) {
				// Not yet a swipe: a small wobble, or the start of a scroll.
				if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(event.clientY - startY)) return;
				moved = true;
				node.setPointerCapture(pointer);
			}
			drag = dx;
		};
		const up = (event: PointerEvent) => {
			if (event.pointerId !== pointer) return;
			pointer = -1;
			if (!moved) {
				// A card to type is turned by its answer, not by a tap
				if (!flipped && !typing && Math.abs(event.clientX - startX) < 12 && Math.abs(event.clientY - startY) < 12) flipped = true;
				return;
			}
			const far = Math.abs(drag) > Math.min(110, node.offsetWidth / 4);
			const grade = drag < 0 ? AGAIN : GOOD;
			drag = 0;
			if (far) give(grade);
		};
		const cancel = () => {
			pointer = -1;
			drag = 0;
		};
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', cancel);
		return () => {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', cancel);
		};
	}

	// The radio may be playing: it is turned down while the word sounds.
	function play(url: string) {
		const done = radio.duck();
		const audio = new Audio(url);
		audio.addEventListener('ended', done);
		audio.addEventListener('error', done);
		audio.play().catch(done);
	}

	// The keys are Anki's (qt/aqt/reviewer.py) until the visitor changes them
	// (src/lib/review/keys.ts): Space shows the answer and then gives the
	// default one, 1 and 3 answer, R plays the sound again, U undoes. They are
	// kept in this browser only: a keyboard belongs to a machine, not an account.
	const KEYS_KEY = 'review-keys';
	let keys = $state.raw(DEFAULT_KEYS);
	/** The action whose key was clicked and now waits for the key to replace it. */
	let changing = $state<Action | null>(null);

	onMount(() => {
		try {
			keys = parseBindings(JSON.parse(localStorage.getItem(KEYS_KEY) ?? 'null'));
		} catch {
			// storage blocked, or not JSON: the usual keys
		}
	});

	function setKeys(next: typeof keys) {
		keys = next;
		try {
			if (isDefault(next)) localStorage.removeItem(KEYS_KEY);
			else localStorage.setItem(KEYS_KEY, JSON.stringify(next));
		} catch {
			// storage blocked: the keys last until the page is closed
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (!started) return;
		// A key is being chosen: this press is the choice, whatever it used to do.
		if (changing) {
			event.preventDefault();
			if (event.code === 'Escape') changing = null;
			else if (bindable(event.code)) {
				setKeys(rebind(keys, changing, event.code));
				changing = null;
				// The key cap clicked still has the focus, and would swallow Space.
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
			}
			return;
		}
		// Not while typing in the quick search or another field.
		if (event.target instanceof Element && event.target.closest('input, textarea, select, [role="dialog"]')) return;
		const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
		// Ctrl+Z as everywhere else, whatever the keys are.
		const action = plain ? actionFor(keys, event.code) : !event.altKey && event.code === 'KeyZ' ? 'undo' : null;
		if (!action) return;
		// A focused button or link is pressed by Space and Enter itself.
		if ((event.code === 'Space' || event.code === 'Enter') && event.target instanceof Element
			&& event.target.closest('button, a')) return;

		// Undo works on the last screen too, where there is no card.
		if (action === 'undo') {
			if (!canUndo) return;
			event.preventDefault();
			return undo();
		}
		if (!current || !info) return;
		event.preventDefault(); // Space would scroll the page, F5 reload it
		if (action === 'replay') {
			if (info.audio_url) play(info.audio_url);
		} else if (action === 'show') {
			// Typed, the answer it suggests; a card still to type is not shown before it is
			if (flipped) give(suggestion === 'again' ? AGAIN : GOOD);
			else if (!typing) flipped = true;
		} else give(action === 'again' ? AGAIN : GOOD);
	}

	/** Tick or untick a deck. Saved words ticked again are all of them, whatever list was chosen before. */
	function tick(deck: string, on: boolean) {
		const rest = review.settings.decks.filter((id) => id !== deck && (deck !== SAVED_DECK || listOfDeck(id) === null));
		const chosen = on ? [...rest, deck] : rest;
		// In the order shown; this also lets go of lists that have been deleted.
		review.change({ decks: decks.filter((id) => chosen.includes(id)) });
		now = Date.now();
	}

	/** New words from all the saved words ("saved"), or from one list of them. */
	function chooseSaved(scope: string) {
		const rest = review.settings.decks.filter((id) => id !== SAVED_DECK && listOfDeck(id) === null);
		review.change({ decks: decks.filter((id) => id === scope || rest.includes(id)) });
		now = Date.now();
	}

	function pause(deck: string, on: boolean) {
		const chosen = on ? [...review.settings.paused, deck] : review.settings.paused.filter((id) => id !== deck);
		review.change({ paused: DECK_IDS.filter((id) => chosen.includes(id)) });
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
		<ReviewHelp />
		{#if started && current}
			<span class="ui-badge">{m.review.left(left)}</span>
			<!-- Always there, so that Stop does not move when it comes and goes -->
			<span class="session">
				<button type="button" class="ui-btn" disabled={!canUndo} onclick={undo}>{m.review.undo}</button>
				<button type="button" class="ui-btn" onclick={stop}>{m.review.end}</button>
			</span>
		{/if}
	</header>

	{#if !started}
		<p class="lead">{m.review.lead}</p>

		{#if ready && !newFrom.length && !words.some((word) => review.cards.has(word))}
			<!-- No deck has a word in it: three noughts over a Start that cannot be
			     pressed say nothing, so the way to begin is said in their place.
			     The decks to switch on are the next thing down the page. -->
			<section class="ui-card today begin">
				<Icon name="cards" size={28} />
				<p>{m.review.noWords}</p>
				{#if only}
					<p class="muted">{m.review.onlyList(deckName(only))} <a href="/review">{m.review.allDecks}</a></p>
				{/if}
			</section>
		{:else}
			<section class="ui-card today" aria-busy={!ready}>
				<dl>
					<div><dt>{m.review.learning}</dt><dd>{ready ? today.learning.length : '–'}</dd></div>
					<div><dt>{m.review.due}</dt><dd>{ready ? today.due.length : '–'}</dd></div>
					<div><dt>{m.review.fresh}</dt><dd>{ready ? today.fresh.length : '–'}</dd></div>
				</dl>
				<button type="button" class="ui-btn ui-btn-primary" disabled={!ready || !left} onclick={start}>
					{m.review.start}
				</button>
				{#if only}
					<p class="muted">{m.review.onlyList(deckName(only))} <a href="/review">{m.review.allDecks}</a></p>
				{/if}
				{#if ready && !left}
					<p class="muted">
						{m.review.nothingToday}
						{#if nextDue < Infinity && nextDue > now}{m.review.next(label(nextDue - now))}{/if}
					</p>
				{/if}
			</section>
		{/if}

		<!-- /review#decks is where /learn's "Manage decks" leads -->
		<section class="ui-card options" id="decks">
			<h2 class="ui-label" id="new-from">{m.review.newFrom}</h2>
			<p class="muted hint">{m.review.newFromNote}</p>
			<!-- A deck as a row: its tick, its name, a few of its words, how far it has got, and a menu -->
			{#snippet deckRow(deck: string)}
				{@const all = wordsOf(deck)}
				{@const begun = all.filter((word) => review.cards.has(word)).length}
				{@const progress = progressOf(all)}
				{@const paused = isPaused(deck)}
				{@const href = wordsHref(deck)}
				<li>
					<!-- A paused deck gives no new words; its tick is kept for when it is resumed -->
					<input
						type="checkbox"
						id="deck-{deck}"
						checked={isTicked(deck) && !paused}
						disabled={paused}
						onchange={(event) => tick(deck, event.currentTarget.checked)}
					/>
					<div class="about">
						<span class="title">
							<label for="deck-{deck}" class:paused>{m.review.row[deck] ?? deckName(deck)}</label>
							{#if paused}<span class="ui-badge">{m.review.paused}</span>{/if}
						</span>
						{#if deck === SAVED_DECK ? saved.ready : review.common.has(deck)}
							<!-- A few of its words, so that a step reads as a level: не, я, в, ти… -->
							{#if deck !== SAVED_DECK && all.length}
								<span class="muted" lang="uk">{all.slice(0, 3).join(', ')}…</span>
							{/if}
							<span class="bar" aria-hidden="true">
								<i class="known" style:width="{share(progress.known, progress.total)}%"></i>
								<i class="learning" style:width="{share(progress.learning, progress.total)}%"></i>
							</span>
						{/if}
						<span class="counts">
							{#if deck === SAVED_DECK ? saved.ready : review.common.has(deck)}
								{#if progress.known || progress.learning}
									{#if progress.known}<span><i class="key known"></i>{m.review.known(progress.known)}</span>{/if}
									{#if progress.learning}
										<span><i class="key learning"></i>{m.review.learningCount(progress.learning)}</span>
									{/if}
									<span>{m.review.toGo(progress.left)}</span>
								{:else}
									<span>{m.review.notStarted}</span>
								{/if}
							{/if}
							{#if paused}
								<button type="button" class="resume" onclick={() => pause(deck, false)}>
									{m.review.resumeShort}
								</button>
							{/if}
						</span>
						<!-- Which saved words: all, or one list. Only worth asking when there are lists. -->
						{#if deck === SAVED_DECK && savedScope && !paused && saved.lists.length}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger class="ui-btn scope">
									{savedScope === SAVED_DECK ? m.review.savedScope.all : m.review.savedScope.list(deckName(savedScope))}
									<Icon name="chevron-down" size={14} />
								</DropdownMenu.Trigger>
								<DropdownMenu.Portal>
									<DropdownMenu.Content class="ui-popover ui-menu" align="start" sideOffset={6} collisionPadding={8}>
										<DropdownMenu.RadioGroup value={savedScope} onValueChange={chooseSaved}>
											<DropdownMenu.GroupHeading class="ui-menu-heading">
												{m.review.savedScope.heading}
											</DropdownMenu.GroupHeading>
											<DropdownMenu.RadioItem class="ui-menu-item" value={SAVED_DECK}>
												{m.review.savedScope.all}
												<span class="ui-menu-count">{savedWords.length}</span>
											</DropdownMenu.RadioItem>
											{#each saved.lists as list (list.id)}
												<DropdownMenu.RadioItem class="ui-menu-item" value={listDeck(list.id)}>
													{list.name}
													<span class="ui-menu-count">{list.words.length}</span>
												</DropdownMenu.RadioItem>
											{/each}
										</DropdownMenu.RadioGroup>
									</DropdownMenu.Content>
								</DropdownMenu.Portal>
							</DropdownMenu.Root>
						{/if}
					</div>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger class="ui-icon-btn more" aria-label={m.review.deckMenu(deckName(deck))}>
							<Icon name="more" size={18} />
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content class="ui-popover ui-menu deck-menu" align="end" sideOffset={4} collisionPadding={8}>
								<DropdownMenu.Item class="ui-menu-item" onSelect={() => pause(deck, !paused)}>
									{paused ? m.review.resume : m.review.pause}
									{#if !paused}<span class="ui-menu-note">{m.review.pauseNote(begun)}</span>{/if}
								</DropdownMenu.Item>
								{#if href}
									<DropdownMenu.Item class="ui-menu-item">
										{#snippet child({ props })}
											<a {...props} {href}>{m.review.showWords}</a>
										{/snippet}
									</DropdownMenu.Item>
								{/if}
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				</li>
			{/snippet}
			<ul class="decks" aria-labelledby="new-from">
				{@render deckRow(SAVED_DECK)}
			</ul>
			<h3 class="ui-label" id="common-words">{m.review.commonHeading}</h3>
			<ul class="decks" aria-labelledby="common-words">
				{#each COMMON_DECKS as deck (deck.id)}
					{@render deckRow(deck.id)}
				{/each}
			</ul>
			<p class="muted hint">{m.review.newFromOrder}</p>
			<!-- Not built yet: shown so that the way it will go is visible -->
			<button type="button" class="ui-btn ui-btn-planned planned" disabled>
				{m.review.planned.deck} <span>{m.review.planned.note}</span>
			</button>

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
			<!-- What the choice will cost once the cards come back: from a simulation of the scheduler (decks.ts) -->
			<p class="muted hint">{m.review.goal.estimate(estimate.answers, estimate.minutes)}</p>

			<!-- The weekly goal and the if-then plan, shown on /learn (GoalCard) -->
			<h2 class="ui-label" id="weekly-goal">{m.review.goal.label}</h2>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-labelledby="weekly-goal"
				value={String(review.settings.goal_days)}
				onValueChange={(value) => review.change({ goal_days: Number(value) })}
			>
				{#each Array.from({ length: MAX_GOAL_DAYS + 1 }, (_, i) => i) as n (n)}
					<RadioGroup.Item class="ui-segment" value={String(n)}>{n || m.review.goal.none}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
			<p class="muted hint">{m.review.goal.hint}</p>

			<label class="ui-label" for="goal-plan">{m.review.goal.plan}</label>
			<input
				id="goal-plan"
				class="ui-field plan"
				type="text"
				maxlength={MAX_PLAN_LENGTH}
				autocomplete="off"
				placeholder={m.review.goal.planExample}
				value={review.settings.plan}
				onchange={(event) => review.change({ plan: cleanPlan(event.currentTarget.value) })}
			/>
			<p class="muted hint">{m.review.goal.planHint}</p>

			<h2 class="ui-label">{m.review.recall.heading}</h2>
			<ul>
				<li>
					<span class="name" id="typing">{m.review.recall.setting}</span>
					<span class="muted">{m.review.recall.settingNote}</span>
					<Switch.Root class="ui-switch" aria-labelledby="typing" checked={typingOn} onCheckedChange={setTyping}>
						<Switch.Thumb class="ui-switch-thumb" />
					</Switch.Root>
				</li>
			</ul>

			<p class="muted">{saved.signedIn ? m.review.keptAccount : m.review.kept}</p>
		</section>

		<!-- The calendar comes with the first review: before it, every count on
		     it is nought and every square empty -->
		{#if ready && (Object.keys(review.days).length || Object.keys(forecast).length)}
			<ReviewHeatmap days={review.days} {forecast} today={dayNumber(now)} />
		{/if}
	{:else if current && info}
		<div class="pile">
			{#if left > 2}<div class="ui-card under two"></div>{/if}
			{#if left > 1}<div class="ui-card under one"></div>{/if}
			{#key shown}
				<article
					class="ui-card card"
					class:dragged={drag !== 0}
					data-leaving={leaving}
					data-toward={drag < 0 ? 'left' : drag > 0 ? 'right' : undefined}
					style:transform={drag ? `translateX(${drag}px) rotate(${drag / 30}deg)` : undefined}
					{@attach swipe}
				>
					{#if typing && info.recall}
						<RecallCard
							{info}
							recall={info.recall}
							{glosses}
							{others}
							bind:step={recallStep}
							ondone={(how) => {
								recalled = how;
								flipped = true;
							}}
							onplay={play}
						/>
					{:else}
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
								{#each glosses as gloss, i (i)}<li>{gloss}</li>{/each}
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
					{/if}
				</article>
			{/key}
		</div>

		{#if flipped && ahead}
			<!-- Typed, the answer the typing suggests is the one in blue, and has
			     the focus, so Enter gives it -->
			{@const first = (node: HTMLElement) => {
				if (typing) node.focus({ preventScroll: true });
			}}
			<div class="answers">
				<button
					type="button"
					class="ui-btn answer again"
					class:ui-btn-primary={suggestion === 'again'}
					onclick={() => give(AGAIN)}
					{@attach suggestion === 'again' && first}
				>
					<span class="when">{label(ahead.again - now)}</span>
					<span class="what"><Icon name="arrow-left" size={16} />{m.review.again} <kbd class="ui-kbd">{keyLabel(keys.again)}</kbd></span>
				</button>
				<button
					type="button"
					class="ui-btn answer"
					class:ui-btn-primary={suggestion === 'good'}
					onclick={() => give(GOOD)}
					{@attach suggestion === 'good' && first}
				>
					<span class="when">{label(ahead.good - now)}</span>
					<span class="what">{m.review.good} <kbd class="ui-kbd">{keyLabel(keys.good)}</kbd><Icon name="arrow-right" size={16} /></span>
				</button>
			</div>
		{:else if typing}
			<!-- They answer the card's form (RecallCard.svelte); Enter in a field checks -->
			<div class="answers">
				<button type="submit" form="recall-answer" class="ui-btn" data-give-up>
					{recallStep === 'word' ? m.review.recall.dontKnow : m.review.show}
				</button>
				<button type="submit" form="recall-answer" class="ui-btn ui-btn-primary">
					{m.review.recall.check} <kbd class="ui-kbd">Enter</kbd>
				</button>
			</div>
		{:else}
			<div class="answers">
				<button type="button" class="ui-btn ui-btn-primary show" onclick={() => (flipped = true)}>
					{m.review.show}
				</button>
			</div>
		{/if}
		<div class="under">
			<div class="keys">
				<ReviewKeys
					{keys}
					{changing}
					onpick={(action) => (changing = changing === action ? null : action)}
					onreset={() => setKeys(DEFAULT_KEYS)}
				/>
			</div>
			{#if !typing || flipped}<span class="muted touch">{m.review.swipe}</span>{/if}
		</div>
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
		/* One column, never wider than the screen: something too wide inside it
		   wraps or shrinks instead of pushing the card past the edge */
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		max-width: var(--prose);
		padding-top: 1.75rem;
	}

	/* On a phone the title and Undo and Stop do not fit on one line: the
	   buttons go to a second, on the right */
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.6rem;
	}

	.session {
		display: flex;
		gap: 0.5rem;
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

	/* Before there is a word to review: a dashed sheet, as the Saved page has
	   before there is a word saved */
	.begin {
		padding-block: 2rem;
		border-style: dashed;
		box-shadow: none;
		color: var(--muted);
	}

	.begin p:not(.muted) {
		max-width: 26rem;
		color: var(--ink-2);
		font-size: var(--text-lg);
		text-wrap: balance;
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

	/* A deck: its tick, what it is, and a menu for the rarer things */
	.decks li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		column-gap: 0.75rem;
	}

	/* A tick, not a switch: it chooses where new words come from, and
	   turns nothing off (the reviews go on) */
	.decks input {
		display: grid;
		place-content: center;
		width: 1.3rem;
		height: 1.3rem;
		margin: 0.1rem 0 0;
		border: 1.5px solid var(--border-field);
		border-radius: var(--radius-sm);
		background: var(--surface);
		cursor: pointer;
		appearance: none;
	}

	.decks input:checked {
		border-color: var(--accent);
		background: var(--accent);
	}

	.decks input:checked::after {
		content: '';
		width: 0.8rem;
		height: 0.8rem;
		background: var(--accent-ink);
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E")
			center / contain no-repeat;
	}

	.decks input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.decks input:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.about {
		display: grid;
		justify-items: start;
		gap: 0.1rem;
	}

	.title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.title label {
		cursor: pointer;
	}

	.title label.paused {
		color: var(--muted);
	}

	.resume {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 0.15em;
		cursor: pointer;
	}

	/* How far a deck has got: known in the accent, learning paler, as on /learn */
	.bar {
		display: flex;
		width: 100%;
		height: 0.45rem;
		margin-top: 0.3rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
	}

	.known {
		background: var(--accent);
	}

	.learning {
		background: color-mix(in srgb, var(--accent) 45%, var(--surface));
	}

	.counts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		column-gap: 0.75rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.key {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		margin-right: 0.35rem;
		border-radius: var(--radius-pill);
	}

	.about :global(.scope) {
		margin-top: 0.4rem;
		font-size: var(--text-sm);
	}

	/* Level with the deck's name, not with the line under it */
	.decks :global(.more) {
		margin-top: -0.45rem;
		color: var(--muted);
	}

	/* The menu sits at the end of <body>: a long note must wrap, not stretch it */
	:global(.deck-menu) {
		max-width: min(18rem, calc(100vw - 2rem));
	}

	:global(.deck-menu a) {
		color: inherit;
		text-decoration: none;
	}

	.planned {
		justify-self: start;
	}

	.planned span {
		font-weight: 400;
	}

	.options :global(.ui-segmented) {
		justify-self: start;
		max-width: 100%;
	}

	/* The if-then plan: one line, as wide as it is likely to need */
	.plan {
		max-width: 28rem;
	}

	/* A hint belongs to the control above it, not to the next heading */
	.hint {
		margin-top: -0.5rem;
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

	/* Under a finger: it follows at once, and only sideways swipes are the
	   card's; the page still scrolls up and down */
	.card {
		touch-action: pan-y;
	}

	.card.dragged {
		transition: none;
		cursor: grabbing;
	}

	.card[data-toward='right'] {
		border-color: var(--accent);
	}

	.card[data-toward='left'] {
		border-style: dashed;
		border-color: var(--border-strong);
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

	/* The headword takes its size from this box's width (Headword.svelte), and
	   the play button goes under a word that needs the whole line */
	.front {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.25rem 0.5rem;
		text-align: center;
		container-type: inline-size;
	}

	/* The answer sits under the word, centred like it */
	.back {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
		text-align: center;
	}

	.grammar {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 0.75rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.ipa {
		font-family: var(--font-ipa);
	}

	/* The numbers stay with their lines, which are centred */
	.glosses {
		display: grid;
		gap: 0.25rem;
		padding-left: 0;
		list-style-position: inside;
		font-size: var(--text-lg);
	}

	/* One meaning needs no number */
	.glosses li:only-child {
		list-style: none;
	}

	.example {
		display: grid;
		gap: 0.15rem;
	}

	.more {
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
		opacity: 0.8;
	}

	.again .when {
		color: var(--muted);
	}

	.under {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		min-height: 2.5rem;
	}

	.touch {
		display: none;
	}

	/* No keyboard to speak of on a phone: the hint is about fingers there */
	@media (hover: none) {
		.keys,
		.answers kbd {
			display: none;
		}

		.touch {
			display: inline;
		}
	}
</style>
