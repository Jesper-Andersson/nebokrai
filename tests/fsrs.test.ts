// The FSRS-6 scheduler (src/lib/review/fsrs.ts) against the values published
// with the reference implementations: ts-fsrs 5.4.2 (__tests__/FSRS-6.test.ts),
// py-fsrs (tests/test_basic.py) and fsrs-rs (inference.rs). Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	AGAIN, DAY, EASY, GOOD, HARD, LEARNING, MINUTE, RELEARNING, REVIEW, answer, dayNumber, newCard, nextMemory, preview,
	retrievability, type Rating, type ReviewCard
} from '../src/lib/review/fsrs.ts';

// Midday local time, so that neither a learning step nor a clock change crosses 04:00.
const START = new Date(2022, 11, 29, 12, 30).getTime();
const RATINGS: Rating[] = [AGAIN, HARD, GOOD, EASY];

const near = (actual: number, expected: number, places = 4) =>
	assert.ok(Math.abs(actual - expected) < 0.5 * 10 ** -places, `${actual} is not ${expected}`);

/** Answer at each due time in turn; the whole days each answer put the card off by. */
function intervals(ratings: Rating[]): { days: number[]; card: ReviewCard } {
	let card = newCard('вода', START);
	let now = START;
	const days: number[] = [];
	for (const rating of ratings) {
		card = answer(card, rating, now);
		days.push(Math.floor((card.due - now) / DAY));
		now = card.due;
	}
	return { days, card };
}

test('the first answer sets stability and difficulty', () => {
	const cards = RATINGS.map((rating) => answer(newCard('вода', START), rating, START));
	assert.deepEqual(cards.map((c) => c.stability), [0.212, 1.2931, 2.3065, 8.2956]);
	assert.deepEqual(cards.map((c) => c.difficulty), [6.4133, 5.11217071, 2.11810397, 1]);
	assert.deepEqual(cards.map((c) => c.state), [LEARNING, LEARNING, LEARNING, REVIEW]);
	// Again in a minute, Hard in six, Good in ten, Easy in eight days.
	assert.deepEqual(cards.map((c) => c.due - START), [MINUTE, 6 * MINUTE, 10 * MINUTE, 8 * DAY]);
});

test('intervals over thirteen reviews', () => {
	const { days, card } = intervals([GOOD, GOOD, GOOD, GOOD, GOOD, GOOD, AGAIN, AGAIN, GOOD, GOOD, GOOD, GOOD, GOOD]);
	assert.deepEqual(days, [0, 2, 11, 46, 163, 498, 0, 0, 2, 4, 7, 12, 21]);
	assert.deepEqual([card.reps, card.lapses, card.state], [13, 1, REVIEW]);
});

test('memory after Again and five times Good', () => {
	let memory = { stability: 0, difficulty: 0 };
	const gaps = [0, 0, 1, 3, 8, 21];
	([AGAIN, GOOD, GOOD, GOOD, GOOD, GOOD] as Rating[]).forEach((rating, i) => {
		memory = nextMemory(memory, gaps[i], rating);
	});
	near(memory.stability, 53.62691);
	near(memory.difficulty, 6.3574867);
});

test('difficulty stays within 1 to 10', () => {
	let easy = { stability: 0, difficulty: 0 };
	let again = { stability: 0, difficulty: 0 };
	for (let i = 0; i < 10; i++) {
		easy = nextMemory(easy, i, EASY);
		again = nextMemory(again, i, AGAIN);
	}
	assert.equal(easy.difficulty, 1);
	assert.ok(again.difficulty > 9 && again.difficulty <= 10, String(again.difficulty));
});

test('retrievability', () => {
	const card = answer(newCard('вода', START), EASY, START);
	near(retrievability(card, card.due), 0.9024733, 6);
	assert.equal(retrievability(card, START), 1);
	assert.equal(retrievability(newCard('вода', START), START), 0);
});

test('a forgotten card is relearnt the same day', () => {
	const { card } = intervals([GOOD, GOOD, GOOD]);
	const now = card.due;
	const lapsed = answer(card, AGAIN, now);
	assert.deepEqual([lapsed.state, lapsed.lapses, lapsed.due - now], [RELEARNING, 1, 10 * MINUTE]);
	assert.ok(lapsed.stability < card.stability && lapsed.difficulty > card.difficulty);
	const back = answer(lapsed, GOOD, lapsed.due);
	assert.deepEqual([back.state, back.lapses], [REVIEW, 1]);
	assert.ok(back.due - lapsed.due >= DAY);
});

test('the buttons show what each answer would do, and the card is left as it was', () => {
	const card = newCard('вода', START);
	const copy = { ...card };
	assert.deepEqual(preview(card, START), { again: START + MINUTE, good: START + 10 * MINUTE });
	assert.deepEqual(card, copy);
});

test('a day starts at four in the morning', () => {
	const evening = new Date(2026, 10, 12, 23, 0).getTime();
	const night = new Date(2026, 10, 13, 3, 59).getTime();
	const morning = new Date(2026, 10, 13, 4, 0).getTime();
	assert.equal(dayNumber(night), dayNumber(evening));
	assert.equal(dayNumber(morning), dayNumber(evening) + 1);
});
