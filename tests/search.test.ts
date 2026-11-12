// The TypeScript search must return exactly what the Python reference returns.
// The expected results live in search-cases.json (made by data/make_search_cases.py).
//
// Needs nebokrai.db and vesum.db in the repo root; see data/README.md to build them.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
	deletes, editsApart, fromRussianLetters, fromWrongLayout, looseLatin, nationalTranslit, plain, soundKey
} from '../src/lib/search/normalize.ts';
import { lookup } from '../src/lib/search/suggest.ts';
import { wordCards, wordDetails, wordSummaries } from '../src/lib/search/word.ts';
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

test('lenient keys', () => {
	const sound = (cyrillic: string) => soundKey(looseLatin(nationalTranslit(cyrillic)));
	assert.equal(sound('превіт'), sound('привіт'));
	assert.equal(soundKey(looseLatin('shastya')), sound('щастя'));
	assert.equal(soundKey(looseLatin('kiev')), sound('Київ'));
	assert.equal(fromWrongLayout('ghbdsn'), 'привіт');
	assert.equal(fromRussianLetters('книгы'), 'книги');
	assert.deepEqual(deletes('abca').sort(), ['aba', 'abc', 'aca', 'bca']);
	for (const [a, b] of [['abcd', 'abxd'], ['abcd', 'acbd'], ['abcd', 'abd'], ['abd', 'abcd'], ['abcd', 'abcde']]) {
		assert.ok(editsApart(a, b), `${a} ~ ${b}`);
	}
	for (const [a, b] of [['abcd', 'axyd'], ['abcd', 'badc'], ['abcd', 'ab']]) {
		assert.ok(!editsApart(a, b), `${a} !~ ${b}`);
	}
});

const haveData = existsSync('nebokrai.db') && existsSync('vesum.db');
const skip = haveData ? false : 'nebokrai.db or vesum.db is missing';

test('search matches the Python reference', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = openLocal('vesum.db');
	const cases = JSON.parse(readFileSync('tests/search-cases.json', 'utf8'));
	for (const c of cases) {
		const got = await lookup(db, c.query, { limit: 20, vesum: c.vesum ? vesum : undefined });
		const label = `query "${c.query}"${c.vesum ? ' with VESUM' : ''}`;
		const brief = (rows: { id: number | null; word: string; pos: string; match: string }[]) =>
			rows.map((r) => [r.id, r.word, r.pos, r.match]);
		assert.deepEqual(brief(got.results), c.expect, `results for ${label}`);
		assert.deepEqual(brief(got.suggestions), c.suggest, `suggestions for ${label}`);
		// Which forms the query spells; recorded only for the cases that have any
		const forms = got.results
			.filter((r) => r.matched_forms?.length)
			.map((r) => [r.id, r.matched_forms!.map((f) => [f.form, f.tags])]);
		assert.deepEqual(forms, c.forms ?? [], `matched forms for ${label}`);
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

	// The forms beside a headword: the aspect partner has a page, the genitive does not
	assert.deepEqual(read.head_forms.find((f) => f.tags.includes('perfective')),
		{ form: 'прочита́ти', tags: ['perfective'], has_entry: true });
	assert.deepEqual(kalyna.head_forms.find((f) => f.tags.includes('genitive')),
		{ form: 'кали́ни', tags: ['genitive'], has_entry: false });
});

test('related words', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const [big] = await wordDetails(db, 'великий');
	const of = (kind: string) => big.relations.filter((x) => x.kind === kind);
	// An antonym of the first meaning, as Wiktionary has it
	assert.deepEqual(of('antonym')[0], { kind: 'antonym', sense_n: 1, word: 'мали́й', tags: [], has_entry: true });
	// маленький names великий as its antonym, so великий names маленький too,
	// for the entry as a whole
	assert.deepEqual(of('antonym').find((x) => x.word === 'мале́нький'),
		{ kind: 'antonym', sense_n: null, word: 'мале́нький', tags: [], has_entry: true });
	assert.ok(of('derived').length > 20);
	assert.ok(of('derived').some((x) => x.word === 'великоду́шний'));
	assert.ok(big.relations.every((x) => x.word !== 'великий' && x.word !== 'вели́кий')); // never itself

	// Wiktionary writes красивий here without its stress; the headword supplies it
	const [pretty] = await wordDetails(db, 'гарний');
	assert.ok(pretty.relations.some((x) => x.kind === 'synonym' && x.sense_n === 1 && x.word === 'краси́вий'));

	// Every kind is one of the four, and a meaning named is a meaning the entry has
	for (const entry of [big, pretty]) {
		for (const x of entry.relations) {
			assert.ok(['synonym', 'antonym', 'derived', 'related'].includes(x.kind));
			assert.ok(x.sense_n === null || entry.senses.some((s) => s.n === x.sense_n));
		}
	}
});

test('a database built before related words were stored', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const old = {
		all: <T>(sql: string, params?: unknown[]) =>
			sql.includes('FROM relations')
				? Promise.reject(new Error('D1_ERROR: no such table: relations: SQLITE_ERROR'))
				: db.all<T>(sql, params)
	};
	const [big] = await wordDetails(old, 'великий');
	assert.deepEqual(big.relations, []);
	assert.ok(big.senses.length > 0);
	// Any other failure is not swallowed
	const broken = {
		all: <T>(sql: string, params?: unknown[]) =>
			sql.includes('FROM relations') ? Promise.reject(new Error('database is locked')) : db.all<T>(sql, params)
	};
	await assert.rejects(wordDetails(broken, 'великий'), /locked/);
});

test('word summaries', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const got = await wordSummaries(db, ['читати', 'qqqq', 'калина', 'стан']);
	assert.deepEqual(got.map((s) => s.word), ['читати', 'калина', 'стан']); // order kept, unknown left out
	assert.equal(got[1].headword, 'кали́на');
	assert.equal(got[1].pos, 'noun');
	assert.ok(got[1].glosses[0].includes('viburnum'));
	assert.ok(got.every((s) => s.glosses.length >= 1 && s.glosses.length <= 3));
	assert.deepEqual(await wordSummaries(db, ['Калина']), []); // the exact spelling, unlike wordDetails
	assert.deepEqual(await wordSummaries(db, []), []);
});

test('word cards', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const got = await wordCards(db, ['читати', 'qqqq', 'калина', 'стан']);
	// The same words in the same order as the summaries, and the same entry for стан
	const summaries = await wordSummaries(db, ['читати', 'qqqq', 'калина', 'стан']);
	assert.deepEqual(got.map(({ word, headword, pos, glosses }) => ({ word, headword, pos, glosses })), summaries);

	const [read, kalyna] = got;
	assert.equal(kalyna.pos, 'noun');
	assert.deepEqual(kalyna.tags, ['feminine', 'inanimate']);
	assert.equal(kalyna.ipa, '[kɐˈɫɪnɐ]');
	// The first of the entry's Tatoeba sentences, not all three
	assert.deepEqual(read.example, {
		uk: 'У молодості треба багато читати.', en: "You should read a lot of books while you're young.", tatoeba_id: 410638
	});
	assert.ok(got.every((c) => c.example === null || c.example.tatoeba_id > 0));
	assert.deepEqual(await wordCards(db, []), []);
	assert.deepEqual(await wordCards(db, ['qqqq']), []);
});
