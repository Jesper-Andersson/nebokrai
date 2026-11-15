// Run with: npm test
//
// Typing the answer on a flashcard: how a typed word is marked, where a
// card's sentence has the word and what that spelling can be, and, with
// nebokrai.db in the repo root, the cards the review page is sent.
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { around, asksForm, checkTyped, recallOf, suggested, type FormRow } from '../src/lib/review/recall.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { wordCards } from '../src/lib/search/word.ts';
import { openLocal } from './local-db.ts';

// вода's forms as the dictionary has them: води is three things, with two stresses
const row = (form: string, ...tags: string[]): FormRow => ({ form, plain: plain(form), tags });
const WATER: FormRow[] = [
	row('вода́', 'nominative', 'singular'),
	row('во́ди', 'nominative', 'plural'),
	row('води́', 'genitive', 'singular'),
	row('вод', 'genitive', 'plural'),
	row('воді́', 'dative', 'singular'),
	row('во́ду', 'accusative', 'singular'),
	row('во́ди', 'accusative', 'plural'),
	row('водо́ю', 'instrumental', 'singular'),
	row('воді́', 'locative', 'singular'),
	row('во́ди', 'plural', 'vocative')
];
const GLASS = 'Дайте, будь ласка, склянку води.';

test('a typed word is right, another form of it, close in Latin, or wrong', () => {
	const forms = WATER.map((r) => r.plain);
	assert.equal(checkTyped('вода', [], forms, 'вода'), 'right');
	assert.equal(checkTyped('вода', [], forms, ' Вода́ '), 'right');
	assert.equal(checkTyped('вода', [], forms, 'воду'), 'form');
	assert.equal(checkTyped('вода', [], forms, 'voda'), 'right');
	assert.equal(checkTyped('вода', [], forms, 'vodu'), 'form');
	assert.equal(checkTyped('вода', [], forms, 'vod'), 'form');
	assert.equal(checkTyped('вода', [], forms, 'wod'), 'close');
	assert.equal(checkTyped('вода', [], forms, 'сік'), 'wrong');
	assert.equal(checkTyped('вода', [], forms, '   '), 'wrong');
});

test('the gap is the first word of the sentence that is a form of the entry', () => {
	const recall = recallOf('вода', 'вода́', GLASS, WATER);
	assert.deepEqual(recall.forms, ['вода', 'води', 'вод', 'воді', 'воду', 'водою']);
	assert.ok(recall.gap);
	assert.equal(recall.gap.plain, 'води');
	assert.deepEqual(around(GLASS, recall.gap), { before: 'Дайте, будь ласка, склянку ', word: 'води', after: '.' });
	assert.ok(asksForm('вода', recall.gap));
});

test('a spelling with two stresses has a reading for each, and the vocative stands back', () => {
	const gap = recallOf('вода', 'вода́', GLASS, WATER).gap;
	assert.deepEqual(gap?.readings, [
		{ form: 'во́ди', tags: [['nominative', 'plural'], ['accusative', 'plural']] },
		{ form: 'води́', tags: [['genitive', 'singular']] }
	]);
	// Only a vocative: then it is all there is
	const called = recallOf('мама', 'ма́ма', 'Мамо, ходи сюди!', [row('ма́ма', 'nominative', 'singular'), row('ма́мо', 'singular', 'vocative')]);
	assert.deepEqual(called.gap?.readings, [{ form: 'ма́мо', tags: [['singular', 'vocative']] }]);
});

test('a second spelling of the same form is right too', () => {
	const brother = [row('брат', 'nominative', 'singular'), row('бра́тові', 'dative', 'singular'), row('бра́ту', 'dative', 'singular')];
	const gap = recallOf('брат', 'брат', 'Я дав братові книгу.', brother).gap;
	assert.deepEqual(gap?.also, ['брату']);
	assert.equal(checkTyped(gap!.plain, gap!.also, ['брат', 'братові', 'брату'], 'брату'), 'right');
});

test('a sentence with the dictionary form asks nothing more, and no sentence gives no gap', () => {
	const cold = recallOf('вода', 'вода́', 'Вода холодна.', WATER);
	assert.equal(cold.gap?.plain, 'вода');
	assert.equal(asksForm('вода', cold.gap!), false);
	assert.equal(recallOf('вода', 'вода́', null, WATER).gap, null);
	assert.equal(recallOf('вода', 'вода́', 'Тут нічого.', WATER).gap, null);
	// A word with no table of forms is its own reading
	const adverb = recallOf('тут', 'тут', 'Я тут.', []);
	assert.deepEqual(adverb.gap?.readings, [{ form: 'тут', tags: [] }]);
});

test('a word known suggests Good, whatever its ending; one not known suggests Again', () => {
	assert.equal(suggested({ word: true, form: 'missed' }), 'good');
	assert.equal(suggested({ word: true, form: null }), 'good');
	assert.equal(suggested({ word: false, form: null }), 'again');
});

const skip = existsSync('nebokrai.db') ? false : 'nebokrai.db is missing';

test('cards for the review page carry their forms and their sentence’s gap; the exports’ do not', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const [plainCard] = await wordCards(db, ['вода']);
	assert.equal(plainCard.recall, undefined);
	const [card] = await wordCards(db, ['вода'], { recall: true });
	assert.ok(card.recall);
	assert.equal(card.recall.forms[0], 'вода');
	assert.ok(card.recall.forms.includes('водою'));
	if (card.example && card.recall.gap) {
		const { word } = around(card.example.uk, card.recall.gap);
		assert.ok(card.recall.forms.includes(plain(word)), `${word} is a form of вода`);
	}
});

test('most review cards with a sentence find the word in it', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const words = (await db.all<{ word: string }>(
		'SELECT word FROM entries WHERE freq_rank IS NOT NULL ORDER BY freq_rank LIMIT 300')).map((r) => r.word);
	const cards = await wordCards(db, words, { recall: true });
	const withSentence = cards.filter((card) => card.example);
	const found = withSentence.filter((card) => card.recall?.gap);
	assert.ok(found.length / withSentence.length > 0.95, `${found.length} of ${withSentence.length}`);
});
