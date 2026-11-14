<!-- The learner's dashboard (2026-11-13), laid out as such pages usually
     are: what to do in the wide column, who you are in the narrow one.

     Three things are learnt here and they are kept apart throughout, by name
     and by colour: words as flashcards (/review), grammar rules (/practice)
     and the letters (/alphabet). The first draft added words and rules
     together in every figure, and nobody could tell which was which.

     The wide column: a door to each of the two, saying what it has waiting;
     the next steps; what falls due and what was done; then how well each is
     held and how much of it is untouched, flashcards on one sheet and grammar
     on another. The narrow column: the streak, the letters, and the pages for
     reading (the header keeps this page's tab lit on them: Header.svelte,
     LEARN).

     Nothing new is stored for any of it: words and rules are flashcards
     (review.svelte.ts), the letters are the alphabet drill's boxes
     (alphabet.svelte.ts), and all of it is in the browser, so the server
     renders the frame and the figures arrive when the page has loaded. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { Alphabet } from '#lib/alphabet.svelte.ts';
	import { stateOf as letterState } from '#lib/alphabet/drill.ts';
	import { APOSTROPHE, LETTERS } from '#lib/alphabet/letters.ts';
	import { COMMON_WORDS } from '#lib/browse.ts';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { LESSONS } from '#lib/practice/lessons.ts';
	import { POINTS, cardKey, isPointKey } from '#lib/practice/points.ts';
	import { stateOf, type PointState } from '#lib/practice/round.ts';
	import { plan } from '#lib/review/cards.ts';
	import { keyOfDay, reviewStats } from '#lib/review/days.ts';
	import { COMMON_DECKS, SAVED_DECK, wordsOfDeck } from '#lib/review/decks.ts';
	import { DAY, REVIEW, dayNumber } from '#lib/review/fsrs.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { useSaved } from '#lib/saved.svelte.ts';
	import { useSettings } from '#lib/settings.ts';

	let { data } = $props();

	const settings = useSettings();
	const saved = useSaved();
	const review = useReview();
	// This page's own: the alphabet's progress is shared through no context
	const alphabet = new Alphabet();
	let m = $derived(messagesFor(settings.lang));
	let locale = $derived(settings.lang === 'uk' ? 'uk' : 'en-GB');

	let now = $state(Date.now());
	let today = $derived(dayNumber(now));

	onMount(() => {
		void review.load();
		// All three, switched on or not: a deck not begun is what is missing
		review.fetchDecks(COMMON_DECKS.map((deck) => deck.id));
		alphabet.load();
		const tick = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(tick);
	});

	// Until then every figure would be a nought that is not true
	let ready = $derived(review.ready && saved.ready && alphabet.ready);

	/** How many of some cards are in each state (round.ts `stateOf`, which reads a word's card as it does a rule's). */
	type Tally = Record<PointState, number>;

	function tally(keys: readonly string[]): Tally {
		const counts: Tally = { new: 0, weak: 0, learning: 0, known: 0 };
		for (const key of keys) counts[stateOf(review.cards.get(key), now)] += 1;
		return counts;
	}

	// --- Flashcards: the words ---

	let savedWords = $derived(saved.items.map((item) => item.word));
	/** The words of the decks switched on: the ones /review shows, and the header counts. */
	let deckWords = $derived(
		review.settings.decks.flatMap((deck) => wordsOfDeck(deck, savedWords, saved.lists, review.common)));
	let cardsToday = $derived(plan(review.cards, deckWords, review.settings.new_per_day, now));
	let cardsDue = $derived(cardsToday.learning.length + cardsToday.due.length);
	/** Every word that has a card, in a deck that is switched on or not. */
	let words = $derived(tally([...review.cards.keys()].filter((key) => !isPointKey(key))));

	let decks = $derived([
		...COMMON_DECKS.map((deck) => {
			const counts = tally(review.common.get(deck.id) ?? []);
			// Before the deck's words have come, its size is still known
			const total = review.common.get(deck.id)?.length ?? deck.to - deck.from + 1;
			const begun = counts.weak + counts.learning + counts.known;
			return {
				name: m.review.deck[deck.id], ...counts, new: total - begun, total,
				off: !review.settings.decks.includes(deck.id)
			};
		}),
		{
			name: m.review.deck[SAVED_DECK], ...tally(savedWords), total: savedWords.length,
			off: savedWords.length > 0 && !review.settings.decks.includes(SAVED_DECK)
		}
	]);

	// --- Grammar: the rules ---

	// A rule with no sentences is never asked (/practice leaves it out too)
	let offered = $derived(POINTS.filter((point) => data.sentences[point.id]));
	let ruleKeys = $derived(offered.map((point) => cardKey(point.id)));
	let rules = $derived(tally(ruleKeys));
	let rulesDue = $derived(ruleKeys.filter((key) => (review.cards.get(key)?.due ?? Infinity) <= now).length);

	// By lesson, as the map on /practice lays them out: "1 · Where something
	// is". By case would mean little here: a beginner does not know what a
	// locative is.
	let lessons = $derived(
		LESSONS.map((lesson, i) => ({
			name: `${i + 1} · ${m.practice.lessons[lesson.id]}`,
			keys: offered.filter((point) => lesson.points.includes(point.id))
		}))
			.filter((group) => group.keys.length)
			.map((group) => ({
				name: group.name, ...tally(group.keys.map((point) => cardKey(point.id))), total: group.keys.length, off: false
			})));

	// --- The letters ---

	// The 33 a learner has heard of: the drill also asks the apostrophe, which
	// is a sign and no letter, and "34 letters" sent a newcomer to check.
	const ALPHABET = LETTERS.filter(({ letter }) => letter !== APOSTROPHE);

	let letters = $derived.by(() => {
		const counts: Tally = { new: 0, weak: 0, learning: 0, known: 0 };
		for (const { letter } of ALPHABET) counts[letterState(alphabet.progress[letter])] += 1;
		return counts;
	});
	let lettersDone = $derived(alphabet.skipped || letters.known === ALPHABET.length);

	// --- Begun or not ---

	let wordsBegun = $derived(words.weak + words.learning + words.known > 0);
	let rulesBegun = $derived(rules.weak + rules.learning + rules.known > 0);
	// A newcomer has reviewed nothing: no card, no rule, no day. The letters
	// do not count, being the first of the newcomer's three steps. Until then
	// a dashboard is frames around noughts, and the page shows the steps instead.
	let started = $derived(wordsBegun || rulesBegun || Object.keys(review.days).length > 0);

	const FIRST_DECK = COMMON_DECKS[0].id;

	/**
	 * Before following a link to /review?start: switch on the deck of the 500
	 * commonest words, so that there the first card comes up with no deck to
	 * find and no second button. The decks keep the order /review lists them in.
	 */
	function firstWords() {
		const on = review.settings.decks;
		if (on.includes(FIRST_DECK)) return;
		const common = COMMON_DECKS.map((deck) => deck.id as string);
		review.change({
			decks: [...on.filter((id) => !common.includes(id)), ...common.filter((id) => id === FIRST_DECK || on.includes(id))]
		});
	}

	// --- What falls due, and what was done ---

	const weekday = (n: number, width: 'short' | 'narrow') =>
		new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(n * DAY);
	const dayName = (n: number) =>
		new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(n * DAY);

	/** The seven days after today: how many words and how many rules fall due on each. */
	let forecast = $derived.by(() => {
		const days = Array.from({ length: 7 }, (_, i) => ({ n: today + 1 + i, words: 0, rules: 0 }));
		const inDecks = new Set(deckWords);
		const asked = new Set(ruleKeys);
		for (const card of review.cards.values()) {
			if (card.state !== REVIEW) continue;
			const day = days[dayNumber(card.due) - today - 1];
			if (!day) continue;
			if (asked.has(card.word)) day.rules += 1;
			else if (inDecks.has(card.word)) day.words += 1;
		}
		return days;
	});
	let forecastMost = $derived(Math.max(1, ...forecast.map((day) => day.words + day.rules)));
	let forecastSum = $derived(forecast.reduce((sum, day) => sum + day.words + day.rules, 0));

	/** The fourteen days up to today. The count of a day is not kept by kind: words and rules together. */
	let done = $derived(Array.from({ length: 14 }, (_, i) => {
		const n = today - 13 + i;
		return { n, count: review.days[keyOfDay(n)] ?? 0 };
	}));
	let doneMost = $derived(Math.max(1, ...done.map((day) => day.count)));
	let doneSum = $derived(done.reduce((sum, day) => sum + day.count, 0));

	let stats = $derived(reviewStats(review.days, today));

	const share = (n: number, total: number) => (total ? (n / total) * 100 : 0);

	// A thousand is written 1,000 in English and 1000 in Ukrainian
	let thousand = $derived(settings.lang === 'uk' ? String(COMMON_WORDS) : COMMON_WORDS.toLocaleString('en'));

	// The pages for reading, each with a specimen of what it holds: how many
	// words, and the question the nominative answers (хто? що?), which is how
	// a Ukrainian school names a case.
	let places = $derived([
		{ href: '/common-words', specimen: thousand, ukrainian: false, ...m.learn.common },
		{ href: '/grammar', specimen: HINTS.nominative, ukrainian: true, ...m.learn.grammar }
	]);
</script>

<PageMeta title="{m.pageTitle.learn} · Nebokrai" description={m.meta.learn} />

<!-- A name, how much of it is known, and its bar: what is not filled is
     what the learner is missing. The bar takes its colour from the sheet it
     lies on (data-kind). -->
{#snippet bars(rows: (Tally & { name: string; total: number; off: boolean })[])}
	<ul class="rows">
		{#each rows as row (row.name)}
			<li class="row">
				<span class="name">{row.name}{#if row.off}{' '}<small>{m.learn.off}</small>{/if}</span>
				<span class="count">{!ready ? '–' : row.total ? m.learn.known(row.known, row.total) : m.learn.none}</span>
				<span class="bar" aria-hidden="true">
					{#if ready}
						<i data-state="known" style:width="{share(row.known, row.total)}%"></i>
						<i data-state="learning" style:width="{share(row.learning, row.total)}%"></i>
						<i data-state="weak" style:width="{share(row.weak, row.total)}%"></i>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet held(counts: Tally)}
	<dl class="held">
		{#each ['learning', 'weak', 'known'] as const as state (state)}
			<div data-state={state}>
				<dt>{m.learn.stage[state]}</dt>
				<dd>{ready ? counts[state] : '–'}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<div class="ui-page page" class:waiting={!ready}>
	<!-- No heading on show: the lit tab says where this is, and the doors are
	     the page's first line. Kept for those who move about by headings. -->
	<h1 class="ui-sr-only">{m.pageTitle.learn}</h1>

	<div class="main">
		{#if !started}
			<!-- A newcomer: three steps in the order to take them, and nothing
			     else. The step to take now is the one with the filled button. -->
			<section class="ui-card panel first" aria-labelledby="learn-first">
				<div>
					<h2 id="learn-first">{m.learn.first.title}</h2>
					<p class="first-lead">{m.learn.first.lead}</p>
				</div>
				<ol class="path">
					<li data-kind="alphabet" class:done={lettersDone}>
						<span class="number" aria-hidden="true">
							{#if lettersDone}<Icon name="check" size={18} />{:else}1{/if}
						</span>
						<div class="path-text">
							<h3>{m.learn.first.letters.name}</h3>
							{#if lettersDone}
								<p>
									{m.learn.first.letters.done}
									{#if alphabet.skipped}
										<button type="button" class="skip" onclick={() => alphabet.skip(false)}>
											{m.learn.first.letters.undo}
										</button>
									{/if}
								</p>
							{:else}
								<p>{m.learn.first.letters.text(ALPHABET.length)}</p>
								{#if letters.known + letters.learning > 0}
									{@render bars([{ name: m.learn.alphabet.name, ...letters, total: ALPHABET.length, off: false }])}
								{/if}
							{/if}
						</div>
						{#if !lettersDone}
							<div class="path-go">
								<a class="ui-btn ui-btn-primary" href="/alphabet">
									{m.learn.first.letters.go} <Icon name="arrow-right" size={16} />
								</a>
								<button type="button" class="skip" onclick={() => alphabet.skip(true)}>
									{m.learn.first.letters.skip}
								</button>
							</div>
						{/if}
					</li>
					<li data-kind="cards">
						<span class="number" aria-hidden="true">2</span>
						<div class="path-text">
							<h3>{m.learn.first.words.name}</h3>
							<p>{m.learn.first.words.text}</p>
						</div>
						<div class="path-go">
							<a class="ui-btn" class:ui-btn-primary={lettersDone} href="/review?start" onclick={firstWords}>
								{m.learn.first.words.go} <Icon name="arrow-right" size={16} />
							</a>
						</div>
					</li>
					<li data-kind="grammar">
						<span class="number" aria-hidden="true">3</span>
						<div class="path-text">
							<h3>{m.learn.first.grammar.name}</h3>
							<p>{m.learn.first.grammar.text}</p>
						</div>
						<div class="path-go">
							<a class="ui-btn" href="/practice">{m.learn.first.grammar.go} <Icon name="arrow-right" size={16} /></a>
						</div>
					</li>
				</ol>
			</section>
		{:else}
		<!-- The two doors. One not yet begun says so, and what it is, in
		     place of a count of nothing. -->
		<div class="doors">
			<a
				class="ui-card door"
				data-kind="cards"
				href={wordsBegun ? '/review' : '/review?start'}
				onclick={wordsBegun ? undefined : firstWords}
			>
				<span class="kind"><Icon name="cards" size={16} /> {m.learn.kind.cards}</span>
				<strong>
					{!wordsBegun
						? m.learn.action.notStarted
						: cardsDue ? m.learn.action.cardsDue(cardsDue) : m.learn.action.cardsNone}
				</strong>
				<span class="sub">
					{wordsBegun && cardsToday.fresh.length
						? m.learn.action.cardsNew(cardsToday.fresh.length)
						: m.learn.action.cardsAbout}
				</span>
				<span class="go">
					{wordsBegun ? m.learn.action.cardsGo : m.learn.first.words.go} <Icon name="arrow-right" size={16} />
				</span>
			</a>
			<a class="ui-card door" data-kind="grammar" href="/practice">
				<span class="kind">{m.learn.kind.grammar}</span>
				<strong>
					{!rulesBegun
						? m.learn.action.notStarted
						: rulesDue ? m.learn.action.rulesDue(rulesDue) : m.learn.action.rulesNone}
				</strong>
				<span class="sub">
					{rulesBegun ? m.learn.action.rulesSplit(rules.weak, rules.new) : m.learn.action.rulesAbout(ruleKeys.length)}
				</span>
				<span class="go">{m.learn.action.rulesGo} <Icon name="arrow-right" size={16} /></span>
			</a>
		</div>

		<!-- What falls due and what was done: two small charts, each headed by
		     its name and its sum on one line -->
		<div class="pair">
			<section class="ui-card inset" aria-labelledby="learn-forecast">
				<div class="inset-head">
					<h2 id="learn-forecast">{m.learn.forecast}</h2>
					<p class="sum">{m.learn.nextWeek(forecastSum)}</p>
					<p class="legend" aria-hidden="true">
						<span data-kind="cards"><i></i>{m.learn.kind.cards}</span>
						<span data-kind="grammar"><i></i>{m.learn.kind.grammar}</span>
					</p>
				</div>
					<ol class="chart">
						{#each forecast as day (day.n)}
							<li title="{dayName(day.n)}: {m.learn.words(day.words)}, {m.learn.rules(day.rules)}">
								<span class="stack">
									{#if ready && day.rules}
										<i data-kind="grammar" style:height="{(day.rules / forecastMost) * 100}%"></i>
									{/if}
									{#if ready && day.words}
										<i data-kind="cards" style:height="{(day.words / forecastMost) * 100}%"></i>
									{/if}
								</span>
								<span class="tick" aria-hidden="true">{weekday(day.n, 'short')}</span>
								<span class="ui-sr-only">
									{dayName(day.n)}: {m.learn.words(day.words)}, {m.learn.rules(day.rules)}
								</span>
							</li>
						{/each}
					</ol>
			</section>
			<section class="ui-card inset" aria-labelledby="learn-activity">
				<div class="inset-head">
					<h2 id="learn-activity">{m.learn.activity}</h2>
					<p class="sum">{m.learn.lastWeeks(doneSum)}</p>
				</div>
					<ol class="chart">
						{#each done as day (day.n)}
							<li
								title={day.count
									? m.review.heatmap.reviewed(day.count, dayName(day.n))
									: m.review.heatmap.none(dayName(day.n))}
							>
								<span class="stack">
									{#if ready && day.count}<i style:height="{(day.count / doneMost) * 100}%"></i>{/if}
								</span>
								<span class="tick" class:today={day.n === today} aria-hidden="true">{weekday(day.n, 'narrow')}</span>
								<span class="ui-sr-only">
									{day.count
										? m.review.heatmap.reviewed(day.count, dayName(day.n))
										: m.review.heatmap.none(dayName(day.n))}
								</span>
							</li>
						{/each}
					</ol>
			</section>
		</div>

		<!-- How well each kind is held, and how much of it is untouched: a
		     sheet for each, its three figures on the line of its name. The
		     bars' key lies under both, said once. -->
		<h2 class="ui-sr-only">{m.learn.progress}</h2>
		<div class="pair">
			<section class="ui-card inset" data-kind="cards" aria-labelledby="learn-cards">
				<div class="inset-head">
					<h3 class="kind" id="learn-cards"><Icon name="cards" size={16} /> {m.learn.kind.cards}</h3>
					{@render held(words)}
				</div>
				{@render bars(decks)}
			</section>
			<section class="ui-card inset" data-kind="grammar" aria-labelledby="learn-grammar">
				<div class="inset-head">
					<h3 class="kind" id="learn-grammar">{m.learn.kind.grammar}</h3>
					{@render held(rules)}
				</div>
				{@render bars(lessons)}
			</section>
		</div>
		<p class="legend key" aria-hidden="true">
			<span data-state="known"><i></i>{m.learn.stage.known}</span>
			<span data-state="learning"><i></i>{m.learn.stage.learning}</span>
			<span data-state="weak"><i></i>{m.learn.stage.weak}</span>
			<span data-state="new"><i></i>{m.learn.notStarted}</span>
		</p>
		{/if}
	</div>

	<aside class="side">
		{#if started}
		<section class="ui-card panel" aria-labelledby="learn-streak">
			<h2 class="ui-sr-only" id="learn-streak">{m.review.heatmap.streak}</h2>
			<p class="streak">
				<span class="figure">{ready ? stats.streak : '–'}</span>
				<span>{m.review.heatmap.streak}</span>
			</p>
			<!-- The last seven days, today at the right: a flame burns where
			     something was reviewed, and is an outline where nothing was. The
			     colours are drawn once here, red at the tip and amber below, and
			     each flame takes them by name. -->
			<svg class="defs" aria-hidden="true">
				<defs>
					<linearGradient id="learn-flame" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" style="stop-color: var(--flame-tip)" />
						<stop offset="70%" style="stop-color: var(--flame)" />
					</linearGradient>
				</defs>
			</svg>
			<ol class="week">
				{#each done.slice(-7) as day (day.n)}
					<li
						class:lit={ready && day.count > 0}
						class:today={day.n === today}
						title={day.count
							? m.review.heatmap.reviewed(day.count, dayName(day.n))
							: m.review.heatmap.none(dayName(day.n))}
					>
						<!-- The header's flame (Header.svelte), one for each day -->
						<svg class="flame" viewBox="1 -2 22 26" aria-hidden="true">
							<path
								class="body"
								fill="url(#learn-flame)"
								d="M13 1c.6 3.2 3 4.9 4.7 7.2 1.4 1.9 2.3 4 2.3 6.3A8 8 0 0 1 4 14.5c0-2.6 1.1-4.9 2.7-6.6.3 1.6 1 2.7 2.2 3.3C8.6 7.6 10 3.6 13 1z"
							/>
						</svg>
						<span aria-hidden="true">{weekday(day.n, 'short')}</span>
					</li>
				{/each}
			</ol>
			<dl class="totals">
				<div><dt>{m.review.heatmap.learned}</dt><dd>{ready ? stats.daysLearned : '–'}</dd></div>
				<div><dt>{m.review.heatmap.longest}</dt><dd>{ready ? stats.longest : '–'}</dd></div>
				<div><dt>{m.learn.reviews}</dt><dd>{ready ? stats.total : '–'}</dd></div>
			</dl>
		</section>

		{/if}

		{#if started}
		<section class="ui-card panel" data-kind="alphabet" aria-labelledby="learn-alphabet">
			<div class="inset-head">
				<h2 class="kind" id="learn-alphabet"><span class="gap" lang="uk" aria-hidden="true">Аа</span> {m.learn.kind.alphabet}</h2>
				<a class="more" href="/alphabet">{m.learn.alphabet.go} <Icon name="arrow-right" size={14} /></a>
			</div>
			<!-- Ticked, the bar goes: it would show as unfinished what the learner
			     has said is done. What the drill recorded is kept for unticking. -->
			{#if !alphabet.skipped}
				{@render bars([{ name: m.learn.alphabet.name, ...letters, total: ALPHABET.length, off: false }])}
			{/if}
			<label class="choice">
				<input
					type="checkbox"
					checked={alphabet.skipped}
					disabled={!ready}
					onchange={(event) => alphabet.skip(event.currentTarget.checked)}
				/>
				{m.learn.lettersKnown}
			</label>
		</section>
		{/if}

		<section class="ui-card panel" aria-labelledby="learn-places">
			<h2 id="learn-places">{m.learn.places}</h2>
			<ul class="places">
				{#each places as place (place.href)}
					<li>
						<a href={place.href}>
							<span class="specimen" lang={place.ukrainian ? 'uk' : undefined} aria-hidden="true">{place.specimen}</span>
							<span class="place-name">{place.name}</span>
							<span class="place-text">{place.text}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Where all this is kept, for someone who has no account to keep it in -->
		{#if !saved.signedIn}
			<p class="kept">{m.review.kept}</p>
		{/if}
	</aside>
</div>

<style>
	/* As wide as the header, in two columns: what to do, and who you are */
	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19rem;
		grid-template-areas: 'main side';
		align-items: start;
		gap: 0.9rem;
		max-width: var(--frame-width);
		padding-block: 1.25rem 2rem;
	}

	.main,
	.side {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.6rem;
	}

	.main {
		grid-area: main;
	}

	/* Which of the two faces to show, the newcomer's steps or the dashboard,
	   is known only when the browser's progress has been read: until then
	   neither is shown, so that a learner of months does not see "Start here"
	   flash by. Shown after two seconds whatever happens, for a browser
	   where the script never runs. */
	.waiting .main,
	.waiting .side {
		opacity: 0;
		animation: appear 0s 2s forwards;
	}

	@keyframes appear {
		to {
			opacity: 1;
		}
	}

	/* --- The newcomer's three steps --- */

	.first {
		gap: 1rem;
		padding: 1.2rem 1.25rem 1.25rem;
	}

	.first h2 {
		font-size: var(--title);
	}

	.first-lead {
		max-width: 38rem;
		margin-top: 0.35rem;
		color: var(--ink-2);
		font-size: var(--text-lg);
		line-height: 1.45;
	}

	.path {
		display: grid;
		gap: 0.75rem;
	}

	/* A number in the kind's colour, what the step is, and its button */
	.path > li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.6rem 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		border-left: 5px solid var(--kind);
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}

	.number {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--kind);
		border-radius: 50%;
		font-family: var(--font-headword);
		font-weight: 800;
	}

	.path-text {
		display: grid;
		gap: 0.25rem;
	}

	.path h3 {
		font-family: var(--font-heading);
		font-size: 1.25rem;
	}

	.path p {
		color: var(--ink-2);
		line-height: 1.45;
	}

	.path-go {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
	}

	/* Done: put back, its number a tick */
	.path > .done {
		background: none;
	}

	.path > .done h3 {
		color: var(--muted);
	}

	.kept {
		padding-inline: 0.25rem;
		color: var(--on-page);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.side {
		grid-area: side;
	}

	p,
	dl,
	dd,
	ol,
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* --- The colours. A kind has one colour wherever it appears; within a
	   kind, what is known is that colour, what is being learnt a tint of it,
	   and what is shaky is gold on every sheet. --- */

	[data-kind='cards'] {
		--kind: var(--accent);
	}

	[data-kind='grammar'] {
		--kind: var(--pill-1-line);
	}

	[data-kind='alphabet'] {
		--kind: var(--pill-3-line);
	}

	[data-state='known'] {
		--state: var(--kind, var(--ink-2));
	}

	[data-state='learning'] {
		--state: color-mix(in srgb, var(--kind, var(--ink-2)) 42%, var(--surface-2));
	}

	[data-state='weak'] {
		--state: var(--gold);
	}

	/* --- Sheets --- */

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.6rem;
		padding: 0.8rem 0.9rem 0.9rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		font-weight: 700;
		line-height: 1.25;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.3;
	}

	/* A sheet's name, and beside it what there is to say in a few words */
	.inset-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.75rem;
	}

	.inset-head > :last-child:not(:first-child) {
		margin-left: auto;
	}

	/* The name of a kind, with its mark, in its colour's company: a square
	   of the colour before it, so that the name itself stays ink */
	.kind {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--ink);
		font-family: var(--font-text);
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.kind::before {
		content: '';
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 3px;
		background: var(--kind);
	}

	.gap {
		color: var(--muted);
		font-family: var(--font-headword);
		font-weight: 800;
		white-space: nowrap;
	}

	.go,
	.more {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}

	/* --- The two doors: a kind, what it has waiting, and its button, in
	   two lines. The line under the count runs the door's whole width, so
	   that the button beside the count does not squeeze it into a column
	   (2026-11-13: it had, and the doors stood five lines tall). --- */

	.doors,
	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.door {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'kind go' 'big go' 'sub sub';
		align-items: center;
		gap: 0 0.75rem;
		padding: 0.6rem 0.8rem 0.65rem;
		border-left: 5px solid var(--kind);
		color: inherit;
		text-decoration: none;
	}

	.door .kind {
		grid-area: kind;
		font-size: var(--text-xs);
	}

	.door strong {
		grid-area: big;
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.door .sub {
		grid-area: sub;
		color: var(--ink-2);
		font-size: var(--text-sm);
		line-height: 1.35;
	}

	.door .go {
		grid-area: go;
		padding: 0.35rem 0.65rem;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: var(--accent-ink);
		white-space: nowrap;
	}

	.skip {
		position: relative;
		padding: 0.1rem 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.choice {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.choice input {
		width: 1rem;
		height: 1rem;
		margin: 0;
		accent-color: var(--accent);
	}

	/* --- A small sheet: a chart, or one kind's progress --- */

	.inset {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 0.5rem;
		padding: 0.65rem 0.8rem 0.75rem;
	}

	.inset[data-kind] {
		border-top: 4px solid var(--kind);
	}

	.sum {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.8rem;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.legend i {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 3px;
		background: var(--state, var(--kind, var(--surface-2)));
		box-shadow: inset 0 0 0 1px var(--border);
	}

	/* The bars' key, straight on the page under the two sheets it explains */
	.key {
		justify-content: flex-end;
		margin-top: -0.2rem;
		padding-inline: 0.25rem;
		color: var(--on-page);
	}

	/* Columns standing on one line: a day each, the taller the more. Two
	   kinds stand one on the other with a gap of the ground between them. */
	.chart {
		display: flex;
		gap: 2px;
	}

	.chart li {
		display: grid;
		flex: 1;
		justify-items: center;
		gap: 0.2rem;
		min-width: 0;
	}

	.stack {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 2px;
		width: 100%;
		height: 2.75rem;
		border-bottom: 1px solid var(--border-strong);
	}

	.stack i {
		width: min(100%, 1.5rem);
		min-height: 3px;
		margin-inline: auto;
		background: var(--kind, var(--ink-2));
	}

	.stack i:first-child {
		border-radius: 4px 4px 0 0;
	}

	.tick {
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1;
	}

	.tick.today {
		color: var(--ink);
		font-weight: 700;
	}

	/* --- How well a kind is held: three figures on the line of its name,
	   each after a square of its state's colour --- */

	.held {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.8rem;
	}

	.held div {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
	}

	.held div::before {
		content: '';
		align-self: center;
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 3px;
		background: var(--state);
	}

	.held dt {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	.held dd {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.figure {
		font-family: var(--font-headword);
		font-size: 1.5rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1.15;
	}

	/* --- The bars --- */

	.rows {
		display: grid;
		gap: 0.4rem;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'name count' 'bar bar';
		align-items: baseline;
		gap: 0.15rem 0.75rem;
	}

	.name {
		grid-area: name;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	/* "not switched on", after a deck's name */
	.name small {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 400;
	}

	.count {
		grid-area: count;
		color: var(--ink-2);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		grid-area: bar;
		display: flex;
		height: 0.45rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.bar i {
		background: var(--state);
	}

	/* --- The narrow column --- */

	.streak {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.streak .figure {
		color: var(--ink);
		font-size: 2.1rem;
	}

	.week {
		display: flex;
		justify-content: space-between;
	}

	.week li {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
		color: var(--muted);
		font-size: var(--text-xs);
	}

	/* Holds the flames' colours and takes no room */
	.defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	.flame {
		width: 1.5rem;
		height: 1.77rem;
		overflow: visible;
	}

	/* A day with no review: the flame's outline, as in the header */
	.week li:not(.lit) .body {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	.week .today {
		color: var(--ink);
		font-weight: 700;
	}

	/* Today, not yet kept: still to be lit */
	.week .today:not(.lit) .body {
		stroke: var(--muted);
		stroke-dasharray: 3 2.5;
	}

	/* Today's flame flickers, swaying from its foot; the days behind it
	   burn still, or seven of them would be a distraction */
	.week .today.lit .body {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: flame-sway 1.7s ease-in-out infinite alternate;
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

	@media (prefers-reduced-motion: reduce) {
		.week .today.lit .body {
			animation: none;
		}
	}

	.totals {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--border);
	}

	.totals dt {
		color: var(--muted);
		font-size: var(--text-xs);
		line-height: 1.25;
	}

	.totals dd {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.totals div {
		display: flex;
		flex-direction: column-reverse;
		justify-content: flex-end;
	}

	.places {
		display: grid;
		gap: 0.3rem;
	}

	.places a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'name specimen' 'text text';
		align-items: baseline;
		gap: 0.1rem 0.6rem;
		margin-inline: -0.5rem;
		padding: 0.45rem 0.5rem;
		border-radius: var(--radius-md);
		color: inherit;
		text-decoration: none;
	}

	.place-name {
		grid-area: name;
		color: var(--accent);
		font-weight: 600;
	}

	.specimen {
		grid-area: specimen;
		color: var(--muted);
		font-family: var(--font-headword);
		font-weight: 800;
		white-space: nowrap;
	}

	.place-text {
		grid-area: text;
		color: var(--ink-2);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	@media (hover: hover) {
		.door:hover {
			border-color: var(--accent);
		}

		/* The door's own edge keeps its kind's colour */
		.door:hover {
			border-left-color: var(--kind);
		}

		.door:hover .go {
			background: var(--link-hover);
		}

		.places a:hover {
			background: var(--surface-2);
		}

		.skip:hover {
			color: var(--ink);
		}
	}

	/* Too narrow for the second column beside the first: it goes under it,
	   its sheets side by side while there is room for that */
	@media (max-width: 980px) {
		.page {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'main' 'side';
		}

		.side {
			grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
			align-items: start;
		}
	}

	/* A phone: everything one under another */
	@media (max-width: 640px) {
		.page {
			gap: 0.75rem;
			padding-top: 0.9rem;
		}

		.main,
		.side {
			gap: 0.75rem;
		}

		.doors,
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}

		.panel {
			padding: 0.8rem 0.8rem 0.9rem;
		}

		/* The button under what it is for */
		.path > li {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.path-go {
			grid-column: 2;
			justify-items: start;
		}
	}
</style>
