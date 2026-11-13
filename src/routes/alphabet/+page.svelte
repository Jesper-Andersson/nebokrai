<!-- The alphabet trainer: learning to read Ukrainian letters. The letters stand
     in six groups (LetterChart.svelte); the learner switches on the groups to
     practise and starts a round of twenty prompts (AlphabetDrill.svelte): a
     letter, or a common word spelt with those letters alone, to be answered
     in Latin letters by choosing or by typing, or a letter the other way
     round. A letter missed comes back two prompts later and is asked oftener
     until it is known. The rules are in src/lib/alphabet/drill.ts; what is
     remembered stays in this browser (alphabet.svelte.ts).

     The words are the 1,000 commonest, from the decks of the flashcards
     (/api/review/deck); a word's stress, meaning and recording come from
     /api/words/cards when it is asked. -->
<script lang="ts">
	import { RadioGroup, Switch } from 'bits-ui';
	import { onMount } from 'svelte';
	import AlphabetDrill from '#lib/AlphabetDrill.svelte';
	import Headword from '#lib/Headword.svelte';
	import LetterChart from '#lib/LetterChart.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { Alphabet } from '#lib/alphabet.svelte.ts';
	import { reading } from '#lib/alphabet/answers.ts';
	import {
		MIN_WORDS, ROUND, byChoice, choices, finished, grade, isRight, knownAmong, newRound, next, poolFor, readable,
		type Options, type Pool, type Prompt, type Round
	} from '#lib/alphabet/drill.ts';
	import { LETTERS, letterInfo, lettersOf, pair, type GroupId } from '#lib/alphabet/letters.ts';
	import { RECORDINGS, RECORDINGS_CREDIT } from '#lib/alphabet/recordings.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useRadio } from '#lib/radio.svelte.ts';
	import { COMMON_DECKS } from '#lib/review/decks.ts';
	import { useReview } from '#lib/review.svelte.ts';
	import { wordPath } from '#lib/search/slug.ts';
	import type { WordCard } from '#lib/search/word.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	const review = useReview();
	const radio = useRadio();
	const alphabet = new Alphabet();
	let m = $derived(messagesFor(settings.lang));

	// The words to read: the flashcards' decks of common words up to the
	// thousandth, which the review page fetches too and the server caches.
	const WORD_DECKS = COMMON_DECKS.filter((deck) => deck.to <= 1000).map((deck) => deck.id as string);

	onMount(() => {
		alphabet.load();
		review.fetchDecks(WORD_DECKS);
	});

	/** Commonest first; null until every deck has come. */
	let words = $derived(
		WORD_DECKS.every((id) => review.common.has(id)) ? WORD_DECKS.flatMap((id) => review.common.get(id) ?? []) : null);

	let options = $derived(alphabet.options);
	let letters = $derived(lettersOf(options.groups));
	let canRead = $derived(words ? readable(words, letters).length : null);

	// --- A round ---

	let stage = $state<'setup' | 'drill' | 'summary'>('setup');
	let round = $state.raw<Round>(newRound());
	/** What the round draws on: fixed when it starts. */
	let pool = $state.raw<Pool>({ letters: [], words: [] });
	let prompt = $state.raw<Prompt | null>(null);
	let offered = $state.raw<string[]>([]);
	let result = $state.raw<{ correct: boolean; given: string } | null>(null);
	/** Counts the prompts shown, so that each has a drill of its own. */
	let shown = $state(0);

	/** What the dictionary has for the words asked. */
	let cards = $state.raw(new Map<string, WordCard>());
	const asked = new Set<string>();

	async function fetchCard(word: string) {
		if (asked.has(word)) return;
		asked.add(word);
		try {
			const res = await fetch('/api/words/cards', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ words: [word] })
			});
			if (!res.ok) throw new Error(String(res.status));
			const found: WordCard[] = (await res.json()).words;
			cards = new Map([...cards, ...found.map((card) => [card.word, card] as const)]);
		} catch {
			// The word is still asked and answered; only its meaning and recording are missing.
			asked.delete(word);
		}
	}

	// A letter answered rightly needs no reading: the next one comes by itself.
	const MOVE_ON_MS = 800;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function ask() {
		clearTimeout(timer);
		prompt = next(round, pool, alphabet.progress, Math.random);
		offered = byChoice(prompt, options) ? choices(prompt, options.direction, pool, Math.random) : [];
		result = null;
		shown += 1;
		if (prompt.kind === 'word') void fetchCard(prompt.item);
	}

	function start() {
		pool = poolFor(options, words ?? []);
		round = newRound();
		stage = 'drill';
		ask();
	}

	function stop() {
		clearTimeout(timer);
		stage = 'setup';
		prompt = null;
		result = null;
	}

	/** The recording of what is asked: a letter's own, or the word's from the dictionary. */
	function soundOf(of: Prompt): string | undefined {
		return of.kind === 'word' ? (cards.get(of.item)?.audio_url ?? undefined) : RECORDINGS[of.item];
	}

	// The radio (RadioPlayer.svelte) may be playing: it is turned down while the recording sounds.
	function play(url: string) {
		const done = radio.duck();
		const audio = new Audio(url);
		audio.addEventListener('ended', done);
		audio.addEventListener('error', done);
		audio.play().catch(done);
	}

	function answer(given: string) {
		if (!prompt || result) return;
		const correct = isRight(prompt, options, given);
		const after = grade(round, alphabet.progress, prompt, correct);
		round = after.round;
		alphabet.remember(after.progress);
		result = { correct, given };
		const url = soundOf(prompt);
		if (options.sound && url) play(url);
		if (correct && prompt.kind === 'letter') timer = setTimeout(goOn, MOVE_ON_MS);
	}

	function goOn() {
		clearTimeout(timer);
		if (stage !== 'drill' || !result) return;
		if (finished(round)) {
			stage = 'summary';
			prompt = null;
			result = null;
		} else ask();
	}

	onMount(() => () => clearTimeout(timer));

	function toggleGroup(group: GroupId, on: boolean) {
		alphabet.change({ groups: on ? [...options.groups, group] : options.groups.filter((id) => id !== group) });
	}

	function forget() {
		if (confirm(m.alphabet.forgetConfirm)) alphabet.forget();
	}

	const ALL = LETTERS.map((letter) => letter.letter);
	// A segment's value is one of the choices' own; alphabet.change reads it as it reads storage.
	const set = (name: 'answer' | 'direction' | 'content') => (value: string) =>
		alphabet.change({ [name]: value } as Partial<Options>);
</script>

<PageMeta title="{m.pageTitle.alphabet} · Nebokrai" description={m.meta.alphabet} />

<div class="ui-page page">
	<header>
		<h1 class="ui-title">{m.pageTitle.alphabet}</h1>
		{#if stage === 'drill'}
			<span class="ui-badge">{m.alphabet.count(result ? round.asked : round.asked + 1, ROUND)}</span>
			<span class="session">
				<button type="button" class="ui-btn" onclick={stop}>{m.alphabet.stop}</button>
			</span>
		{/if}
	</header>

	{#if stage === 'setup'}
		<p class="lead">{m.alphabet.lead}</p>

		<section class="ui-card today" aria-busy={!alphabet.ready}>
			<p class="chosen">{m.alphabet.chosen(letters.length)}</p>
			<p class="muted">{alphabet.ready ? m.alphabet.known(knownAmong(alphabet.progress, ALL), ALL.length) : '–'}</p>
			<button type="button" class="ui-btn ui-btn-primary" disabled={!alphabet.ready} onclick={start}>
				{m.alphabet.start}
			</button>
		</section>

		<section class="ui-card options">
			<h2 class="ui-label" id="alphabet-answer">{m.alphabet.answerLabel}</h2>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-labelledby="alphabet-answer"
				value={options.answer}
				onValueChange={set('answer')}
			>
				<RadioGroup.Item class="ui-segment" value="choice">{m.alphabet.answer.choice}</RadioGroup.Item>
				<RadioGroup.Item class="ui-segment" value="type">{m.alphabet.answer.type}</RadioGroup.Item>
			</RadioGroup.Root>

			<h2 class="ui-label" id="alphabet-direction">{m.alphabet.directionLabel}</h2>
			<RadioGroup.Root
				class="ui-segmented"
				orientation="horizontal"
				aria-labelledby="alphabet-direction"
				value={options.direction}
				onValueChange={set('direction')}
			>
				<RadioGroup.Item class="ui-segment" value="read">{m.alphabet.direction.read}</RadioGroup.Item>
				<RadioGroup.Item class="ui-segment" value="write">{m.alphabet.direction.write}</RadioGroup.Item>
			</RadioGroup.Root>
			<p class="muted">{m.alphabet.directionNote[options.direction]}</p>

			{#if options.direction === 'read'}
				<h2 class="ui-label" id="alphabet-content">{m.alphabet.contentLabel}</h2>
				<RadioGroup.Root
					class="ui-segmented"
					orientation="horizontal"
					aria-labelledby="alphabet-content"
					value={options.content}
					onValueChange={set('content')}
				>
					<RadioGroup.Item class="ui-segment" value="letters">{m.alphabet.content.letters}</RadioGroup.Item>
					<RadioGroup.Item class="ui-segment" value="words">{m.alphabet.content.words}</RadioGroup.Item>
					<RadioGroup.Item class="ui-segment" value="both">{m.alphabet.content.both}</RadioGroup.Item>
				</RadioGroup.Root>
				<p class="muted" role="status">
					{#if canRead === null}
						{m.alphabet.wordsLoading}
					{:else if canRead < MIN_WORDS && options.content !== 'letters'}
						{m.alphabet.wordsTooFew(canRead)}
					{:else}
						{m.alphabet.wordsCount(canRead)}
					{/if}
				</p>
			{/if}

			<label class="switch">
				<span id="alphabet-sound">{m.alphabet.sound}</span>
				<Switch.Root
					class="ui-switch"
					aria-labelledby="alphabet-sound"
					checked={options.sound}
					onCheckedChange={(sound) => alphabet.change({ sound })}
				>
					<Switch.Thumb class="ui-switch-thumb" />
				</Switch.Root>
			</label>
		</section>

		<h2 class="ui-label on-page">{m.alphabet.letters}</h2>
		<LetterChart
			progress={alphabet.progress}
			chosen={options.groups}
			ontoggle={toggleGroup}
			onplay={play}
		/>

		<p class="muted kept">
			{m.alphabet.recordings}
			<a href={RECORDINGS_CREDIT.category}>{RECORDINGS_CREDIT.author}</a>,
			<a href={RECORDINGS_CREDIT.licenceUrl}>{RECORDINGS_CREDIT.licence}</a>, {m.alphabet.commons}.
		</p>
		<p class="muted kept">
			{m.alphabet.kept}
			{#if Object.keys(alphabet.progress).length}
				<button type="button" class="link" onclick={forget}>{m.alphabet.forget}</button>
			{/if}
		</p>
	{:else if stage === 'drill' && prompt}
		<dl class="score">
			<div><dt>{m.alphabet.right}</dt><dd>{round.right}</dd></div>
			<div><dt>{m.alphabet.wrong}</dt><dd>{round.wrong}</dd></div>
			<div><dt>{m.alphabet.streak}</dt><dd>{round.streak}</dd></div>
		</dl>

		{#key shown}
			<AlphabetDrill
				{prompt}
				direction={options.direction}
				choice={byChoice(prompt, options)}
				{offered}
				{result}
				card={prompt.kind === 'word' ? cards.get(prompt.item) : undefined}
				sound={soundOf(prompt)}
				check={(typed) => prompt !== null && isRight(prompt, options, typed)}
				onanswer={answer}
				onnext={goOn}
				onplay={play}
			/>
		{/key}
	{:else}
		<section class="ui-card end" role="status">
			<h2>{m.alphabet.done}</h2>
			<p>{m.alphabet.score(round.right, round.asked)} {m.alphabet.best(round.best)}</p>
			{#if round.missed.length}
				<h3 class="ui-label">{m.alphabet.missed}</h3>
				<ul class="missed">
					{#each round.missed as missed (missed.kind + missed.item)}
						<li>
							{#if missed.kind === 'letter'}
								{@const info = letterInfo(missed.item)}
								<span class="letter" lang="uk">{pair(missed.item)}</span>
								<span>{info?.latin || m.alphabet.sign[missed.item]}</span>
							{:else}
								<Headword text={cards.get(missed.item)?.headword ?? missed.item} size="sm" href={wordPath(missed.item)} />
								<span>{reading(missed.item)}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">{m.alphabet.allRight}</p>
			{/if}
			<div class="answers">
				<button type="button" class="ui-btn" onclick={stop}>{m.alphabet.back}</button>
				<button type="button" class="ui-btn ui-btn-primary" onclick={start}>{m.alphabet.again}</button>
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		display: grid;
		/* One column, never wider than the screen: something too wide inside it
		   wraps or shrinks instead of pushing the card past the edge */
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		max-width: var(--prose);
		padding-top: 1.75rem;
	}

	/* On a phone the title, the count and Stop do not fit on one line: Stop goes to the right of a second */
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
	h3,
	dl,
	dd,
	ul {
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

	.chosen {
		font-family: var(--font-heading);
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.options :global(.ui-segmented) {
		justify-self: start;
		max-width: 100%;
	}

	.switch {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	/* A heading straight on the page, between the cards */
	.on-page {
		margin-top: 0.5rem;
		color: var(--on-page);
	}

	.kept {
		color: var(--on-page);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	/* The round so far, over the card */
	.score {
		justify-content: center;
		text-align: center;
	}

	.score dd {
		font-size: var(--text-lg);
		font-weight: 700;
	}

	.end h2 {
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	.end .ui-label {
		width: 100%;
	}

	.missed {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem 1.5rem;
		padding: 0;
		list-style: none;
	}

	.missed li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.missed .letter {
		font-family: var(--font-headword);
		font-size: var(--headword-sm);
		font-weight: 800;
	}

	.answers {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}
</style>
