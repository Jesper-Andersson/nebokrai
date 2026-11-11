// Accounts, sessions and saved words (src/lib/server/users.ts), against an
// in-memory database. Needs no dictionary data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_SAVED } from '../src/lib/saved.ts';
import {
	SESSION_MS, createSession, deleteSession, deleteUser, findOrCreateUser, listSaved, mergeSaved,
	parseSavedWords, removeWord, saveWord, validateSession
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

	await deleteUser(db, user);
	assert.equal(await validateSession(db, token), null);
	for (const table of ['users', 'identities', 'saved_words']) {
		assert.equal((await db.all(`SELECT 1 FROM ${table}`)).length, 1, table); // only Тарас is left
	}
	assert.notEqual(await findOrCreateUser(db, 'github', '42', 'Олена'), user); // a new account
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
