// Splitting an example sentence into words (src/lib/sentence.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tokens } from '../src/lib/sentence.ts';

const words = (text: string) => tokens(text).filter((t) => t.word).map((t) => t.text);

test('words of a sentence', () => {
	assert.deepEqual(words('У молодості треба багато читати.'), ['У', 'молодості', 'треба', 'багато', 'читати']);
	// An apostrophe or a hyphen inside a word belongs to it, in whichever style
	assert.deepEqual(words("П'ять, п’ять і пʼять."), ["П'ять", 'п’ять', 'і', 'пʼять']);
	assert.deepEqual(words('Будь ласка, по-українськи!'), ['Будь', 'ласка', 'по-українськи']);
	// A dash between words does not join them
	assert.deepEqual(words('Київ - столиця.'), ['Київ', 'столиця']);
	// Quotes from Wiktionary carry stress marks
	assert.deepEqual(words('Вона́ чита́є кни́гу.'), ['Вона́', 'чита́є', 'кни́гу']);
	// Numbers and Latin text are not words to look up
	assert.deepEqual(words('У 2024 році Wi-Fi є всюди.'), ['У', 'році', 'є', 'всюди']);
	assert.deepEqual(words(''), []);
});

test('nothing of the sentence is lost', () => {
	for (const text of ['«Привіт!» — сказав він.', '  Так…', 'OK', "м'яти"]) {
		assert.equal(tokens(text).map((t) => t.text).join(''), text);
	}
	assert.deepEqual(tokens('Так, ні.'), [
		{ text: 'Так', word: true }, { text: ', ', word: false },
		{ text: 'ні', word: true }, { text: '.', word: false }
	]);
});
