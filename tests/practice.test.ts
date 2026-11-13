// Run with: npm test
//
// The grammar practice: which points a round asks, how an answer is checked,
// what a round does to a point's schedule, and, with nebokrai.db in the repo
// root, the sentences themselves.
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_GAPS, drawGaps, pointCounts } from '../src/lib/practice/gaps.ts';
import { POINTS, cardKey, isPointKey, pointOf } from '../src/lib/practice/points.ts';
import { plan } from '../src/lib/review/cards.ts';
import { ROUND, checkAnswer, gradePoint, planRound, ratingOf, split, stateOf, type Gap } from '../src/lib/practice/round.ts';
import { AGAIN, DAY, GOOD, HARD, LEARNING, REVIEW, answer, newCard, type ReviewCard } from '../src/lib/review/fsrs.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { openLocal } from './local-db.ts';

/** The same numbers every run. */
function seeded(seed = 1) {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) % 2147483648;
		return x / 2147483648;
	};
}

const NOW = Date.UTC(2026, 10, 13, 12);
const ids = POINTS.map((point) => point.id);

/** Cards for `points`, each answered "Good" until it is under review, the last time `daysAgo` days back. */
function reviewed(points: string[], daysAgo: number): Map<string, ReviewCard> {
	const cards = new Map<string, ReviewCard>();
	for (const id of points) {
		const at = NOW - daysAgo * DAY;
		let card = newCard(cardKey(id), at);
		while (card.state !== REVIEW) card = answer(card, GOOD, at);
		cards.set(card.word, card);
	}
	return cards;
}

test('every point is named once, by a preposition and a case', () => {
	assert.equal(new Set(ids).size, ids.length);
	for (const point of POINTS) {
		assert.match(point.id, /^[a-z]+-(gen|acc|ins|loc)$/);
		assert.equal(point.id.split('-')[1], point.case.slice(0, 3));
		assert.equal(pointOf(point.id), point);
	}
});

test('a first round is two new points, each asked twice running and then mixed', () => {
	const round = planRound(ids, new Map(), NOW, seeded());
	assert.equal(round.length, ROUND);
	assert.deepEqual(round.slice(0, 4), ['u-loc', 'u-loc', 'na-loc', 'na-loc']);
	assert.deepEqual([...new Set(round)].sort(), ['na-loc', 'u-loc']);
	assert.equal(round.filter((id) => id === 'u-loc').length, 5);
});

test('points whose day has come are asked, with two new ones', () => {
	const cards = reviewed(['u-loc', 'na-loc'], 30);
	const round = planRound(ids, cards, NOW, seeded());
	assert.equal(round.length, ROUND);
	assert.deepEqual([...new Set(round)].sort(), ['na-acc', 'na-loc', 'u-acc', 'u-loc']);
	// The new ones open the round
	assert.deepEqual(round.slice(0, 4), ['u-acc', 'u-acc', 'na-acc', 'na-acc']);
});

test('no new point joins a round that is full of due ones', () => {
	const cards = reviewed(ids.slice(0, 6), 30);
	assert.deepEqual([...new Set(planRound(ids, cards, NOW, seeded()))].sort(), ids.slice(0, 6).sort());
});

test('with nothing due and nothing new, the points held least well are practised', () => {
	const cards = reviewed(ids, 0);
	const round = planRound(ids, cards, NOW, seeded());
	assert.equal(round.length, ROUND);
	assert.equal(new Set(round).size, 3);
});

test('a round does not ask one point twice running where it can be helped', () => {
	const cards = reviewed(ids.slice(0, 5), 30);
	const round = planRound(ids.slice(0, 5), cards, NOW, seeded(7));
	for (let i = 1; i < round.length; i++) assert.notEqual(round[i], round[i - 1]);
});

test('a round of one chosen point is that point alone', () => {
	assert.deepEqual(planRound(ids, new Map(), NOW, seeded(), 'bez-gen'), Array(ROUND).fill('bez-gen'));
	assert.deepEqual(planRound(ids, new Map(), NOW, seeded(), 'no-such'), []);
	assert.deepEqual(planRound([], new Map(), NOW, seeded()), []);
});

const SUGAR: Gap = {
	point: 'bez-gen', uk: 'Кава без цукру.', en: 'Coffee without sugar.', start: 9, length: 5, answer: 'цу́кру',
	also: [], number: 'singular', word: 'цукор', headword: 'цу́кор',
	choices: ['цу́кор', 'цу́кру', 'цу́кром', 'цу́крі'], forms: ['цукор', 'цукру', 'цукрові', 'цукром', 'цукрі', 'цукри'],
	tatoeba_id: 1
};

test('a typed answer is right whatever its stress, capitals or apostrophe', () => {
	assert.equal(checkAnswer(SUGAR, 'цукру'), 'right');
	assert.equal(checkAnswer(SUGAR, ' Цу́кру '), 'right');
	assert.equal(checkAnswer({ ...SUGAR, answer: "м'яче́м" }, 'м’ячем'), 'right');
});

test('the right word in the wrong form is told from a wrong word', () => {
	assert.equal(checkAnswer(SUGAR, 'цукор'), 'form');
	assert.equal(checkAnswer(SUGAR, 'цукром'), 'form');
	assert.equal(checkAnswer(SUGAR, 'сіль'), 'wrong');
	assert.equal(checkAnswer(SUGAR, '  '), 'wrong');
});

test('a second spelling of the same case is right', () => {
	const table = { ...SUGAR, answer: 'столі́', also: ['столу'], forms: ['стіл', 'стола', 'столу', 'столі'] };
	assert.equal(checkAnswer(table, 'столу'), 'right');
	assert.equal(checkAnswer(table, 'стола'), 'form');
});

test('a sentence splits round its gap', () => {
	assert.deepEqual(split(SUGAR), { before: 'Кава без ', word: 'цукру', after: '.' });
});

test('one miss outweighs a round of right answers, and help outweighs none', () => {
	assert.equal(ratingOf(['right', 'right']), GOOD);
	assert.equal(ratingOf(['right', 'helped']), HARD);
	assert.equal(ratingOf(['helped', 'missed', 'right']), AGAIN);
});

test('a round is one review of a point, however many of its sentences were asked', () => {
	const once = gradePoint('bez-gen', undefined, ['right'], NOW);
	const thrice = gradePoint('bez-gen', undefined, ['right', 'right', 'right'], NOW);
	assert.deepEqual(thrice, once);
	assert.equal(once.word, 'grammar:bez-gen');
	assert.equal(once.state, LEARNING);
	assert.equal(once.reps, 1);

	// A miss later in the round replaces the review, it does not add one
	const missed = gradePoint('bez-gen', undefined, ['right', 'missed'], NOW);
	assert.equal(missed.reps, 1);
	assert.ok(missed.due < once.due);

	const before = reviewed(['bez-gen'], 30).get('grammar:bez-gen')!;
	const after = gradePoint('bez-gen', before, ['right'], NOW);
	assert.equal(after.reps, before.reps + 1);
	assert.ok(after.stability > before.stability);
	assert.equal(gradePoint('bez-gen', before, ['missed'], NOW).lapses, 1);
});

test('a point kept among the flashcards is told from a word, and takes no new word\'s place', () => {
	assert.ok(isPointKey('grammar:bez-gen'));
	assert.ok(!isPointKey('grammar:no-such'));
	assert.ok(!isPointKey('кава'));

	const point = gradePoint('bez-gen', undefined, ['right'], NOW);
	const word = answer(newCard('кава', NOW), GOOD, NOW);
	const cards = new Map([[point.word, point], [word.word, word]]);
	// Two new words a day, one met already: the point met today is not a second
	const today = plan(cards, ['кава', 'чай', 'вода'], 2, NOW);
	assert.deepEqual(today.fresh, ['чай']);
	assert.deepEqual(today.learning.map((card) => card.word), ['кава']);
});

test('a point is new, then learning, then known once it holds three weeks', () => {
	assert.equal(stateOf(undefined), 'new');
	const card = gradePoint('bez-gen', undefined, ['right'], NOW);
	assert.equal(stateOf(card), 'learning');
	assert.equal(stateOf({ ...card, state: REVIEW, stability: 5 }), 'learning');
	assert.equal(stateOf({ ...card, state: REVIEW, stability: 30 }), 'known');
});

// --- The sentences ---

const skip = existsSync('nebokrai.db') ? false : 'nebokrai.db is missing';

test('the database has sentences for exactly the points the page lists', { skip }, async () => {
	const counts = await pointCounts(openLocal('nebokrai.db'));
	assert.deepEqual(Object.keys(counts).sort(), [...ids].sort());
	for (const count of Object.values(counts)) assert.ok(count >= MAX_GAPS);
});

test('sentences are drawn in the order asked, each with its gap and four forms to choose among', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const asked = [...ids, 'no-such'];
	for (const seed of [1, 2, 3]) {
		const gaps = await drawGaps(db, asked.slice(0, MAX_GAPS), seeded(seed));
		assert.deepEqual(gaps.map((gap) => gap.point), ids.slice(0, MAX_GAPS));
		for (const gap of gaps) {
			const { word } = split(gap);
			assert.equal(plain(word), plain(gap.answer), gap.uk);
			assert.equal(checkAnswer(gap, word), 'right');
			assert.ok(gap.en && gap.tatoeba_id > 0);
			assert.ok(gap.forms.includes(plain(gap.answer)));

			assert.ok(gap.choices.length >= 2 && gap.choices.length <= 4, gap.uk);
			assert.equal(new Set(gap.choices.map(plain)).size, gap.choices.length);
			// Exactly one choice is right: no second spelling of the case is offered as wrong
			assert.deepEqual(gap.choices.filter((choice) => checkAnswer(gap, choice) === 'right'), [gap.answer]);
			for (const choice of gap.choices) assert.ok(gap.forms.includes(plain(choice)));
		}
	}
	// One request for the meta row, one for the sentences, one for their nouns' forms
	assert.equal(db.queries, 9);
});

test('a point asked twice gives two different sentences', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const gaps = await drawGaps(db, Array(MAX_GAPS + 5).fill('sered-gen'), seeded(4));
	assert.equal(gaps.length, MAX_GAPS);
	assert.equal(new Set(gaps.map((gap) => gap.tatoeba_id + ':' + gap.start)).size, MAX_GAPS);
	assert.deepEqual(await drawGaps(db, ['no-such'], seeded()), []);
});

test('the noun standing after a preposition that asks for one case of it', { skip }, async () => {
	// Every sentence of the smallest point, read through the same code as a round
	const db = openLocal('nebokrai.db');
	const rows = await db.all<{ uk: string; start: number; length: number; form: string }>(
		"SELECT uk, start, length, form FROM cloze WHERE point = 'bez-gen'");
	assert.ok(rows.length >= MAX_GAPS);
	for (const row of rows) {
		assert.equal(plain(row.uk.slice(row.start, row.start + row.length)), plain(row.form));
		assert.match(row.uk.slice(0, row.start).toLowerCase(), /(^|[^Ѐ-ӿ])без $/);
	}
});
