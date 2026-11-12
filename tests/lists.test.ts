// Lists of saved words: the rules in src/lib/lists.ts. Needs no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	LIST_ID, cleanListName, nameTaken, newListId, parseLists, planListMerge, pruneLists, renamed, withList,
	withWords, withoutList, withoutWords
} from '../src/lib/lists.ts';
import { MAX_LISTS, MAX_LIST_NAME, type WordList } from '../src/lib/saved.ts';

const T0 = 1_800_000_000_000;
const list = (id: string, name: string, words: string[] = [], at = T0): WordList =>
	({ id: `wordlist-${id}`, name, created_at: at, words });

test('a list name is cleaned before it is kept', () => {
	assert.equal(cleanListName('  Урок \t 3\n'), 'Урок 3');
	// й typed as и + a combining breve is the same name as й
	assert.equal(cleanListName('Чайй'), 'Чайй');
	assert.equal(cleanListName('я'.repeat(MAX_LIST_NAME)), 'я'.repeat(MAX_LIST_NAME));
	for (const bad of ['', '   ', 'я'.repeat(MAX_LIST_NAME + 1), 7, null, undefined, ['Їжа']]) {
		assert.equal(cleanListName(bad), null);
	}
});

test('names differing only in letter case are one name', () => {
	const lists = [list('a', 'Їжа'), list('b', 'Дієслова')];
	assert.ok(nameTaken(lists, 'їжа'));
	assert.ok(nameTaken(lists, 'ДІЄСЛОВА'));
	assert.ok(!nameTaken(lists, 'Їжак'));
	assert.ok(!nameTaken(lists, 'їжа', 'wordlist-a')); // renaming a list to its own name
});

test('a new list id has the shape the server accepts', () => {
	assert.match(newListId(), LIST_ID);
	assert.notEqual(newListId(), newListId());
});

test('lists from a browser are read defensively', () => {
	const now = T0 + 100;
	for (const junk of [null, 'Їжа', 7, { id: 'wordlist-a' }]) assert.deepEqual(parseLists(junk, now), []);
	assert.deepEqual(
		parseLists([
			{ id: 'wordlist-a', name: ' Їжа ', created_at: T0, words: ['хліб', 'хліб', '', 7, null, 'я'.repeat(101), 'сир'] },
			{ id: 'wordlist-a', name: 'Twice', created_at: T0, words: [] }, // an id only once
			{ id: 'short', name: 'Bad id', created_at: T0, words: [] },
			{ id: 'has space', name: 'Bad id', created_at: T0, words: [] },
			{ id: 'wordlist-b', name: '   ', created_at: T0, words: [] },
			null, 'Їжа',
			{ id: 'wordlist-c', name: 'No words', created_at: now + 1 }, // a future date becomes now
			{ id: 'wordlist-d', name: 'Words not a list', created_at: 'вчора', words: 'хліб' }
		], now),
		[
			{ id: 'wordlist-a', name: 'Їжа', created_at: T0, words: ['хліб', 'сир'] },
			{ id: 'wordlist-c', name: 'No words', created_at: now, words: [] },
			{ id: 'wordlist-d', name: 'Words not a list', created_at: now, words: [] }
		]);
	const many = Array.from({ length: MAX_LISTS + 1 }, (_, i) => list(String(i).padStart(3, '0'), `Урок ${i}`));
	assert.equal(parseLists(many, now).length, MAX_LISTS);
});

test('merging a browser\'s lists into an account', () => {
	const account = [list('a', 'Їжа', ['хліб']), list('b', 'Дієслова', ['іти'])];

	// Same id: the words join, and nothing is created even though the name differs.
	assert.deepEqual(planListMerge(account, [list('a', 'Food', ['сир', 'хліб'])]),
		{ create: [], pairs: [['wordlist-a', 'сир'], ['wordlist-a', 'хліб']] });

	// Same name under another id, in another letter case: folded into the account's list.
	assert.deepEqual(planListMerge(account, [list('x', 'їжа', ['сир'])]),
		{ create: [], pairs: [['wordlist-a', 'сир']] });

	// A new list is created; a second sent list with its name folds into the first.
	assert.deepEqual(
		planListMerge(account, [list('x', 'Урок 3', ['школа'], T0 + 5), list('y', 'урок 3', ['клас'])]),
		{
			create: [{ id: 'wordlist-x', name: 'Урок 3', created_at: T0 + 5 }],
			pairs: [['wordlist-x', 'школа'], ['wordlist-x', 'клас']]
		});

	// At the limit a new list is dropped, but a list the account has still gains words.
	assert.deepEqual(
		planListMerge(account, [list('x', 'Урок 3', ['школа']), list('y', 'Урок 4', ['клас']), list('b', 'Дієслова', ['їсти'])], 3),
		{ create: [{ id: 'wordlist-x', name: 'Урок 3', created_at: T0 }], pairs: [['wordlist-x', 'школа'], ['wordlist-b', 'їсти']] });

	assert.deepEqual(planListMerge(account, []), { create: [], pairs: [] });
});

test('changes to the browser\'s copy leave the old lists alone', () => {
	const lists = [list('a', 'Їжа', ['хліб', 'сир']), list('b', 'Дієслова', ['іти'], T0 + 1)];
	const before = structuredClone(lists);

	assert.deepEqual(withList(lists, list('c', 'Урок 3', [], T0 - 1)).map((l) => l.id), ['wordlist-c', 'wordlist-a', 'wordlist-b']);
	// Putting back a list that is there replaces it (Undo after a delete that failed half way).
	assert.deepEqual(withList(lists, list('a', 'Їжа', ['сир'])).map((l) => l.words), [['сир'], ['іти']]);
	assert.deepEqual(withoutList(lists, 'wordlist-a').map((l) => l.id), ['wordlist-b']);
	assert.deepEqual(renamed(lists, 'wordlist-b', 'Рух').map((l) => l.name), ['Їжа', 'Рух']);

	assert.deepEqual(withWords(lists, 'wordlist-a', ['сир', 'молоко']).map((l) => l.words),
		[['хліб', 'сир', 'молоко'], ['іти']]);
	assert.deepEqual(withoutWords(lists, 'wordlist-a', ['сир', 'іти']).map((l) => l.words), [['хліб'], ['іти']]);
	// With no list named, the word leaves every list: it is no longer saved.
	assert.deepEqual(withoutWords(withWords(lists, 'wordlist-b', ['сир']), null, ['сир']).map((l) => l.words),
		[['хліб'], ['іти']]);
	assert.deepEqual(pruneLists(lists, new Set(['хліб', 'іти'])).map((l) => l.words), [['хліб'], ['іти']]);

	assert.deepEqual(lists, before);
	// An untouched list is the same object, so nothing that shows it is redrawn.
	assert.equal(withoutWords(lists, 'wordlist-a', ['сир'])[1], lists[1]);
	assert.equal(pruneLists(lists, new Set(['хліб', 'сир']))[0], lists[0]);
});
