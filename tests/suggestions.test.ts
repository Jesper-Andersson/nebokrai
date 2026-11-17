// Readers' suggestions: finding the place a suggestion points at, storing and
// reviewing it, and the line an accepted example fix becomes in
// data/tatoeba-corrections.tsv.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WordEntry } from '../src/lib/search/word.ts';
import {
	canAddEnglish,
	canAddWord,
	findCurrent,
	formTagsKey,
	stressMarks,
	unchanged,
	type SuggestPlace
} from '../src/lib/suggest.ts';
import {
	addSuggestion,
	correctionRow,
	countSuggestions,
	countWordAsks,
	wiktionaryDraft,
	listSuggestions,
	reviewSuggestion,
	type NewSuggestion
} from '../src/lib/server/suggestions.ts';
import { openMemorySuggestions } from './local-db.ts';

const entry = (over: Partial<WordEntry>): WordEntry => ({
	id: 1, word: 'вода', headword: 'вода́', pos: 'noun', tags: [], head_forms: [], roman: 'voda', ipa: null,
	audio_url: null, etymology: null, freq_rank: 1, source: 'wiktionary', offensive: false,
	senses: [
		{ n: 1, gloss: 'water', tags: [], examples: [{ text: 'жива́ вода́', english: 'living water' }] },
		{ n: 2, gloss: 'waters, body of water', tags: ['in the plural'], examples: [] }
	],
	forms: [
		{ form: 'води́', tags: ['genitive', 'singular'] },
		{ form: 'во́ди', tags: ['nominative', 'plural'] }
	],
	examples: [{ uk: 'Вода холодна.', en: 'The water is cold.', tatoeba_id: 2301, adapted: false, original: null }],
	relations: [],
	...over
});

const voda = [entry({})];
const at = (over: Partial<SuggestPlace>): SuggestPlace =>
	({ target: 'meaning', word: 'вода', pos: 'noun', headword: 'вода́', ...over });

test('a place is found by keys that survive a rebuild', () => {
	assert.deepEqual(findCurrent(voda, at({ target: 'stress' })), { current: 'вода́', current_en: null });
	assert.deepEqual(
		findCurrent(voda, at({ sense_n: 2, current: 'waters, body of water' })),
		{ current: 'waters, body of water', current_en: null }
	);
	assert.deepEqual(
		findCurrent(voda, at({ target: 'quote', sense_n: 1, current: 'жива́ вода́' })),
		{ current: 'жива́ вода́', current_en: 'living water' }
	);
	assert.deepEqual(
		findCurrent(voda, at({ target: 'example', tatoeba_id: 2301 })),
		{ current: 'Вода холодна.', current_en: 'The water is cold.' }
	);
	// The tags come in any order
	assert.deepEqual(
		findCurrent(voda, at({ target: 'form', current: 'води́', form_tags: ['singular', 'genitive'] })),
		{ current: 'води́', current_en: null }
	);
});

test('a place that is not in the dictionary is not found', () => {
	// The meaning was renumbered or reworded since the page was loaded
	assert.equal(findCurrent(voda, at({ sense_n: 2, current: 'water' })), null);
	assert.equal(findCurrent(voda, at({ target: 'example', tatoeba_id: 1 })), null);
	// во́ди is the nominative plural, not the genitive singular
	assert.equal(findCurrent(voda, at({ target: 'form', current: 'во́ди', form_tags: ['genitive', 'singular'] })), null);
	assert.equal(findCurrent(voda, at({ target: 'stress', pos: 'verb' })), null);
	assert.equal(findCurrent([], at({ target: 'headword' })), null);
});

test('a spelling with several entries of one part of speech is searched in each', () => {
	// стан is a noun more than once; the meaning asked about is in the second
	const stan = [
		entry({ id: 1, word: 'стан', headword: 'стан', senses: [{ n: 1, gloss: 'state, condition', tags: [], examples: [] }] }),
		entry({ id: 2, word: 'стан', headword: 'стан', senses: [{ n: 1, gloss: 'camp', tags: [], examples: [] }] })
	];
	const place = at({ word: 'стан', headword: 'стан', sense_n: 1, current: 'camp' });
	assert.deepEqual(findCurrent(stan, place), { current: 'camp', current_en: null });
});

test('the same text is not a suggestion', () => {
	const sentence = { current: 'Вода холодна.', current_en: 'The water is cold.' };
	assert.equal(unchanged(sentence, ' Вода холодна. ', 'The water is cold.'), true);
	assert.equal(unchanged(sentence, 'Вода холодна.', "The water's cold."), false);
	assert.equal(unchanged(sentence, 'Вода зимна.', 'The water is cold.'), false);
	// й as one character and as и with a breve are one spelling
	assert.equal(unchanged({ current: 'край', current_en: null }, 'край'.normalize('NFD'), null), true);
	assert.equal(formTagsKey(['singular', 'genitive']), 'genitive singular');
});

const suggestion = (over: Partial<NewSuggestion> = {}): NewSuggestion => ({
	target: 'example', word: 'вода', pos: 'noun', headword: 'вода́', sense_n: null, tatoeba_id: 2301,
	form_tags: null, current: 'Вода холодна.', current_en: 'The water is cold.', proposed: 'Вода зимна.',
	proposed_en: 'The water is cold.', note: null, native: true, name: 'Ольга', user_id: null, lang: 'uk',
	...over
});

test('suggestions are stored, listed newest first and reviewed', async () => {
	const db = openMemorySuggestions();
	const first = await addSuggestion(db, suggestion());
	const second = await addSuggestion(db, suggestion({ target: 'meaning', sense_n: 2, tatoeba_id: null, native: false }));
	assert.deepEqual([first, second], [1, 2]);

	const fresh = await listSuggestions(db, 'new');
	assert.deepEqual(fresh.map((s) => s.id), [2, 1]);
	assert.equal(fresh[1].native, 1);
	assert.equal(fresh[1].closed_at, null);
	assert.deepEqual(await countSuggestions(db), { new: 2, accepted: 0, rejected: 0, applied: 0 });

	assert.equal(await reviewSuggestion(db, first, 'accepted', 'Good.'), true);
	assert.equal(await reviewSuggestion(db, 99, 'accepted', null), false);
	const [accepted] = await listSuggestions(db, 'accepted');
	assert.equal(accepted.review_note, 'Good.');
	assert.match(accepted.closed_at ?? '', /^\d{4}-\d\d-\d\dT/);
	assert.deepEqual(await countSuggestions(db), { new: 1, accepted: 1, rejected: 0, applied: 0 });

	// Reopening clears the closing time
	await reviewSuggestion(db, first, 'new', null);
	assert.equal((await listSuggestions(db, 'new'))[1].closed_at, null);
});

// The rules of tatoeba_corrections() in data/import_wiktionary.py: four
// tab-separated columns, a numeric id, a Ukrainian text that is not empty.
const parses = (line: string) => {
	const cols = line.split('\t');
	return cols.length === 4 && /^\d+$/.test(cols[0]) && cols[1] !== '';
};

test('an accepted example fix becomes a line of tatoeba-corrections.tsv', async () => {
	const db = openMemorySuggestions();
	await addSuggestion(db, suggestion());
	await addSuggestion(db, suggestion({ proposed: 'Вода\tхолодна.\nДуже.', proposed_en: "The water's cold.", name: null }));
	await addSuggestion(db, suggestion({ target: 'meaning', tatoeba_id: null }));
	const [meaning, both, ukOnly] = await listSuggestions(db, 'new');

	// English unchanged: the column is left empty, which keeps Tatoeba's
	const day = ukOnly.created_at.slice(0, 10);
	assert.equal(correctionRow(ukOnly), `2301\tВода зимна.\t\tNebokrai suggestion 1, Ольга, ${day}`);
	// A tab or line break in the text must not make a fifth column or a second line
	assert.equal(correctionRow(both), `2301\tВода холодна. Дуже.\tThe water's cold.\tNebokrai suggestion 2, ${day}`);
	for (const row of [correctionRow(ukOnly), correctionRow(both)]) assert.ok(row && parses(row));
	assert.equal(correctionRow(meaning), null);
});

test('a new word is offered only for a Ukrainian search', () => {
	assert.equal(canAddWord('ґудзикоцвіт'), true);
	assert.equal(canAddWord("п'ять"), true);
	assert.equal(canAddWord('пів-яблука'), true);
	assert.equal(canAddWord('вода́'), true);
	assert.equal(canAddWord('dog'), false);
	assert.equal(canAddWord('voda'), false);
	assert.equal(canAddWord('вода 2'), false);
	assert.equal(canAddWord('   '), false);
	assert.equal(canAddWord('а'.repeat(61)), false);
});

test('an English search can ask for the Ukrainian word', () => {
	assert.equal(canAddEnglish('dog'), true);
	assert.equal(canAddEnglish('ice cream'), true);
	assert.equal(canAddEnglish("mother-in-law's"), true);
	assert.equal(canAddEnglish('вода'), false);
	assert.equal(canAddEnglish('2 dogs'), false);
	assert.equal(canAddEnglish('-dog'), false);
	assert.equal(canAddEnglish(''), false);
});

test('a new word may add stress marks and nothing else', () => {
	assert.equal(stressMarks('вода', 'вода'), true);
	assert.equal(stressMarks('вода', 'вода́'), true);
	// ї must survive: a mark after it is a stress, not a new letter
	assert.equal(stressMarks('їжак', 'ї́жак'), true);
	assert.equal(stressMarks('вода', 'Вода́'), false);
	assert.equal(stressMarks('вода', 'вади́'), false);
	assert.equal(stressMarks('вода', 'вд́оа'), false);
	assert.equal(stressMarks('вода', '́вода'), false);
	assert.equal(stressMarks('водограй', 'во́до́гра́й'), false);
	// A grave accent is another mark, not a stress
	assert.equal(stressMarks('водограй', 'во̀догра́й'), false);
});

test('readers asking for the same missing word are counted while it waits', async () => {
	const db = openMemorySuggestions();
	const ask = suggestion({
		target: 'new-word', word: 'ґудзикоцвіт', pos: 'noun', headword: 'ґудзикоцві́т', tatoeba_id: null,
		current: '', current_en: null, proposed: 'a flowering plant', proposed_en: null
	});
	assert.equal(await countWordAsks(db, 'ґудзикоцвіт'), 0);
	const first = await addSuggestion(db, ask);
	await addSuggestion(db, ask);
	assert.equal(await countWordAsks(db, 'ґудзикоцвіт'), 2);
	await reviewSuggestion(db, first, 'rejected', null);
	assert.equal(await countWordAsks(db, 'ґудзикоцвіт'), 1);
	assert.equal(await countWordAsks(db, 'вода'), 0);
});

test('an accepted new word becomes a draft Wiktionary entry', async () => {
	const db = openMemorySuggestions();
	await addSuggestion(db, suggestion({
		target: 'new-word', word: 'ґудзикоцвіт', pos: 'noun', headword: 'ґудзикоцві́т', tatoeba_id: null,
		current: '', current_en: null, proposed: 'a flowering\nplant', proposed_en: null, note: 'Heard it -- twice'
	}));
	await addSuggestion(db, suggestion({
		target: 'new-word', word: 'шось', pos: 'unknown', headword: 'шось', tatoeba_id: null,
		current: '', current_en: null, proposed: 'something', proposed_en: null, note: null
	}));
	const [unsure, noun] = await listSuggestions(db, 'new');
	assert.equal(wiktionaryDraft(noun), [
		'==Ukrainian==', '', '===Noun===', '{{head|uk|noun|head=ґудзикоцві́т}}', '', '# a flowering plant',
		'<!-- Nebokrai suggestion 1: Heard it – twice -->'
	].join('\n'));
	assert.match(wiktionaryDraft(unsure) ?? '', /^===<!-- part of speech -->===$/m);
	assert.equal(wiktionaryDraft((await listSuggestions(db, 'new', 1))[0]), wiktionaryDraft(unsure));
	assert.equal(wiktionaryDraft({ ...noun, target: 'meaning' }), null);
});
