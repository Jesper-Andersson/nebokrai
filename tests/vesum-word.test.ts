// Pages for words only VESUM knows (src/lib/search/vesum-word.ts).
//
// Needs nebokrai.db and a vesum.db built on or after 2026-11-17 in the repo
// root; see data/README.md to build them.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { formTables } from '../src/lib/forms.ts';
import { wordSlug } from '../src/lib/search/slug.ts';
import { vesumFormsFor, vesumWords, vesumWordsBySlug } from '../src/lib/search/vesum-word.ts';
import { openLocal } from './local-db.ts';

const haveData = existsSync('nebokrai.db') && existsSync('vesum.db');
const skip = haveData ? false : 'nebokrai.db or vesum.db is missing';

/** A database whose `table` is missing, as in a vesum.db built before the table was. */
const noTable = (base: ReturnType<typeof openLocal>, table: string) => ({
	all: <T>(sql: string, params?: unknown[]) =>
		sql.includes(table)
			? Promise.reject(new Error(`D1_ERROR: no such table: ${table}: SQLITE_ERROR`))
			: base.all<T>(sql, params)
});

test('a noun only VESUM knows has a page with its whole declension', { skip }, async () => {
	const [db, vesum] = [openLocal('nebokrai.db'), openLocal('vesum.db')];
	const words = await vesumWordsBySlug(db, vesum, wordSlug('книжечка'));
	assert.equal(words.length, 1);
	const [word] = words;
	assert.deepEqual([word.word, word.pos, word.tags], ['книжечка', 'noun', ['feminine', 'inanimate']]);
	assert.equal(word.forms.length, 14);
	assert.equal(word.kind, undefined);
	// formTables draws it like a Wiktionary entry: instrumental singular in its cell, nothing left over.
	const { tables, other } = formTables('noun', word.forms, word.word);
	assert.equal(other.length, 0);
	const instrumental = tables[0].rows.find((r) => r.label === 'Instrumental');
	assert.deepEqual(instrumental?.cells.map((c) => c.map((i) => i.form)), [['книжечкою'], ['книжечками']]);
});

test('a verb has its present, future, past and imperative', { skip }, async () => {
	const [db, vesum] = [openLocal('nebokrai.db'), openLocal('vesum.db')];
	const [word] = await vesumWords(db, vesum, 'читати');
	assert.deepEqual([word.pos, word.tags], ['verb', ['imperfective']]);
	const { tables } = formTables('verb', word.forms, word.word);
	assert.deepEqual(tables.map((t) => t.title), ['Present', 'Future', 'Past', 'Imperative']);
});

test('a surname says so, once per gender', { skip }, async () => {
	const [db, vesum] = [openLocal('nebokrai.db'), openLocal('vesum.db')];
	const words = await vesumWordsBySlug(db, vesum, wordSlug('осташко'));
	assert.ok(words.length >= 2);
	assert.ok(words.every((w) => w.kind === 'surname'));
	assert.deepEqual(new Set(words.map((w) => w.tags.find((t) => t.endsWith('ine') || t === 'neuter'))),
		new Set(['masculine', 'feminine']));
});

test('a distorted word keeps its table, marked, and says what to use instead', { skip }, async () => {
	const [db, vesum] = [openLocal('nebokrai.db'), openLocal('vesum.db')];
	const [word] = await vesumWords(db, vesum, 'таможня');
	assert.equal(word.kind, 'distorted');
	assert.ok(word.use?.some((u) => u.word.replace(/́/g, '') === 'митниця'));
	assert.ok(word.forms.every((f) => f.tags.includes('nonstandard')));
});

test('a vesum.db without the new tables gives no page, and no error', { skip }, async () => {
	const [db, vesum] = [openLocal('nebokrai.db'), openLocal('vesum.db')];
	assert.deepEqual(await vesumWordsBySlug(db, noTable(vesum, 'vesum_words'), wordSlug('книжечка')), []);
	assert.deepEqual(await vesumFormsFor(noTable(vesum, 'vesum_paradigms'), 'книжечка', 'noun'), []);
});

test('a dictionary word with no forms can borrow VESUM\'s, but only an unambiguous paradigm', { skip }, async () => {
	const vesum = openLocal('vesum.db');
	assert.equal((await vesumFormsFor(vesum, 'книжечка', 'noun')).length, 14);
	assert.deepEqual(await vesumFormsFor(vesum, 'книжечка', 'verb'), []);
	// осташко is a noun twice over (two genders): no table rather than the wrong one.
	assert.deepEqual(await vesumFormsFor(vesum, 'осташко', 'noun'), []);
});
