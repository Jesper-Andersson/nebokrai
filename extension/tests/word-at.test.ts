import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wordAt } from '../lib/word-at.ts';

const SENTENCE = 'Дайте, будь ласка, склянку води.';

test('a word with a neighbour on one side only', () => {
	const at = wordAt(SENTENCE, SENTENCE.indexOf('ласка') + 2);
	assert.deepEqual(at, { word: 'ласка', before: 'будь', start: 12, end: 17 });
});

test('a word with a neighbour after it', () => {
	const at = wordAt(SENTENCE, SENTENCE.indexOf('склянку'));
	assert.equal(at?.word, 'склянку');
	assert.equal(at?.before, undefined);
	assert.equal(at?.after, 'води');
});

test('the caret at the end of a word still finds it', () => {
	assert.equal(wordAt(SENTENCE, SENTENCE.indexOf('води') + 4)?.word, 'води');
});

test('an apostrophe and a stress mark stay inside the word', () => {
	assert.equal(wordAt("п'ять книжо́к", 2)?.word, "п'ять");
	assert.equal(wordAt("п'ять книжо́к", 8)?.word, 'книжо́к');
});

test('nothing for Latin text, numbers and spaces', () => {
	assert.equal(wordAt('Read 25 книг', 1), null);
	assert.equal(wordAt('Read 25 книг', 6), null);
	assert.equal(wordAt('а  б', 2), null);
});

test('a Latin neighbour is not a neighbour', () => {
	assert.deepEqual(wordAt('iPhone коштує', 8), { word: 'коштує', start: 7, end: 13 });
});

test('a word too long for the API is left alone', () => {
	assert.equal(wordAt('а'.repeat(41), 3), null);
});
