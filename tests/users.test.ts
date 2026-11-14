// Accounts, sessions and saved words (src/lib/server/users.ts), against an
// in-memory database. Needs no dictionary data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_REVIEW } from '../src/lib/review/cards.ts';
import { AGAIN, GOOD, answer, newCard } from '../src/lib/review/fsrs.ts';
import { MAX_LISTS, MAX_SAVED } from '../src/lib/saved.ts';
import {
	SESSION_MS, accountStats, addToLists, createSession, deleteList, deleteSession, deleteUser, findOrCreateUser, getReviewSettings,
	hasList, listExported, listLists, listReviewCards, listReviewDays, listSaved, markExported, mergeLists, mergeSaved,
	parseExportedMarks, parseExportedWords, parseSavedWords, parseWords, putList, removeFromList, removeWord,
	saveReviewCards, saveReviewDays, saveReviewSettings, saveWord, validateSession
} from '../src/lib/server/users.ts';
import { openMemoryUsers } from './local-db.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000;

test('one account per provider login', async () => {
	const db = openMemoryUsers();
	const olena = await findOrCreateUser(db, 'github', '42', 'Олена');
	assert.equal(await findOrCreateUser(db, 'github', '42', 'Олена Шевченко'), olena);
	assert.notEqual(await findOrCreateUser(db, 'google', '42', 'Олена'), olena); // same id, other provider
	assert.deepEqual(await db.all('SELECT name FROM users WHERE id = ?', [olena]), [{ name: 'Олена Шевченко' }]);
	assert.equal((await db.all('SELECT 1 FROM users')).length, 2);
});

test('sessions', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена', T0);
	const { token, expiresAt } = await createSession(db, user, T0);
	assert.equal(expiresAt, T0 + SESSION_MS);
	// Only the hash is stored.
	assert.deepEqual(await db.all('SELECT 1 FROM sessions WHERE id = ?', [token]), []);

	assert.deepEqual(await validateSession(db, token, T0 + DAY),
		{ user: { id: user, name: 'Олена' }, expiresAt, renewed: false });
	assert.equal(await validateSession(db, 'not-a-token', T0), null);

	// Used in its second half: extended to the full length again.
	const late = await validateSession(db, token, T0 + 20 * DAY);
	assert.deepEqual([late?.renewed, late?.expiresAt], [true, T0 + 20 * DAY + SESSION_MS]);

	// Expired: refused, and the row is gone.
	assert.equal(await validateSession(db, token, T0 + 60 * DAY), null);
	assert.deepEqual(await db.all('SELECT 1 FROM sessions'), []);

	const second = await createSession(db, user, T0);
	await deleteSession(db, second.token);
	assert.equal(await validateSession(db, second.token, T0), null);
});

test('saved words', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', null);
	const other = await findOrCreateUser(db, 'github', '43', null);

	assert.ok(await saveWord(db, user, 'книга', T0));
	assert.ok(await saveWord(db, user, 'привіт', T0 + 1));
	assert.ok(await saveWord(db, user, 'книга', T0 + 2)); // again: fine, keeps its date
	assert.deepEqual(await listSaved(db, user),
		[{ word: 'привіт', saved_at: T0 + 1 }, { word: 'книга', saved_at: T0 }]);
	assert.deepEqual(await listSaved(db, other), []);

	// Merging a browser's list: a union, and the same again changes nothing.
	const local = [{ word: 'небокрай', saved_at: T0 + 5 }, { word: 'книга', saved_at: T0 + 9 }];
	const merged = await mergeSaved(db, user, local);
	assert.deepEqual(merged.map((w) => [w.word, w.saved_at - T0]), [['небокрай', 5], ['привіт', 1], ['книга', 0]]);
	assert.deepEqual(await mergeSaved(db, user, local), merged);
	assert.deepEqual(await mergeSaved(db, user, []), merged);

	await removeWord(db, user, 'привіт');
	assert.deepEqual((await listSaved(db, user)).map((w) => w.word), ['небокрай', 'книга']);
});

test('saved words stop at the limit', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', null);
	const many = Array.from({ length: MAX_SAVED + 10 }, (_, i) => ({ word: `слово${i}`, saved_at: T0 + i }));
	await mergeSaved(db, user, many.slice(0, MAX_SAVED - 1));
	// One place left; a word already in the list does not use it up.
	assert.equal((await mergeSaved(db, user, [many[0], ...many.slice(MAX_SAVED - 1)])).length, MAX_SAVED);
	assert.equal(await saveWord(db, user, 'зайве'), false);
	assert.ok(await saveWord(db, user, 'слово0')); // already there
	assert.equal((await listSaved(db, user)).length, MAX_SAVED);
});

test('deleting an account removes everything', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена');
	const other = await findOrCreateUser(db, 'google', '7', 'Тарас');
	const { token } = await createSession(db, user);
	await saveWord(db, user, 'книга');
	await saveWord(db, other, 'книга');
	await markExported(db, user, { книга: T0 });
	await markExported(db, other, { книга: T0 });
	for (const who of [user, other]) {
		await saveReviewCards(db, who, [answer(newCard('книга', T0), GOOD, T0)], T0);
		await saveReviewSettings(db, who, { new_per_day: 5, decks: ['saved'], updated_at: T0 });
		await putList(db, who, 'list-read', 'Читання');
		await addToLists(db, who, [['list-read', 'книга']]);
	}

	await deleteUser(db, user);
	assert.equal(await validateSession(db, token), null);
	const tables = [
		'users', 'identities', 'saved_words', 'exported_words', 'review_cards', 'review_settings', 'lists', 'list_words'
	];
	for (const table of tables) {
		assert.equal((await db.all(`SELECT 1 FROM ${table}`)).length, 1, table); // only Тарас is left
	}
	assert.notEqual(await findOrCreateUser(db, 'github', '42', 'Олена'), user); // a new account
});

test('review cards: the copy reviewed later is kept', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена');
	const other = await findOrCreateUser(db, 'google', '7', 'Тарас');
	const once = answer(newCard('книга', T0), GOOD, T0);
	const twice = answer(once, GOOD, once.due);
	const bread = answer(newCard('хліб', T0), AGAIN, T0);

	await saveReviewCards(db, user, [twice, bread], T0 + 1000);
	assert.deepEqual(await listReviewCards(db, user), [twice, bread]); // by word: к before х
	assert.deepEqual(await listReviewCards(db, other), []);

	// An older copy arriving late, from a browser that was offline, changes nothing.
	await saveReviewCards(db, user, [once], T0 + 2000);
	assert.deepEqual(await listReviewCards(db, user), [twice, bread]);
	assert.deepEqual(await listReviewCards(db, user, T0 + 2000), []);

	// A later review replaces the card, and only that card is new to another browser.
	const thrice = answer(twice, GOOD, twice.due);
	await saveReviewCards(db, user, [thrice], T0 + 3000);
	assert.deepEqual(await listReviewCards(db, user, T0 + 2000), [thrice]);
	assert.deepEqual(await listReviewCards(db, user, T0 + 3000), [thrice]); // "at or after"
	assert.deepEqual(await listReviewCards(db, user, T0 + 3001), []);
});

test('review cards stop at the limit, but cards already there can still change', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена');
	const card = answer(newCard('книга', T0), GOOD, T0);
	const many = Array.from({ length: MAX_REVIEW + 5 }, (_, i) => ({ ...card, word: `слово${i}` }));
	await saveReviewCards(db, user, many, T0);
	assert.equal((await listReviewCards(db, user)).length, MAX_REVIEW);

	await saveReviewCards(db, user, [card, answer(many[0], GOOD, card.due)], T0 + 1000);
	assert.deepEqual((await listReviewCards(db, user, T0 + 1000)).map((c) => [c.word, c.reps]), [['слово0', 2]]);
});

test('review days: each browser replaces its own count, and is told the others', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена');
	const other = await findOrCreateUser(db, 'google', '7', 'Тарас');
	await saveReviewDays(db, user, 'laptop-0001', { '2026-11-11': 10, '2026-11-12': 4 });
	await saveReviewDays(db, user, 'phone-00001', { '2026-11-12': 6 });
	assert.deepEqual(await listReviewDays(db, user), { '2026-11-11': 10, '2026-11-12': 10 });
	assert.deepEqual(await listReviewDays(db, user, 'laptop-0001'), { '2026-11-12': 6 });
	assert.deepEqual(await listReviewDays(db, other), {});

	// Sent again, and then with one answer undone: the count is replaced, never added to.
	await saveReviewDays(db, user, 'phone-00001', { '2026-11-12': 6 });
	await saveReviewDays(db, user, 'phone-00001', { '2026-11-12': 5 });
	assert.deepEqual(await listReviewDays(db, user), { '2026-11-11': 10, '2026-11-12': 9 });
	// A day undone to nothing is no day at all.
	await saveReviewDays(db, user, 'laptop-0001', { '2026-11-11': 0 });
	assert.deepEqual(await listReviewDays(db, user), { '2026-11-12': 9 });

	await deleteUser(db, user);
	assert.deepEqual(await db.all('SELECT 1 FROM review_days'), []);
});

test('review settings: the later change is kept', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена');
	assert.equal(await getReviewSettings(db, user), null);
	const later = { new_per_day: 20, decks: ['saved', 'common-500'], updated_at: T0 + 1000 };
	await saveReviewSettings(db, user, later);
	await saveReviewSettings(db, user, { new_per_day: 5, decks: ['saved'], updated_at: T0 });
	assert.deepEqual(await getReviewSettings(db, user), later);
});

test('a list sent by a browser is read defensively', () => {
	const now = T0 + 100;
	assert.deepEqual(parseSavedWords('книга', now), []);
	assert.deepEqual(
		parseSavedWords([
			{ word: 'книга', saved_at: T0 }, { word: 'книга', saved_at: T0 + 1 }, // twice
			{ word: '' }, { word: 7 }, null, 'привіт', { word: 'я'.repeat(101), saved_at: T0 },
			{ word: 'привіт', saved_at: now + DAY }, { word: 'небокрай', saved_at: 'вчора' } // bad dates become now
		], now),
		[{ word: 'книга', saved_at: T0 }, { word: 'привіт', saved_at: now }, { word: 'небокрай', saved_at: now }]);
});

test('exported marks', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', null);
	const other = await findOrCreateUser(db, 'github', '43', null);
	await saveWord(db, user, 'книга', T0);
	await saveWord(db, user, 'привіт', T0);
	await saveWord(db, other, 'небокрай', T0);

	// Only words in this account's list are marked
	await markExported(db, user, { книга: T0 + 5, небокрай: T0 + 5, 'не слово': T0 + 5 });
	assert.deepEqual(await listExported(db, user), { книга: T0 + 5 });
	assert.deepEqual(await listExported(db, other), {});

	// The later date wins, whichever arrives second
	await markExported(db, user, { книга: T0 + 1, привіт: T0 + 2 });
	await markExported(db, user, { привіт: T0 + 9 });
	assert.deepEqual(await listExported(db, user), { книга: T0 + 5, привіт: T0 + 9 });
	await markExported(db, user, {});

	// A mark outlives its word: saved again, the word is still marked
	await removeWord(db, user, 'книга');
	assert.equal((await listExported(db, user))['книга'], T0 + 5);
	await saveWord(db, user, 'книга', T0 + 20);
	assert.equal((await listExported(db, user))['книга'], T0 + 5);

	// More marks than D1 allows bound parameters
	const many = Array.from({ length: 300 }, (_, i) => `слово${i}`);
	await mergeSaved(db, user, many.map((word) => ({ word, saved_at: T0 })));
	await markExported(db, user, Object.fromEntries(many.map((word) => [word, T0 + 30])));
	assert.equal(Object.keys(await listExported(db, user)).length, 302);
});

test('lists of saved words', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', null);
	const other = await findOrCreateUser(db, 'github', '43', null);
	for (const word of ['хліб', 'сир', 'іти']) await saveWord(db, user, word, T0);
	await saveWord(db, other, 'хліб', T0);

	assert.equal(await putList(db, user, 'list-food', 'Їжа', T0 + 2), 'ok');
	assert.equal(await putList(db, user, 'list-verb', 'Дієслова', T0 + 1), 'ok');
	assert.equal(await putList(db, other, 'list-mine', 'Їжа', T0), 'ok'); // another account may use the name
	assert.equal(await putList(db, user, 'list-eat', 'їжа'), 'name_taken'); // in any letter case
	assert.equal(await putList(db, user, 'list-verb', 'Їжа'), 'name_taken');
	assert.ok(await hasList(db, user, 'list-food'));
	assert.ok(!(await hasList(db, user, 'list-mine')));

	// A word can be in several lists. Skipped: a word that is not saved, a list
	// of another account, a list that does not exist.
	await addToLists(db, user, [
		['list-food', 'хліб'], ['list-food', 'сир'], ['list-verb', 'іти'], ['list-verb', 'хліб'], ['list-food', 'хліб'],
		['list-food', 'небокрай'], ['list-mine', 'хліб'], ['list-none', 'хліб']
	]);
	assert.deepEqual(await listLists(db, user), [
		{ id: 'list-verb', name: 'Дієслова', created_at: T0 + 1, words: ['хліб', 'іти'] },
		{ id: 'list-food', name: 'Їжа', created_at: T0 + 2, words: ['сир', 'хліб'] }
	]);
	assert.deepEqual((await listLists(db, other)).map((l) => l.words), [[]]);

	// Renaming keeps the id, the date and the words; a list may be renamed to its own name.
	assert.equal(await putList(db, user, 'list-verb', 'Рух', T0 + 50), 'ok');
	assert.equal(await putList(db, user, 'list-verb', 'рух', T0 + 50), 'ok');
	assert.deepEqual((await listLists(db, user))[0], { id: 'list-verb', name: 'рух', created_at: T0 + 1, words: ['хліб', 'іти'] });

	await removeFromList(db, user, 'list-verb', ['хліб', 'сир']);
	await removeFromList(db, user, 'list-verb', []);
	assert.deepEqual((await listLists(db, user)).map((l) => l.words), [['іти'], ['сир', 'хліб']]);

	// A word that is no longer saved leaves its lists, and saving it again does not bring it back.
	await removeWord(db, user, 'хліб');
	await saveWord(db, user, 'хліб', T0 + 60);
	assert.deepEqual((await listLists(db, user)).map((l) => l.words), [['іти'], ['сир']]);

	// Deleting a list keeps its words saved; deleting it twice is fine.
	await deleteList(db, user, 'list-food');
	await deleteList(db, user, 'list-food');
	assert.deepEqual((await listLists(db, user)).map((l) => l.id), ['list-verb']);
	assert.equal((await listSaved(db, user)).length, 3);
	assert.deepEqual(await db.all('SELECT 1 FROM list_words WHERE user_id = ? AND list_id = ?', [user, 'list-food']), []);
});

test('lists stop at the limit', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', null);
	for (let i = 0; i < MAX_LISTS; i++) assert.equal(await putList(db, user, `list-${i}00`, `Урок ${i}`), 'ok');
	assert.equal(await putList(db, user, 'list-more', 'Ще один'), 'full');
	assert.equal(await putList(db, user, 'list-000', 'Перший урок'), 'ok'); // renaming is still allowed
	// A merge creates none either, but a list the account has still gains its words.
	await saveWord(db, user, 'школа');
	const merged = await mergeLists(db, user, [
		{ id: 'list-more', name: 'Ще один', created_at: T0, words: ['школа'] },
		{ id: 'list-other', name: 'урок 1', created_at: T0, words: ['школа'] }
	]);
	assert.equal(merged.length, MAX_LISTS);
	assert.deepEqual(merged.filter((l) => l.words.length).map((l) => l.id), ['list-100']);
});

test('merging a browser\'s lists into an account', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', null);
	// More words than D1 allows bound parameters
	const many = Array.from({ length: 300 }, (_, i) => `слово${String(i).padStart(3, '0')}`);
	await mergeSaved(db, user, [...many, 'хліб', 'сир'].map((word) => ({ word, saved_at: T0 })));
	await putList(db, user, 'list-food', 'Їжа', T0);
	await addToLists(db, user, [['list-food', 'хліб']]);

	const sent = [
		{ id: 'list-meal', name: 'їжа', created_at: T0 + 1, words: ['сир', 'хліб', 'не збережене'] },
		{ id: 'list-many', name: 'Урок 3', created_at: T0 + 2, words: many }
	];
	const merged = await mergeLists(db, user, sent);
	assert.deepEqual(merged.map((l) => [l.id, l.name, l.words.length]),
		[['list-food', 'Їжа', 2], ['list-many', 'Урок 3', 300]]);
	assert.deepEqual(merged[1].words, many);
	// The same again changes nothing, and nothing sent returns the account's lists.
	assert.deepEqual(await mergeLists(db, user, sent), merged);
	assert.deepEqual(await mergeLists(db, user, []), merged);
});

test('words sent for a list are read defensively', () => {
	assert.deepEqual(parseWords(['хліб', '', 7, null, 'я'.repeat(101), 'сир', 'хліб']), ['хліб', 'сир']);
	assert.deepEqual(parseWords([]), []);
	for (const junk of [null, undefined, 'хліб', { хліб: 1 }, Array(MAX_SAVED + 1).fill('хліб')]) {
		assert.equal(parseWords(junk), null);
	}
});

test('exported marks sent by a browser are read defensively', () => {
	const now = T0 + DAY;
	assert.deepEqual(
		parseExportedMarks({ книга: T0, привіт: now + DAY, небокрай: 'вчора', '': T0, ['я'.repeat(101)]: T0 }, now),
		{ книга: T0, привіт: now, небокрай: now }); // bad dates become now
	for (const junk of [null, 'книга', 7, ['книга']]) assert.deepEqual(parseExportedMarks(junk, now), {});

	assert.deepEqual(parseExportedWords(['книга', '', 7, null, 'я'.repeat(101), 'привіт', 'книга'], now),
		{ книга: now, привіт: now });
	for (const junk of [null, 'книга', { книга: T0 }]) assert.deepEqual(parseExportedWords(junk, now), {});
});

test('account numbers count accounts, never name them', async () => {
	const db = openMemoryUsers();
	const now = T0;
	const a = await findOrCreateUser(db, 'github', '1', 'А');
	const b = await findOrCreateUser(db, 'github', '2', 'Б');
	await db.run('UPDATE users SET created_at = ? WHERE id = ?', [now - 1000, a]);
	await db.run('UPDATE users SET created_at = ? WHERE id = ?', [now - 8 * DAY, b]);
	await saveWord(db, a, 'вода');
	await saveReviewDays(db, a, 'device-aaaa', { [new Date(now - DAY).toISOString().slice(0, 10)]: 3 });
	await saveReviewDays(db, b, 'device-bbbb', { [new Date(now - 20 * DAY).toISOString().slice(0, 10)]: 1 });
	const stats = await accountStats(db, now, 4);
	assert.deepEqual(stats, { users: 2, withSavedWords: 1, reviewed7: 1, reviewed30: 2, signUps: [0, 0, 1, 1] });
});
