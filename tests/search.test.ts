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
import { search } from '../src/lib/search/search.ts';
import { lookup } from '../src/lib/search/suggest.ts';
import { FROM_TRANSLATIONS, wordCards, wordDetails, wordSummaries } from '../src/lib/search/word.ts';
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
		// How old a result is; recorded only for the cases that have any
		const old = got.results.filter((r) => r.old).map((r) => [r.id, r.old]);
		assert.deepEqual(old, c.old ?? [], `old labels for ${label}`);
		// What a VESUM-only word is (a surname), and the reflexive verb that led to an entry
		const notes = [
			...got.results.filter((r) => r.kind).map((r) => [r.word, r.kind]),
			...got.results.filter((r) => r.through).map((r) => [r.word, r.through!.word])
		];
		assert.deepEqual(notes, c.notes ?? [], `kinds and reflexives for ${label}`);
		// What to say instead of a non-standard word; recorded only for the cases that have any
		const use = got.results.filter((r) => r.use).map((r) => [r.word, r.use!.map((u) => [u.word, u.has_entry])]);
		assert.deepEqual(use, c.use ?? [], `Ukrainian words instead for ${label}`);
	}
});

test('words that are not standard Ukrainian point to Ukrainian ones', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = openLocal('vesum.db');
	// VESUM's own suggestion answers with that word's own entry, saying how it was reached
	const [customs] = await search(db, 'таможня', { vesum });
	assert.deepEqual([customs.word, customs.match, customs.through], ['митниця', 'form', { word: 'таможня', kind: 'nonstandard' }]);
	assert.deepEqual(customs.use, [{ word: 'ми́тниця', has_entry: true }]);
	assert.ok(customs.glosses.length > 0 && customs.id !== null);
	// Several words to say instead: the first with an entry answers, the others ride along
	const [verdict] = await search(db, 'приговор', { vesum });
	assert.equal(verdict.use?.length, 3);
	assert.equal(verdict.use?.[0].word.replace('́', ''), verdict.word);
	// Nebokrai's own list: криша has no VESUM suggestion, and still gives дах, from a form too
	for (const query of ['криша', 'криші']) {
		const [roof] = await search(db, query, { vesum });
		assert.deepEqual([roof.word, roof.through?.word], ['дах', 'криша'], query);
	}
	// ... and without VESUM at all, for the spelling itself
	const [alone] = await search(db, 'криша');
	assert.deepEqual([alone.word, alone.through?.kind], ['дах', 'nonstandard']);
	// таракан is a surname too, but the Russian word comes first
	const [cockroach] = await search(db, 'таракан', { vesum });
	assert.equal(cockroach.word, 'тарган');
	// None of these got an entry from the translation tables
	assert.deepEqual(await wordDetails(db, 'криша'), []);

	// A database built before the lists existed: the word is a bare result, marked, with nothing to offer
	const noTables = (base: typeof db, table: string) => ({
		all: <T>(sql: string, params?: unknown[]) =>
			sql.includes(table)
				? Promise.reject(new Error(`D1_ERROR: no such table: ${table}: SQLITE_ERROR`))
				: base.all<T>(sql, params)
	});
	const [old] = await search(noTables(db, 'nonstandard'), 'таможня', { vesum: noTables(vesum, 'vesum_suggest') });
	assert.deepEqual([old.word, old.vesum_only, old.kind, old.use], ['таможня', true, 'distorted', []]);
});

test('words named on another entry\'s head line', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = openLocal('vesum.db');
	// Another spelling, and an adverb: found without VESUM, and saying how
	const [first] = await search(db, 'уперше');
	assert.deepEqual([first.word, first.match, first.through], ['вперше', 'head', { word: 'упе́рше', kind: 'alternative' }]);
	const [adverb] = await search(db, 'історично');
	assert.deepEqual([adverb.word, adverb.through?.kind], ['історичний', 'adverb']);
	// A form of a head-line word, through VESUM: мінеральних is мінеральний, listed by мінера́л
	const [mineral] = await search(db, 'мінеральних', { vesum });
	assert.deepEqual([mineral.word, mineral.match, mineral.through], ['мінерал', 'form', { word: 'мінера́льний', kind: 'adjective' }]);
	// A head-line word is a sure match: no guesses
	const answer = await lookup(db, 'уперше');
	assert.deepEqual(answer.suggestions, []);
});

test('names and reflexive verbs that only VESUM knows', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = openLocal('vesum.db');
	// No entry, but VESUM says what it is
	const [surname] = await search(db, 'осташка', { vesum });
	assert.deepEqual([surname.word, surname.vesum_only, surname.kind], ['осташко', true, 'surname']);
	// Іванович-like words are a surname too; the patronymic is the likelier
	const [patronymic] = await search(db, 'максимовичу', { vesum });
	assert.equal(patronymic.kind, 'patronymic');
	// A plain word that only VESUM knows has no kind
	// (посідати was one, until the translation tables gave it an entry)
	const [verb] = await search(db, 'походжати', { vesum });
	assert.equal(verb.vesum_only, true);
	assert.equal('kind' in verb, false);

	// автоматизуватися has no entry: the verb it is made from answers, and says how it was reached.
	// (утворюватися was the example until own-meanings.tsv gave it an entry.)
	const [form] = await search(db, 'автоматизуються', { vesum });
	assert.equal(form.word, 'автоматизувати');
	assert.equal(form.match, 'form');
	assert.deepEqual(form.matched_forms, []);
	assert.deepEqual(form.through, { word: 'автоматизуватися', kind: 'reflexive' });
	// A reflexive verb with an entry of its own is that entry, reached through nothing
	const [learn] = await search(db, 'вчитися', { vesum });
	assert.equal(learn.word, 'вчитися');
	assert.equal('through' in learn, false);

	// A vesum.db built before kinds were stored: the word is found, with no kind
	const old = {
		all: <T>(sql: string, params?: unknown[]) =>
			sql.includes('vesum_kinds')
				? Promise.reject(new Error('D1_ERROR: no such table: vesum_kinds: SQLITE_ERROR'))
				: vesum.all<T>(sql, params)
	};
	const [plainStub] = await search(db, 'осташка', { vesum: old });
	assert.deepEqual([plainStub.word, plainStub.vesum_only, 'kind' in plainStub], ['осташко', true, false]);
	// Any other failure is not swallowed
	const broken = {
		all: <T>(sql: string, params?: unknown[]) =>
			sql.includes('vesum_kinds') ? Promise.reject(new Error('database is locked')) : vesum.all<T>(sql, params)
	};
	await assert.rejects(search(db, 'осташка', { vesum: broken }), /locked/);
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

	// A sentence is shown only for the word it is about. осі is a form of both
	// вісь ("axis") and оса ("wasp"); «навколо своєї осі» is about the axis.
	// An older database gives it to both: run data/add_examples.py on it.
	const [wasp] = await wordDetails(db, 'оса');
	const [axis] = await wordDetails(db, 'вісь');
	const hasOsi = (uk: string) => uk.toLowerCase().split(/[^\p{L}]+/u).includes('осі');
	assert.ok(wasp.examples.length > 0 && !wasp.examples.some((x) => hasOsi(x.uk)));
	assert.ok(axis.examples.some((x) => hasOsi(x.uk)));
	const [mother, have] = await wordDetails(db, 'мати');
	const shared = mother.examples.filter((x) => have.examples.some((y) => y.tatoeba_id === x.tatoeba_id));
	assert.deepEqual(shared, []);

	assert.ok((await wordDetails(db, 'стан')).length > 1); // several entries, one spelling
	assert.deepEqual(await wordDetails(db, 'qqqq'), []);

	// Labels Wiktionary leaves in the gloss text: "(Surzhyk) of course, certainly"
	const [kaneshno] = await wordDetails(db, 'канєшно');
	assert.deepEqual(kaneshno.senses[0].tags, ['surzhyk']);
	// data/marked-offensive.tsv marks a slur on Ukrainians and leaves those on Russians
	const [khokhol] = await wordDetails(db, 'хохол');
	assert.equal(khokhol.offensive, true);
	assert.ok(khokhol.senses[0].tags.includes('highly-offensive'));
	const [katsap] = await wordDetails(db, 'кацап');
	assert.equal(katsap.offensive, false);
	assert.ok(katsap.senses[0].tags.includes('slur'));
	assert.equal(kalyna.offensive, false);

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

test('"form of" pages kept as words', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	// більший is a page that only says "comparative degree of великий", and a word all the same:
	// it has an entry and a table of its own, and each of the two names the other
	const [bigger] = await wordDetails(db, 'більший');
	assert.equal(bigger.pos, 'adj');
	assert.equal(bigger.senses[0].gloss, 'comparative degree of вели́кий: bigger, larger, greater');
	assert.ok(bigger.forms.some((f) => f.form === 'бі́льшого'));
	assert.deepEqual(bigger.relations.find((x) => x.word === 'вели́кий'),
		{ kind: 'related', sense_n: 1, word: 'вели́кий', tags: [], has_entry: true });
	const [big] = await wordDetails(db, 'великий');
	assert.deepEqual(big.relations.find((x) => x.word === 'бі́льший'),
		{ kind: 'related', sense_n: null, word: 'бі́льший', tags: [], has_entry: true });

	// A participle is filed under its verb, and declines as the adjective it is
	const [created] = await wordDetails(db, 'створений');
	assert.equal(created.pos, 'adj');
	assert.ok(created.forms.some((f) => f.form === 'ство́рена'));

	// The romanisation is dropped from the gloss, the meaning beside it is kept
	const [author] = await wordDetails(db, 'авторка');
	assert.equal(author.senses[0].gloss, 'female equivalent of а́втор (“author, authoress”)');

	// A cell of another word's table is still no entry (книги, genitive of книга), nor is a misspelling
	assert.ok((await wordDetails(db, 'книги')).every((e) => e.word !== 'книги'));
	assert.deepEqual(await wordDetails(db, 'будь-ласка'), []);
});

test('entries written for Nebokrai', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	// км has no Wiktionary page: the entry is Nebokrai's, shaped like a kept "form of" page
	const [km] = await wordDetails(db, 'км');
	assert.equal(km.source, 'nebokrai');
	assert.equal(km.senses[0].gloss, 'abbreviation of кіломе́тр (“kilometre”)');
	assert.deepEqual(km.relations, [{ kind: 'related', sense_n: 1, word: 'кіломе́тр', tags: [], has_entry: true }]);
	// An abbreviation written with a full stop is found without it too
	const [other] = await wordDetails(db, 'ін');
	assert.deepEqual([other.word, other.source], ['ін.', 'nebokrai']);
	// Everything else is Wiktionary's, an abbreviation it has a page for included
	assert.ok((await wordDetails(db, 'калина')).every((e) => e.source === 'wiktionary'));
	assert.ok((await wordDetails(db, 'ст.')).every((e) => e.source === 'wiktionary'));

	// A database built before entries recorded their source: all of it was Wiktionary's
	const old = {
		all: <T>(sql: string, params?: unknown[]) =>
			sql.includes(', source') && !sql.includes("'wiktionary' AS source")
				? Promise.reject(new Error('D1_ERROR: no such column: source: SQLITE_ERROR'))
				: db.all<T>(sql, params)
	};
	const [oldKm] = await wordDetails(old, 'км');
	assert.equal(oldKm.source, 'wiktionary');
	assert.ok(oldKm.senses.length > 0);
});

test('entries made from translation tables', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	// шериф has no Wiktionary page; "sheriff" lists it in its translation table
	const [sheriff] = await wordDetails(db, 'шериф');
	assert.equal(sheriff.source, FROM_TRANSLATIONS);
	assert.equal(sheriff.headword, 'шери́ф');
	assert.deepEqual(sheriff.senses.map((s) => s.gloss), ['sheriff (all meanings)']);
	assert.deepEqual(sheriff.tags, ['masculine']);
	// Thin: no table of forms and no rank, which keeps it out of the common words
	assert.deepEqual([sheriff.forms, sheriff.freq_rank], [[], null]);
	// A word with a page of its own stays Wiktionary's
	assert.ok((await wordDetails(db, 'комітет')).every((e) => e.source === 'wiktionary'));

	// The head-line key of another entry still finds that entry beside the new one
	const found = await search(db, 'походити');
	assert.deepEqual(found.map((r) => [r.word, r.match]), [['походити', 'word'], ['ходити', 'head']]);
	// Search-as-you-type fills its window from the other entries first: кал lists
	// калина's neighbours, not a hundred rarer words from the tables
	const typed = await search(db, 'кал');
	assert.ok(typed.slice(0, 8).every((r) => r.freq_rank !== null));
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
	// The first of the entry's Tatoeba sentences, not all three. Which one that is
	// follows the sentence ratings (data/sentence-ratings.tsv), so ask the word page.
	const [readEntry] = await wordDetails(db, 'читати');
	assert.ok(read.example);
	assert.deepEqual(read.example, { ...readEntry.examples[0] });
	assert.ok(got.every((c) => c.example === null || c.example.tatoeba_id > 0));
	assert.deepEqual(await wordCards(db, []), []);
	assert.deepEqual(await wordCards(db, ['qqqq']), []);
});
