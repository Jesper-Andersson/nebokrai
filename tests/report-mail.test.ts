// The email that announces a new report (src/lib/server/report-mail.ts).
// Needs no database and sends nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reportMail } from '../src/lib/server/report-mail.ts';
import type { NewReport } from '../src/lib/server/reports.ts';

const report = (over: Partial<NewReport> = {}): NewReport => ({
	kind: 'stress',
	message: 'The stress is on the last syllable.',
	email: null,
	entryId: null,
	word: null,
	pos: null,
	query: null,
	lang: 'en',
	layout: 'phonetic',
	page: null,
	userAgent: null,
	...over
});

test('a report about a word names the word and links to its page', () => {
	const mail = reportMail(report({ entryId: 454, word: 'небокрай', pos: 'noun' }), 7);
	assert.equal(mail.subject, 'Report #7: stress, небокрай');
	assert.match(mail.text, /^The stress is on the last syllable\.\n\nKind: stress\n/);
	assert.match(mail.text, /^Word: небокрай \(noun\) https:\/\/nebokrai\.app\/word\/nebokrai$/m);
});

test('a report from nowhere in particular still has a subject and its facts', () => {
	const mail = reportMail(report({ kind: 'site' }), null);
	assert.equal(mail.subject, 'Report: site');
	assert.match(mail.text, /^Interface: en, phonetic keyboard$/m);
	assert.doesNotMatch(mail.text, /^(Word|Search|Sent from|Browser):/m);
});

test('the reporter’s address never goes into the mail', () => {
	const mail = reportMail(report({ email: 'olena@example.com' }), 3);
	assert.doesNotMatch(mail.subject + mail.text, /olena|example\.com/);
	assert.match(mail.text, /^Reply wanted: yes, the address is in the reports database$/m);
	assert.match(reportMail(report(), 3).text, /^Reply wanted: no$/m);
});

test('the subject stays on one line and within 120 characters', () => {
	const mail = reportMail(report({ kind: 'missing', query: `кава\r\nBcc: x@example.com ${'я'.repeat(200)}` }), 12);
	assert.doesNotMatch(mail.subject, /[\r\n]/);
	assert.ok(mail.subject.length <= 120);
	assert.ok(mail.subject.startsWith('Report #12: missing, кава Bcc:'));
	// A fact is one line too, whatever was typed into it
	assert.equal(mail.text.split('\n').filter((line) => line.startsWith('Search:')).length, 1);
});
