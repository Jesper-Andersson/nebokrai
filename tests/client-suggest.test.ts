// Browser-side suggestions. Needs no database: a short word list stands in for words.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildIndex, suggestLocal } from '../src/lib/search/client-suggest.ts';

// Most common first, as export_wordlist.py writes them.
const index = buildIndex([
	'приві́т', 'кни́га', 'до́брий', 'дя́кую', 'ща́стя', 'Ки́їв', 'кали́на', 'календа́р',
	'привіта́ти', 'добра́ніч', "м'я́ти", 'небокра́й'
]);
const words = (query: string) => suggestLocal(index, query).map((s) => `${s.word}:${s.match}`);

test('prefix, in Cyrillic and in Latin', () => {
	assert.deepEqual(words('кал'), ['калина:prefix', 'календар:prefix']);
	assert.deepEqual(words('kal'), ['калина:prefix', 'календар:prefix']);
	assert.deepEqual(words('Приві'), ['привіт:prefix', 'привітати:prefix']);
	assert.deepEqual(words('pryvit'), ['привіт:prefix', 'привітати:prefix']);
	assert.deepEqual(words('м`я'), ["м'яти:prefix"]);
});

test('wrong keyboard layout', () => {
	assert.deepEqual(words('rfkb'), ['калина:layout']);
});

test('sound-alikes and typos', () => {
	assert.deepEqual(words('превіт'), ['привіт:sound', 'привітати:sound']);
	assert.deepEqual(words('shast'), ['щастя:sound']);
	assert.deepEqual(words('kiev'), ['київ:sound']);
	assert.deepEqual(words('привфт'), ['привіт:typo']);
	assert.deepEqual(words('небокрий'), ['небокрай:typo']);
	assert.deepEqual(words('dobranich'), ['добраніч:prefix']);
});

test('nothing to offer', () => {
	assert.deepEqual(words(''), []);
	assert.deepEqual(words('qqqq'), []);
	assert.equal(suggestLocal(index, 'к', 3).length, 3);
});
