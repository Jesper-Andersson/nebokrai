// The TypeScript search must return exactly what the Python reference returns.
// The expected results live in search-cases.json (made by data/make_search_cases.py).
//
// Needs nebokrai.db and vesum.db in the repo root; see data/README.md to build them.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { looseLatin, nationalTranslit, plain } from '../src/lib/search/normalize.ts';
import { search } from '../src/lib/search/search.ts';
import { wordDetails } from '../src/lib/search/word.ts';
import { openLocal } from './local-db.ts';

test('normalisation', () => {
	assert.equal(plain('Кали́на'), 'калина');
	for (const typed of ["м'яти", 'м’яти', 'мʼяти', 'м`яти', 'м´яти', 'м‘яти']) {
		assert.equal(plain(typed), "м'яти");
	}
	assert.equal(plain('її'), 'її'); // ї must survive stress removal
	assert.equal(nationalTranslit('калина'), 'kalyna');
	assert.equal(nationalTranslit('Київ'), 'kyiv');
	assert.equal(nationalTranslit('щастя'), 'shchastia');
	assert.equal(nationalTranslit('Юрій'), 'yurii');
	for (const spelling of ['kalyna', 'kalina', 'kalýna', 'Kallyna']) {
		assert.equal(looseLatin(spelling), 'kalina');
	}
	for (const spelling of ['khata', 'xata', 'hata']) assert.equal(looseLatin(spelling), 'hata');
});

const haveData = existsSync('nebokrai.db') && existsSync('vesum.db');
const skip = haveData ? false : 'nebokrai.db or vesum.db is missing';

test('search matches the Python reference', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = openLocal('vesum.db');
	const cases = JSON.parse(readFileSync('tests/search-cases.json', 'utf8'));
	for (const c of cases) {
		const got = await search(db, c.query, { limit: 20, vesum: c.vesum ? vesum : undefined });
		assert.deepEqual(
			got.map((r) => [r.id, r.word, r.pos, r.match]),
			c.expect,
			`query "${c.query}"${c.vesum ? ' with VESUM' : ''}`
		);
	}
});

test('word details', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const [kalyna] = await wordDetails(db, 'Кали́на');
	assert.equal(kalyna.headword, 'кали́на');
	assert.deepEqual(kalyna.tags, ['feminine', 'inanimate']);
	assert.equal(kalyna.forms.length, 7);
	assert.ok(kalyna.senses[0].gloss.includes('viburnum'));

	const [read] = await wordDetails(db, 'читати');
	assert.equal(read.examples.length, 3);
	assert.ok(read.forms.every((f) => !f.tags.includes('error-unrecognized-form')));

	assert.ok((await wordDetails(db, 'стан')).length > 1); // several entries, one spelling
	assert.deepEqual(await wordDetails(db, 'qqqq'), []);
});
