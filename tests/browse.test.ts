// The pages for browsing (src/lib/browse.ts): the commonest words and the
// words under each letter. The order needs no database; the lists themselves
// need nebokrai.db in the repo root.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import {
	ALPHABET, COMMON_WORDS, OTHER, WORDS_PER_PAGE,
	commonPath, commonWords, guideWords, letterOf, letterPath, sortWords, wordsUnder
} from '../src/lib/browse.ts';
import { openLocal } from './local-db.ts';

const skip = !existsSync('nebokrai.db') && 'nebokrai.db is missing';

test('the letter a word is filed under', () => {
	assert.equal(ALPHABET.length, 33);
	assert.equal(letterOf('книга'), 'к');
	assert.equal(letterOf('Київ'), 'к');
	assert.equal(letterOf('-ський'), 'с'); // a suffix, under its first letter
	assert.equal(letterOf("-'я"), 'я');
	assert.equal(letterOf('їжак'), 'ї');
	assert.equal(letterOf('Ґанок'), 'ґ');
	for (const word of ['QR-код', 'Paryž', '№', ')))', '-∅', '']) assert.equal(letterOf(word), null, word);
});

test('words are sorted as a Ukrainian dictionary sorts them', () => {
	// By code point і, ї, є and ґ would stand after я, and capitals first
	assert.deepEqual(
		sortWords(['пюре', 'піна', 'пиво', "п'ять", 'пута', 'Південь', 'перо', 'пєц', 'па']),
		['па', 'перо', 'пєц', 'пиво', 'Південь', 'піна', 'пута', 'пюре', "п'ять"]);
	assert.deepEqual(sortWords(['ґанок', 'гай', 'дім', 'газ', 'ґава']), ['газ', 'гай', 'ґава', 'ґанок', 'дім']);
	// An apostrophe, a hyphen and a space do not count (п'ять above stands where пять would)
	assert.deepEqual(sortWords(['пів-на-пів', 'півень', 'пів']), ['пів', 'півень', 'пів-на-пів']);
	assert.deepEqual(sortWords(['віра', 'Віра', 'віра']), ['Віра', 'віра', 'віра']);
});

test('addresses of the pages', () => {
	assert.equal(letterPath('п'), '/words/п');
	assert.equal(letterPath('п', 1), '/words/п');
	assert.equal(letterPath('п', 3), '/words/п/3');
	assert.equal(letterPath(OTHER), '/words/other');
	assert.equal(commonPath(), '/common-words');
	assert.equal(commonPath(10), '/common-words/10');
});

test('guide words: the first and last word of each page', () => {
	const words = Array.from({ length: WORDS_PER_PAGE * 2 + 1 }, (_, i) => `w${i}`);
	assert.deepEqual(guideWords(words), [
		{ first: 'w0', last: `w${WORDS_PER_PAGE - 1}` },
		{ first: `w${WORDS_PER_PAGE}`, last: `w${WORDS_PER_PAGE * 2 - 1}` },
		{ first: `w${WORDS_PER_PAGE * 2}`, last: `w${WORDS_PER_PAGE * 2}` }
	]);
	assert.deepEqual(guideWords([]), []);
});

test('every word in the dictionary is under exactly one letter', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const [{ n: all }] = await db.all<{ n: number }>('SELECT count(DISTINCT word) AS n FROM entries');

	const seen = new Set<string>();
	let listed = 0;
	for (const letter of [...ALPHABET, OTHER]) {
		const before = db.rowsReturned;
		const words = await wordsUnder(db, letter);
		// Never the whole dictionary for one letter: п, the largest, is an eighth of it
		assert.ok(db.rowsReturned - before < all / 4, `${letter} read ${db.rowsReturned - before} rows`);
		assert.ok(words.length > 0, `nothing under ${letter}`);
		for (const word of words) {
			assert.equal(letterOf(word), letter === OTHER ? null : letter, word);
			seen.add(word);
		}
		listed += words.length;
	}
	// None twice, and none left out. A build of the dictionary with words in
	// letters Ukrainian does not use (ы, э) would fail here: see wordsUnder.
	assert.equal(listed, seen.size);
	assert.equal(seen.size, all);

	const p = await wordsUnder(db, 'п');
	assert.ok(p.indexOf('пиво') < p.indexOf('піна') && p.indexOf('піна') < p.indexOf('пюре'));
	assert.ok(p.includes('Польща') && p.includes("п'ять"));
	assert.ok((await wordsUnder(db, 'с')).includes('-ський'));
	assert.ok((await wordsUnder(db, OTHER)).includes('QR-код'));
});

test('the commonest words, each spelling once', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const words = await commonWords(db);
	assert.equal(words.length, COMMON_WORDS);
	assert.deepEqual(words.slice(0, 3).map((w) => w.word), ['не', 'я', 'в']);

	const spellings = new Set(words.map((w) => w.word));
	assert.equal(spellings.size, COMMON_WORDS);
	for (const w of words) {
		assert.ok(w.gloss, `${w.word} has no meaning`);
		assert.ok(w.pos.length >= 1 && new Set(w.pos).size === w.pos.length, w.word);
	}
	// що is a pronoun and a conjunction, and one word to a learner
	assert.deepEqual(words.find((w) => w.word === 'що')?.pos, ['pron', 'conj']);
	// No names and no letters of the alphabet: По, the river, is ranked before
	// по, and я is also the last letter
	assert.ok(spellings.has('по') && spellings.has('того') === false);
	for (const w of words) {
		assert.equal(w.word, w.word.toLowerCase(), w.word);
		assert.ok(!w.pos.includes('name') && !w.pos.includes('character'), w.word);
	}
	assert.deepEqual(words.find((w) => w.word === 'я')?.pos, ['pron']);
});
