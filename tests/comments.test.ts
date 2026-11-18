// Comments under grammar point pages: cleaning what a browser sends
// (src/lib/comments.ts) and the rows in the accounts database
// (src/lib/server/users.ts), against an in-memory database.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_COMMENT, MAX_COMMENT_NAME, MAX_LISTED, cleanComment } from '../src/lib/comments.ts';
import { addComment, listComments, reportComment, setCommentHidden } from '../src/lib/server/users.ts';
import { openMemoryUsers } from './local-db.ts';

const T0 = 1_800_000_000_000;

test('a comment is cleaned before it is stored', () => {
	assert.deepEqual(cleanComment('  Чому без води?  ', '  Олена  '), { body: 'Чому без води?', name: 'Олена' });
	// No name, or only spaces: posted without one
	assert.deepEqual(cleanComment('Дякую', ''), { body: 'Дякую', name: null });
	assert.deepEqual(cleanComment('Дякую', undefined), { body: 'Дякую', name: null });
	// Control characters and reordering marks go; line breaks stay, but not a wall of them
	assert.deepEqual(cleanComment('a\u001b[2Jb\u202e\r\n\r\n\r\n\r\nc', 'Mark\u0007'), { body: 'a[2Jb\n\nc', name: 'Mark' });
	assert.deepEqual(cleanComment('ok', 'two\n  words'), { body: 'ok', name: 'two words' });

	assert.equal(cleanComment('', 'Олена'), 'missing_body');
	assert.equal(cleanComment('   \n ', null), 'missing_body');
	assert.equal(cleanComment(42, null), 'missing_body');
	assert.equal(cleanComment('я'.repeat(MAX_COMMENT + 1), null), 'too_large');
	assert.equal(cleanComment('ok', 'я'.repeat(MAX_COMMENT_NAME + 1)), 'too_large');
	assert.deepEqual(cleanComment('я'.repeat(MAX_COMMENT), null), { body: 'я'.repeat(MAX_COMMENT), name: null });
});

test('comments are listed by page, newest first', async () => {
	const db = openMemoryUsers();
	const first = await addComment(db, 'genitive-after-bez', { name: 'Олена', body: 'Перший' }, T0);
	const second = await addComment(db, 'genitive-after-bez', { name: null, body: 'Другий' }, T0 + 1000);
	await addComment(db, 'present-tense', { name: null, body: 'Elsewhere' }, T0);

	assert.deepEqual(first, { id: first.id, name: 'Олена', body: 'Перший', created_at: T0 });
	assert.notEqual(first.id, second.id);
	assert.deepEqual(await listComments(db, 'genitive-after-bez'), [second, first]);
	assert.deepEqual(await listComments(db, 'nowhere'), []);
});

test('a reported comment stays up; a hidden one is shown only to the keeper', async () => {
	const db = openMemoryUsers();
	const comment = await addComment(db, 'genitive-after-bez', { name: null, body: 'Spam' }, T0);

	assert.deepEqual(await reportComment(db, comment.id), { page: 'genitive-after-bez', body: 'Spam', reports: 1 });
	assert.equal((await reportComment(db, comment.id))?.reports, 2);
	assert.equal(await reportComment(db, comment.id + 99), null);
	assert.equal((await listComments(db, 'genitive-after-bez')).length, 1);

	assert.equal(await setCommentHidden(db, comment.id, true), true);
	assert.deepEqual(await listComments(db, 'genitive-after-bez'), []);
	assert.deepEqual(await listComments(db, 'genitive-after-bez', true), [{ ...comment, hidden: true, reports: 2 }]);
	// A hidden comment cannot be reported any more
	assert.equal(await reportComment(db, comment.id), null);

	assert.equal(await setCommentHidden(db, comment.id, false), true);
	assert.deepEqual(await listComments(db, 'genitive-after-bez'), [comment]);
	assert.deepEqual(await listComments(db, 'genitive-after-bez', true), [{ ...comment, hidden: false, reports: 2 }]);
	assert.equal(await setCommentHidden(db, comment.id + 99, true), false);
});

test('a page lists at most MAX_LISTED comments', async () => {
	const db = openMemoryUsers();
	for (let i = 0; i <= MAX_LISTED; i++) await addComment(db, 'p', { name: null, body: `#${i}` }, T0 + i);
	const listed = await listComments(db, 'p');
	assert.equal(listed.length, MAX_LISTED);
	assert.equal(listed[0].body, `#${MAX_LISTED}`);
});
