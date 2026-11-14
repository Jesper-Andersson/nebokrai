// Visitor and search counting (src/lib/server/stats.ts), against an
// in-memory database. Needs no dictionary data.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
	OTHER, addDays, countedPath, countedQuery, recordSearch, recordView, resetClearedForTests, sectionOf, skipCounting,
	statsDay, statsReport, type Visit
} from '../src/lib/server/stats.ts';
import { openMemoryStats } from './local-db.ts';

const DAY = 24 * 60 * 60 * 1000;
// 2026-11-14 12:00 in Kyiv (UTC+2 in winter)
const T0 = Date.UTC(2026, 10, 14, 10);
const firefox = (ip: string, now = T0, signedIn = false): Visit =>
	({ ip, userAgent: 'Mozilla/5.0 Firefox/140.0', signedIn, now });

beforeEach(resetClearedForTests);

test('a day is Kyiv’s date', () => {
	assert.equal(statsDay(T0), '2026-11-14');
	// 23:30 UTC is already the next day in Kyiv
	assert.equal(statsDay(Date.UTC(2026, 10, 14, 23, 30)), '2026-11-15');
});

test('a second page view is not a second visitor', async () => {
	const db = openMemoryStats();
	await recordView(db, '/', firefox('1.1.1.1'));
	await recordView(db, '/word/voda', firefox('1.1.1.1'));
	await recordView(db, '/word/voda', firefox('2.2.2.2'));
	const [today] = (await statsReport(db, T0, 1)).days;
	assert.equal(today.views, 3);
	assert.equal(today.visitors, 2);
	assert.equal(today.signed_in_visitors, 0);
	assert.deepEqual((await statsReport(db, T0)).pages, [{ key: '/word/voda', count: 2 }, { key: '/', count: 1 }]);
});

test('signing in during the day makes the same visitor a signed-in one', async () => {
	const db = openMemoryStats();
	await recordView(db, '/', firefox('1.1.1.1'));
	await recordView(db, '/saved', firefox('1.1.1.1', T0, true));
	await recordView(db, '/saved', firefox('1.1.1.1', T0, true));
	const [today] = (await statsReport(db, T0, 1)).days;
	assert.equal(today.visitors, 1);
	assert.equal(today.signed_in_visitors, 1);
});

test('the next day the salt and the visitors are gone, and the totals stay', async () => {
	const db = openMemoryStats();
	await recordView(db, '/', firefox('1.1.1.1'));
	const [{ hash: before }] = await db.all<{ hash: string }>('SELECT hash FROM visitors');
	await recordView(db, '/', firefox('1.1.1.1', T0 + DAY));
	const rows = await db.all<{ day: string; hash: string }>('SELECT day, hash FROM visitors');
	assert.deepEqual(rows.map((row) => row.day), ['2026-11-15']);
	assert.notEqual(rows[0].hash, before); // a new salt: the visitor cannot be followed across days
	assert.deepEqual(await db.all('SELECT day FROM salts'), [{ day: '2026-11-15' }]);
	const days = (await statsReport(db, T0 + DAY, 2)).days;
	assert.deepEqual(days.map((d) => [d.day, d.visitors]), [['2026-11-14', 1], ['2026-11-15', 1]]);
});

test('the report fills days without visits with zeros', async () => {
	const db = openMemoryStats();
	await recordView(db, '/', firefox('1.1.1.1'));
	const { days } = await statsReport(db, T0 + 2 * DAY, 3);
	assert.deepEqual(days.map((d) => [d.day, d.views]), [['2026-11-14', 1], ['2026-11-15', 0], ['2026-11-16', 0]]);
});

test('searches count once per visitor, and show only when two visitors made them', async () => {
	const db = openMemoryStats();
	await recordSearch(db, 'Вода́', 5, firefox('1.1.1.1'));
	await recordSearch(db, 'вода', 5, firefox('1.1.1.1'));
	await recordSearch(db, 'кава', 3, firefox('1.1.1.1'));
	await recordSearch(db, ' вода ', 5, firefox('2.2.2.2'));
	await recordSearch(db, 'ґудзик', 0, firefox('1.1.1.1'));
	await recordSearch(db, 'ґудзик', 0, firefox('3.3.3.3'));
	const report = await statsReport(db, T0);
	assert.deepEqual(report.searches, [
		{ key: 'вода', count: 3, visitors: 2 },
		{ key: 'ґудзик', count: 2, visitors: 2 }
	]);
	assert.deepEqual(report.missing, [{ key: 'ґудзик', count: 2, visitors: 2 }]);
	const today = report.days.at(-1)!;
	assert.equal(today.searches, 6);
	assert.equal(today.empty_searches, 2);
	assert.equal(today.visitors, 3);
});

test('a long search is counted but its text is not kept', async () => {
	const db = openMemoryStats();
	const sentence = 'Мене звати Олена, я живу в Києві на вулиці Хрещатик';
	await recordSearch(db, sentence, 0, firefox('1.1.1.1'));
	assert.equal((await statsReport(db, T0, 1)).days[0].searches, 1);
	assert.deepEqual(await db.all('SELECT * FROM searches'), []);
	assert.deepEqual(await db.all('SELECT * FROM search_visitors'), []);
});

test('search words are dropped after 90 days, day totals are kept', async () => {
	const db = openMemoryStats();
	await recordSearch(db, 'вода', 1, firefox('1.1.1.1'));
	await recordView(db, '/', firefox('1.1.1.1', T0 + 91 * DAY));
	assert.deepEqual(await db.all('SELECT * FROM searches'), []);
	assert.deepEqual((await db.all<{ day: string }>('SELECT day FROM daily ORDER BY day')).map((r) => r.day),
		['2026-11-14', '2027-02-13']);
});

test('paths are counted by the site’s own sections only', () => {
	assert.equal(countedPath('/'), '/');
	assert.equal(countedPath('/word/voda'), '/word/voda');
	assert.equal(countedPath('/word/voda/'), '/word/voda');
	assert.equal(countedPath('/word/%D0%B2'), '/word/%D0%B2');
	assert.equal(countedPath('/words/a?x=1'), '/words/a');
	assert.equal(countedPath('/learn'), '/learn');
	assert.equal(countedPath('/wp-admin'), OTHER);
	assert.equal(countedPath('/word/a/b'), OTHER);
	assert.equal(countedPath('/word/<script>'), OTHER);
	assert.equal(countedPath('http://x.example/'), OTHER);
});

test('a search is counted as one word however it is typed', () => {
	assert.equal(countedQuery('  Во́да   ДЕНЬ '), 'вода день');
	assert.equal(countedQuery('Її'), 'її'); // ї survives, unlike a stress mark
});

test('programs and browsers that ask not to be followed are not counted', () => {
	const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });
	const browser = 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0';
	assert.equal(skipCounting(headers({ 'user-agent': browser })), false);
	assert.equal(skipCounting(headers({})), true);
	assert.equal(skipCounting(headers({ 'user-agent': 'Googlebot/2.1' })), true);
	assert.equal(skipCounting(headers({ 'user-agent': 'Mozilla/5.0 HeadlessChrome/140' })), true);
	assert.equal(skipCounting(headers({ 'user-agent': browser, dnt: '1' })), true);
	assert.equal(skipCounting(headers({ 'user-agent': browser, 'sec-gpc': '1' })), true);
});

test('the report sums pages into parts of the site, and its calendar starts on a Monday', async () => {
	const db = openMemoryStats();
	for (const path of ['/', '/word/voda', '/word/kava', '/words/a', '/learn', '/grammar', '/saved', '/wp-admin']) {
		await recordView(db, path, firefox('1.1.1.1'));
	}
	const report = await statsReport(db, T0, 7);
	assert.deepEqual(report.sections, { words: 3, search: 1, learn: 2, saved: 1, other: 1 });
	assert.equal(report.days.length, 7);
	// 2026-11-14 is a Saturday: 12 whole weeks and this one up to Saturday
	assert.equal(report.calendar.length, 12 * 7 + 6);
	assert.equal(report.calendar[0].day, '2026-08-17');
	assert.equal(new Date(`${report.calendar[0].day}T12:00:00Z`).getUTCDay(), 1);
	assert.equal(report.calendar.at(-1)!.visitors, 1);
});

test('days are counted by the calendar across a clock change', () => {
	assert.equal(addDays('2026-10-26', -1), '2026-10-25'); // Kyiv moved its clock on the 25th
	assert.equal(addDays('2026-03-01', -1), '2026-02-28');
	assert.equal(sectionOf('/word'), 'words');
	assert.equal(sectionOf('/practice'), 'learn');
});
