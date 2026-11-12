// The grammar words and what stands beside them (src/lib/grammar.ts), their
// names and notes in both languages (i18n.ts), and the pronouns in a verb's
// tables (forms.ts).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { formTables } from '../src/lib/forms.ts';
import {
	entryParts, EXAMPLES, GROUPS, headFormLabel, HINTS, otherFormLabel, pronounFor, termOf, termOfLabel, TERMS
} from '../src/lib/grammar.ts';
import { formName, messagesFor, tagLabel } from '../src/lib/i18n.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { wordDetails } from '../src/lib/search/word.ts';
import { openLocal } from './local-db.ts';

const hasDb = existsSync('nebokrai.db');
const en = messagesFor('en');
const uk = messagesFor('uk');

test('every term has a name and a note in both languages', () => {
	assert.equal(new Set(TERMS).size, TERMS.length, 'a term is in two groups');
	assert.equal(TERMS.length, Object.values(GROUPS).flat().length);
	for (const id of TERMS) {
		for (const [lang, m] of [['en', en], ['uk', uk]] as const) {
			const term = m.grammar.terms[id];
			assert.ok(term?.name.trim(), `${lang}: ${id} has no name`);
			assert.ok(term.text.trim().length > 10, `${lang}: ${id} has no note`);
			assert.match(term.text, /[.!?)]$/, `${lang}: the note on ${id} does not end a sentence`);
		}
		// "1st person" and "1-ша особа": a name left in English would be the same in both
		assert.notEqual(uk.grammar.terms[id].name, en.grammar.terms[id].name, `${id} is not translated`);
	}
	// A hint or an example for a word that is no term would never be shown
	for (const id of [...Object.keys(HINTS), ...Object.keys(EXAMPLES)]) assert.ok(TERMS.includes(id as never), id);
});

test('tags and parts of speech lead to their terms', () => {
	assert.equal(termOf('feminine'), 'feminine');
	assert.equal(termOf('adj'), 'adjective');
	assert.equal(termOf('animal-not-person'), 'animal');
	assert.equal(termOf('figuratively'), 'figurative');
	assert.equal(termOf('Internet'), undefined);
	assert.equal(termOfLabel('2nd person singular'), 'second-person');
	assert.equal(termOfLabel('Present'), undefined);

	assert.equal(tagLabel(en, 'en', 'animal-not-person'), 'animal');
	assert.equal(tagLabel(uk, 'uk', 'feminine'), 'жіночий рід');
	assert.equal(tagLabel(en, 'en', 'no-comparative'), 'no comparative');
	assert.equal(tagLabel(uk, 'uk', 'rare'), 'рідкісне');
});

test('the line under a headword: gender first, with its pronoun', () => {
	// The database keeps tags in alphabetical order
	assert.deepEqual(entryParts(['feminine', 'inanimate']), [
		{ tag: 'feminine', term: 'feminine', hint: 'вона' },
		{ tag: 'inanimate', term: 'inanimate', hint: undefined }
	]);
	// A search result leaves out what the noun is
	assert.deepEqual(entryParts(['inanimate', 'masculine'], true).map((part) => part.tag), ['masculine']);
	assert.deepEqual(entryParts(['imperfective']).map((part) => part.term), ['imperfective']);
	// грязну́ля: "personal" is the same word as "person" to a reader, and stays one
	const both = entryParts(['by-personal-gender', 'feminine', 'masculine', 'person', 'personal']);
	assert.deepEqual(both.map((part) => part.term), ['masculine', 'feminine', 'person', 'common-gender']);
});

test('a form beside the headword gets a name a learner can read', () => {
	const name = (tags: string[]) => {
		const label = headFormLabel(tags);
		return formName(en, 'en', label.key && en.grammar.headForms[label.key], label.extra);
	};
	assert.equal(name(['genitive']), 'genitive');
	assert.equal(name(['nominative', 'plural']), 'plural');
	assert.equal(name(['genitive', 'plural']), 'genitive plural');
	assert.equal(name(['adjective', 'relational']), 'related adjective');
	assert.equal(name(['abstract-noun']), 'related noun');
	assert.equal(name(['perfective']), 'perfective partner');
	assert.equal(name(['imperfective', 'rare']), 'imperfective partner (rare)');
	assert.equal(name(['feminine']), 'feminine form');
	assert.equal(name(['alternative']), 'also');
	assert.equal(name(['alternative', 'dialectal']), 'also (dialectal)');
	// dvádcjatʹ odýn beside два́дцять оди́н: the headword in Latin letters has no name
	assert.equal(name([]), '');
	// за́гадка, зага́дка: the gender and animacy are on the line already
	assert.equal(name(['canonical', 'feminine', 'inanimate']), 'also');
	// Nothing fits: the tags as they are, so no form is lost
	assert.equal(name(['romanization']), 'romanization');

	assert.equal(headFormLabel(['adjective', 'relational']).term, 'relational');
	assert.equal(headFormLabel(['genitive', 'plural']).term, 'genitive');
	assert.equal(headFormLabel(['alternative']).term, undefined);

	const ukLabel = headFormLabel(['alternative', 'dialectal']);
	assert.equal(formName(uk, 'uk', uk.grammar.headForms[ukLabel.key!], ukLabel.extra), 'також (діалектне)');
});

test('a verb form outside the tables gets its name', () => {
	const name = (tags: string[]) => {
		const label = otherFormLabel(tags);
		return formName(en, 'en', label.key && en.grammar.otherForms[label.key], label.extra);
	};
	assert.equal(name(['imperfective', 'infinitive']), 'infinitive');
	assert.equal(name(['adverbial', 'past']), 'past adverbial participle');
	assert.equal(name(['adverbial', 'present']), 'present adverbial participle');
	assert.equal(name(['passive', 'past']), 'past passive participle');
	assert.equal(name(['active', 'past', 'participle']), 'past active participle');
	// прочи́тано is "passive, past" too, and is not a participle
	assert.equal(name(['impersonal', 'passive', 'past']), 'impersonal past');
	assert.equal(otherFormLabel(['adverbial', 'past']).term, 'adverbial-participle');
	// Nothing fits: the tags, with the person as a reader writes it
	assert.equal(name(['first-person', 'plural']), '1st person, plural');
});

test('a verb form has its pronoun', () => {
	assert.equal(pronounFor(['present', 'first-person', 'singular']), 'я');
	assert.equal(pronounFor(['present', 'third-person', 'singular']), 'він/вона');
	assert.equal(pronounFor(['future', 'second-person', 'plural']), 'ви');
	assert.equal(pronounFor(['past', 'feminine', 'singular']), 'вона');
	assert.equal(pronounFor(['past', 'plural']), 'вони');
	assert.equal(pronounFor(['imperative', 'second-person', 'singular']), '(ти)');
	// A declension has no one who acts
	assert.equal(pronounFor(['genitive', 'singular']), undefined);
});

test('the tables of a verb carry the pronouns, a noun’s do not', { skip: !hasDb }, async () => {
	const db = openLocal('nebokrai.db');
	const [chytaty] = await wordDetails(db, 'читати');
	const { tables, other } = formTables(chytaty.pos, chytaty.forms, chytaty.word);
	const table = (title: string) => tables.find((t) => t.title === title)!;
	assert.deepEqual(table('Present').rows.map((row) => row.leads), [['я', 'ми'], ['ти', 'ви'], ['він/вона', 'вони']]);
	assert.deepEqual(table('Past').rows.map((row) => row.leads), [['він'], ['вона'], ['воно'], ['вони']]);
	assert.deepEqual(table('Imperative').rows.map((row) => row.leads), [['(ти)'], ['(ми)'], ['(ви)']]);
	assert.ok(other.some((group) => otherFormLabel(group.tags).key === 'infinitive'));

	const [kava] = await wordDetails(db, 'кава');
	const declension = formTables(kava.pos, kava.forms, kava.word).tables[0];
	assert.equal(declension.rows.length, 7);
	assert.ok(declension.rows.every((row) => row.leads === undefined));

	// новий: the accusative cell holds two forms, told apart by a tag the page names
	const [novyi] = await wordDetails(db, 'новий');
	const accusative = formTables(novyi.pos, novyi.forms, novyi.word).tables[0].rows[3];
	const notes = accusative.cells.flat().map((item) => item.note).filter(Boolean);
	assert.ok(notes.includes('animate') && notes.includes('inanimate'), notes.join());
});

test('the dictionary’s own tags are all named', { skip: !hasDb }, async () => {
	const db = openLocal('nebokrai.db');
	const entries = await db.all<{ pos: string; tags: string; head_forms: string }>(
		'SELECT pos, tags, head_forms FROM entries');

	// Every tag on an entry's own line has a term to explain it
	const unnamed = new Set<string>();
	for (const entry of entries) {
		for (const tag of JSON.parse(entry.tags) as string[]) if (!termOf(tag)) unnamed.add(tag);
	}
	assert.deepEqual([...unnamed], []);

	// Nearly every form beside a headword gets a name, not its raw tags
	let forms = 0;
	let named = 0;
	for (const entry of entries) {
		for (const form of JSON.parse(entry.head_forms) as { tags: string[] }[]) {
			forms += 1;
			if (headFormLabel(form.tags).key) named += 1;
		}
	}
	assert.ok(named / forms > 0.97, `${named} of ${forms} forms beside a headword have a name`);
});

test('every example is spelled as the dictionary spells it', { skip: !hasDb }, async () => {
	const db = openLocal('nebokrai.db');
	// The forms beside a headword (нові́ший) are in no table of forms
	const beside = new Set<string>();
	for (const { head_forms } of await db.all<{ head_forms: string }>('SELECT head_forms FROM entries')) {
		for (const { form } of JSON.parse(head_forms) as { form: string }[]) beside.add(plain(form));
	}
	// Right, and the dictionary has no entry for it yet
	const missing = new Set(['немає']);

	for (const [id, example] of Object.entries(EXAMPLES)) {
		for (const word of example.uk.match(/\p{L}+/gu) ?? []) {
			const key = plain(word);
			if (beside.has(key) || missing.has(key)) continue;
			const found = await db.all(
				"SELECT 1 FROM search_keys WHERE key = ? AND kind IN ('word', 'form') LIMIT 1", [key]);
			assert.ok(found.length > 0, `${id}: "${word}" is not in the dictionary`);
		}
	}
});
