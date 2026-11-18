// The coverage figure on /learn (src/lib/coverage.ts): how much of everyday
// Ukrainian the known words cover. The sums need no database; the table
// itself needs nebokrai.db in the repo root.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { commonRange } from '../src/lib/browse.ts';
import { coverage, coverageTable, milestones, percent, type CoverageTable } from '../src/lib/coverage.ts';
import { DAY, LEARNING, REVIEW, newCard, type ReviewCard } from '../src/lib/review/fsrs.ts';
import { openLocal } from './local-db.ts';

const skip = !existsSync('nebokrai.db') && 'nebokrai.db is missing';
const NOW = Date.UTC(2026, 10, 17);

/** A card answered today: known with 30 days' stability, being learnt with 3. */
function card(word: string, stability: number): ReviewCard {
	return { ...newCard(word, NOW - DAY), state: REVIEW, stability, difficulty: 5, reps: 5, last_review: NOW, due: NOW + DAY };
}
const known = (word: string) => card(word, 30);
const learning = (word: string) => card(word, 3);
const cards = (...list: ReviewCard[]) => new Map(list.map((c) => [c.word, c]));

// мати stands once, its verb and noun summed (1944 + 267)
const TABLE: CoverageTable = { words: ['не', 'я', 'мати', 'по', 'книга'], freq: [400, 300, 200, 60, 40], total: 1000 };

// A card already shown but not yet answered is shaky to stateOf(), as on the
// rest of /learn, so it counts as being learnt; only a word with no card adds nothing.
test('known and learning words are summed apart; words with no card add nothing', () => {
	const got = coverage(TABLE, cards(known('не'), learning('я'), { ...learning('книга'), state: LEARNING, step: 1 }), NOW);
	assert.equal(got.known, 0.4);
	assert.equal(got.learning, 0.34);
	assert.equal(got.knownWords, 1);
});

test('grammar cards and spellings not in the table add nothing', () => {
	const got = coverage(TABLE, cards(known('grammar:na-loc'), known('По'), known('рідкісне')), NOW);
	assert.deepEqual(got, { known: 0, learning: 0, knownWords: 0 });
});

test('an empty table gives nothing, and every word known gives all', () => {
	assert.deepEqual(coverage({ words: [], freq: [], total: 0 }, cards(known('не')), NOW), { known: 0, learning: 0, knownWords: 0 });
	const all = coverage(TABLE, cards(...TABLE.words.map(known)), NOW);
	assert.equal(all.known, 1);
	assert.equal(percent(all.known), 100);
});

test('a spelling with two entries counts once', () => {
	const got = coverage(TABLE, cards(known('мати')), NOW);
	assert.equal(got.known, 0.2);
	assert.equal(got.knownWords, 1);
});

test('percent rounds down', () => {
	assert.equal(percent(0.996), 99);
	assert.equal(percent(0.47), 47);
	assert.equal(percent(0), 0);
});

test('milestones add up the commonest words', () => {
	assert.deepEqual(milestones(TABLE, [1, 3, 99]), [0.4, 0.9, 1]);
});

test('the table from the dictionary', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const table = await coverageTable(db);
	assert.equal(db.queries, 1, 'one query');
	assert.equal(table.words.length, table.freq.length);
	assert.deepEqual(table.words.slice(0, 500), await commonRange(openLocal('nebokrai.db'), 1, 500));
	assert.ok(table.total > 580_000 && table.total < 640_000, `total ${table.total}`);
	assert.ok(table.words.every((word) => word === word.toLowerCase()));

	const [m500, m1000, m2000, m5000] = milestones(table, [500, 1000, 2000, 5000]);
	assert.ok(m500 < m1000 && m1000 < m2000 && m2000 < m5000 && m5000 < 1);
	assert.ok(m1000 > 0.75 && m1000 < 0.9, `1,000 words cover ${m1000}`);
	const bytes = Buffer.byteLength(JSON.stringify(table));
	assert.ok(bytes < 300_000, `${bytes} bytes`);
});
