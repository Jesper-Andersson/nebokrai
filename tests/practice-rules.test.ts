// A rule's card in the grammar practice (src/lib/practice/rules.ts): the
// endings it shows, which sentences it shows, and where it opens unasked.
//
// The test of the words in the endings tables needs nebokrai.db in the repo
// root; see data/README.md to build it.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { POINTS } from '../src/lib/practice/points.ts';
import { EXAMPLES, endingsOf, examplesFor, introduces } from '../src/lib/practice/rules.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { openLocal } from './local-db.ts';

test('every rule has endings to show', () => {
	for (const point of POINTS) assert.ok(endingsOf(point).length, point.id);
	// Prepositions that ask for one case share its table: без and до both take the genitive
	const bez = POINTS.find((p) => p.id === 'bez-gen')!;
	const doGen = POINTS.find((p) => p.id === 'do-gen')!;
	assert.equal(endingsOf(bez), endingsOf(doGen));
	// Each number has its own: 2 книги, 5 книг
	const few = POINTS.find((p) => p.id === 'few-nom')!;
	const many = POINTS.find((p) => p.id === 'many-gen')!;
	assert.notEqual(endingsOf(few), endingsOf(many));
});

test('every word in the endings tables is that form, stress and all', { skip: existsSync('nebokrai.db') ? false : 'nebokrai.db is missing' }, async () => {
	const db = openLocal('nebokrai.db');
	for (const point of POINTS) {
		for (const row of endingsOf(point)) {
			// A number's rows are the noun counted; a preposition's row says its number by being labelled plural
			const number = point.number ?? (row.kinds.includes('plural') ? 'plural' : 'singular');
			for (const word of row.words.split(', ').map((w) => w.replace(/^\d+ /, ''))) {
				// By `plain`, which has an index, and then the stress
				const found = (await db.all<{ form: string; tags: string }>('SELECT form, tags FROM forms WHERE plain = ?', [plain(word)])).filter(
					(f) => f.form === word
				);
				const tagged = found.some(({ tags }) => {
					const list: string[] = JSON.parse(tags);
					return list.includes(point.case) && list.includes(number);
				});
				assert.ok(tagged, `${point.id}: ${word} is not a ${point.case} ${number} form`);
			}
		}
	}
});

test('the sentences shown leave out the noun being asked for', () => {
	const gap = (uk: string, word: string) => ({ uk, word });
	const drawn = [
		gap('Кава без цукру.', 'цукор'),
		gap('Людина не може жити без повітря.', 'повітря'),
		gap('Людина не може жити без повітря.', 'повітря'),
		gap('Вони розуміють один одного без слів.', 'слово'),
		gap('Катя може їхати на велосипеді без рук.', 'рука'),
		gap('Ти, без сумніву, найкращий.', 'сумнів')
	];
	const shown = examplesFor(drawn, { word: 'цукор' });
	assert.equal(shown.length, EXAMPLES);
	assert.deepEqual(
		shown.map((g) => g.word),
		['повітря', 'слово', 'рука']
	);
	assert.deepEqual(examplesFor([], { word: 'цукор' }), []);
});

test('the card opens unasked over the first sentence of a rule never met', () => {
	const round = ['bez-gen', 'u-loc', 'bez-gen', 'do-gen'];
	const known = (point: string) => point === 'u-loc';
	assert.equal(introduces(round, 0, known), true);
	// Met already: no card unasked
	assert.equal(introduces(round, 1, known), false);
	// Its second sentence in the round
	assert.equal(introduces(round, 2, known), false);
	assert.equal(introduces(round, 3, known), true);
	assert.equal(introduces(round, 4, known), false);
});
