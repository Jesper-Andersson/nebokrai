// Review cards outside the scheduler (src/lib/review/cards.ts, decks.ts):
// reading them defensively, joining two copies, and what to show next.
// Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeCards, nextUp, parseCards, plan, span } from '../src/lib/review/cards.ts';
import { DEFAULT_SETTINGS, listDeck, listOfDeck, parseSettings, wordsOfDeck } from '../src/lib/review/decks.ts';
import {
	AGAIN, DAY, GOOD, MINUTE, NEW, REVIEW, answer, newCard, type Rating, type ReviewCard
} from '../src/lib/review/fsrs.ts';

// Midday local time: no step here crosses 04:00.
const T0 = new Date(2026, 10, 12, 12, 0).getTime();

/** A card answered with each rating in turn, every answer at the card's due time. */
function reviewed(word: string, ratings: Rating[], start = T0): ReviewCard {
	let card = newCard(word, start);
	let now = start;
	for (const rating of ratings) {
		card = answer(card, rating, now);
		now = card.due;
	}
	return card;
}

const byWord = (cards: ReviewCard[]) => new Map(cards.map((card) => [card.word, card]));

test('parseCards keeps well-formed cards and drops the rest', () => {
	const good = reviewed('вода', [GOOD, GOOD]);
	assert.deepEqual(parseCards([good], T0 + DAY), [good]);
	assert.deepEqual(parseCards('nonsense'), []);
	const bad = [
		null, 'вода', { ...good, word: '' }, { ...good, word: 'я'.repeat(101) }, { ...good, stability: 0 },
		{ ...good, stability: Infinity }, { ...good, difficulty: 11 }, { ...good, state: NEW }, { ...good, state: 4 },
		{ ...good, reps: 0 }, { ...good, lapses: good.reps + 1 }, { ...good, due: 'tomorrow' }, { ...good, step: -1 }
	];
	assert.deepEqual(parseCards(bad, T0 + DAY), []);
	// The same word twice: the first is kept.
	assert.equal(parseCards([good, { ...good, reps: 9 }], T0 + DAY).length, 1);
	assert.equal(parseCards([good, reviewed('хліб', [GOOD])], T0 + DAY, 1).length, 1);
});

test('parseCards does not believe a clock that runs ahead', () => {
	const card = reviewed('вода', [GOOD]);
	const ahead = { ...card, last_review: T0 + 30 * DAY, due: T0 + 31 * DAY, added_at: T0 + 30 * DAY };
	const [read] = parseCards([ahead], T0);
	assert.deepEqual([read.last_review, read.added_at], [T0, T0]);
	// A due time before the review, or centuries on, is brought into range.
	assert.equal(parseCards([{ ...card, due: 1 }], T0 + DAY)[0].due, card.last_review);
});

test('mergeCards keeps the copy reviewed later', () => {
	const once = reviewed('вода', [GOOD]);
	const twice = answer(once, GOOD, once.due);
	const bread = reviewed('хліб', [AGAIN]);
	assert.deepEqual(mergeCards([once, bread], [twice]), byWord([twice, bread]));
	assert.deepEqual(mergeCards([twice], [once, bread]), byWord([twice, bread]));
	// Reviewed at the same moment: the copy with more answers.
	assert.equal(mergeCards([once], [{ ...once, reps: 2 }]).get('вода')?.reps, 2);
});

test('plan: learning steps, then what is due, then new words up to the limit', () => {
	const due = reviewed('вода', [GOOD, GOOD], T0 - 3 * DAY); // in review, due about a day ago
	const later = reviewed('хліб', [GOOD, GOOD], T0 - DAY); // in review, due tomorrow
	const learning = reviewed('сіль', [GOOD], T0 - MINUTE); // on its second step, nine minutes to go
	const unsaved = reviewed('мед', [GOOD, GOOD], T0 - 3 * DAY); // due, but its word is in no deck
	const cards = byWord([due, later, learning, unsaved]);
	const words = ['кіт', 'вода', 'хліб', 'сіль', 'пес', 'кіт', 'дім'];

	// A limit of three, and сіль was met a minute ago: two more today.
	const today = plan(cards, words, 3, T0);
	assert.deepEqual(today.learning, [learning]);
	assert.deepEqual(today.due, [due]);
	assert.deepEqual(today.fresh, ['кіт', 'пес']); // each word once, in the order given

	// Not yet time for the learning card: the review comes first.
	assert.equal(nextUp(today, T0), due);
	assert.equal(nextUp(today, learning.due), learning);
	// Nothing else left: the learning card is shown ahead of its time.
	assert.equal(nextUp({ learning: [learning], due: [], fresh: [] }, T0), learning);
	assert.deepEqual(nextUp({ learning: [], due: [], fresh: ['кіт'] }, T0), newCard('кіт', T0));
	assert.equal(nextUp({ learning: [], due: [], fresh: [] }, T0), null);
});

test('plan counts the new words already met today against the limit', () => {
	const met = reviewed('сіль', [GOOD], T0 - 60 * MINUTE);
	const yesterday = reviewed('хліб', [GOOD], T0 - DAY);
	const cards = byWord([met, yesterday]);
	assert.deepEqual(plan(cards, ['кіт', 'пес', 'дім'], 2, T0).fresh, ['кіт']);
	assert.deepEqual(plan(cards, ['кіт', 'пес', 'дім'], 1, T0).fresh, []);
	assert.deepEqual(plan(cards, ['кіт', 'пес', 'дім'], 0, T0).fresh, []);
	// A card met in another deck still counts.
	assert.deepEqual(plan(cards, ['кіт'], 1, T0).fresh, []);
});

test('a session comes to an end', () => {
	// Three new words, as the review page runs them: answer whatever is next,
	// "Again" the first time a word is seen and "Good" after that.
	let cards = new Map<string, ReviewCard>();
	let now = T0;
	const shown: string[] = [];
	for (;;) {
		const card = nextUp(plan(cards, ['кіт', 'пес', 'дім'], 10, now), now);
		if (!card) break;
		shown.push(card.word);
		assert.ok(shown.length < 50, 'the session does not end');
		cards = new Map(cards).set(card.word, answer(card, card.reps ? GOOD : AGAIN, now));
		now += 5000; // five seconds a card
	}
	// Each word: Again, then Good on both learning steps.
	assert.equal(shown.length, 9);
	assert.deepEqual(shown.slice(0, 3), ['кіт', 'пес', 'дім']);
	assert.ok([...cards.values()].every((card) => card.state === REVIEW && card.due - now > DAY / 2));
	// A word missed on first sight is due the next day, and not before.
	const tomorrow = plan(cards, ['кіт', 'пес', 'дім'], 10, now + DAY);
	assert.deepEqual([tomorrow.learning.length, tomorrow.due.length, tomorrow.fresh.length], [0, 3, 0]);
});

test('span rounds a length of time to one unit', () => {
	const spans = [MINUTE, 10 * MINUTE, 90 * MINUTE, 2 * DAY, 45 * DAY, 498 * DAY].map((ms) => span(ms));
	assert.deepEqual(spans.map(({ n, unit }) => `${n} ${unit}`), ['1 min', '10 min', '2 h', '2 d', '2 mo', '1.4 y']);
});

test('a list of saved words is a deck', () => {
	const lists = [{ id: 'list-food-01', words: ['хліб', 'сіль'] }, { id: 'list-home-01', words: ['дім'] }];
	const common = new Map([['common-500', ['не', 'я']]]);
	const saved = ['дім', 'хліб', 'сіль', 'кіт'];
	const words = (deck: string) => wordsOfDeck(deck, saved, lists, common);

	assert.equal(listDeck('list-food-01'), 'list:list-food-01');
	assert.equal(listOfDeck('list:list-food-01'), 'list-food-01');
	for (const not of ['saved', 'common-500', 'list:', 'list:short', 'list:has spaces in it']) {
		assert.equal(listOfDeck(not), null, not);
	}

	assert.deepEqual(words('saved'), saved);
	assert.deepEqual(words('list:list-food-01'), ['хліб', 'сіль']);
	assert.deepEqual(words('common-500'), ['не', 'я']);
	// A list since deleted, and a deck not yet fetched, have no words.
	assert.deepEqual(words('list:list-gone-01'), []);
	assert.deepEqual(words('common-1000'), []);

	// Only the list's words are new cards when the list alone is switched on.
	assert.deepEqual(plan(new Map(), words('list:list-food-01'), 10, T0).fresh, ['хліб', 'сіль']);
});

test('settings keep list decks, between the saved words and the common ones', () => {
	const sent = {
		new_per_day: 10, updated_at: T0,
		decks: ['common-500', 'list:list-home-01', 'saved', 'list:list-food-01', 'list:list-home-01', 'list:x', 7]
	};
	assert.deepEqual(parseSettings(sent, T0)?.decks, ['saved', 'list:list-home-01', 'list:list-food-01', 'common-500']);
	// No more list decks than there can be lists.
	const many = Array.from({ length: 80 }, (_, i) => `list:list-${String(i).padStart(4, '0')}`);
	assert.equal(parseSettings({ ...sent, decks: many }, T0)?.decks.length, 50);
});

test('parseSettings', () => {
	assert.deepEqual(parseSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
	assert.deepEqual(
		parseSettings({ new_per_day: 20, decks: ['common-500', 'saved', 'made-up', 'saved'], updated_at: T0 }, T0 + 1),
		{ new_per_day: 20, decks: ['saved', 'common-500'], updated_at: T0 });
	assert.equal(parseSettings({ new_per_day: 20, decks: [], updated_at: T0 + DAY }, T0)?.updated_at, T0);
	for (const bad of [null, 'x', { new_per_day: -1, decks: [] }, { new_per_day: 1000, decks: [] }, { new_per_day: 5 }]) {
		assert.equal(parseSettings(bad), null);
	}
});
