// The card over a word in a sentence (src/lib/gloss.ts), on the local
// databases. Every example is from "Дайте, будь ласка, склянку води."
//
// Needs nebokrai.db and vesum.db in the repo root; see data/README.md to build them.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { glossFor } from '../src/lib/gloss.ts';
import { openLocal } from './local-db.ts';

const haveData = existsSync('nebokrai.db') && existsSync('vesum.db');
const skip = haveData ? false : 'nebokrai.db or vesum.db is missing';

test('glosses for words in a sentence', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = openLocal('vesum.db');

	// An inflected form names its word, the form and the first meaning
	const glass = await glossFor(db, vesum, 'склянку', 'ласка', 'води');
	assert.equal(glass.phrase, null);
	assert.equal(glass.readings[0].headword, 'скля́нка');
	assert.deepEqual(glass.readings[0].forms, [{ form: 'скля́нку', labels: ['accusative singular'] }]);
	assert.equal(glass.readings[0].meaning, 'glass (drinking vessel)');

	// After будь, ласка is the phrase first, and the word's own readings after it
	const please = await glossFor(db, vesum, 'ласка', 'будь', 'склянку');
	assert.equal(please.phrase?.headword, 'будь ла́ска');
	assert.equal(please.phrase?.meaning, 'please');
	assert.ok(please.readings.every((r) => r.word === 'ласка'));
	assert.equal(please.readings.length, 2);

	// Alone, the same word has no phrase
	assert.equal((await glossFor(db, vesum, 'ласка')).phrase, null);

	// One spelling, two words; a word only starting with it is left out
	const water = await glossFor(db, vesum, 'води');
	assert.deepEqual(water.readings.map((r) => r.word), ['вода', 'водити']);

	// у in a sentence is the preposition, never the letter
	const at = await glossFor(db, vesum, 'У', undefined, 'склянці');
	assert.ok(at.readings.length > 0 && at.readings.every((r) => r.pos === 'prep'));

	// A capital at the start of a sentence finds the word all the same
	assert.equal((await glossFor(db, vesum, 'Дайте')).readings[0]?.word, 'дати');

	// Nothing to look up
	assert.deepEqual(await glossFor(db, vesum, '  '), { phrase: null, readings: [] });
	assert.deepEqual((await glossFor(db, vesum, 'Tatoeba')).readings, []);
});
