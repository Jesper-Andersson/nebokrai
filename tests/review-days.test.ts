// Reviews by day and the streak counted from them (src/lib/review/days.ts).
// Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	addDays, dayKey, dayOfKey, keyOfDay, parseDays, reviewStats, weekProgress, weekStart
} from '../src/lib/review/days.ts';
import { dayNumber } from '../src/lib/review/fsrs.ts';

const TODAY = dayOfKey('2026-11-12');
/** Counts for days given as "days ago": `{ 0: 5, 1: 3 }` is five today and three yesterday. */
const ago = (counts: Record<number, number>) =>
	Object.fromEntries(Object.entries(counts).map(([n, count]) => [keyOfDay(TODAY - Number(n)), count]));

test('a day has a key, and the key leads back to the day', () => {
	assert.equal(keyOfDay(TODAY), '2026-11-12');
	assert.equal(keyOfDay(TODAY + 30), '2026-12-12');
	// The visitor's own date, with the night before four counted to the evening.
	assert.equal(dayKey(new Date(2026, 10, 12, 12, 0).getTime()), '2026-11-12');
	assert.equal(dayKey(new Date(2026, 10, 13, 3, 30).getTime()), '2026-11-12');
	assert.equal(dayKey(new Date(2026, 10, 13, 4, 0).getTime()), '2026-11-13');
	assert.equal(dayOfKey(dayKey(Date.now())), dayNumber(Date.now()));
});

test('parseDays drops what is not a day and a count', () => {
	assert.deepEqual(parseDays({ '2026-11-12': 5, '2026-11-11': 0 }), { '2026-11-12': 5, '2026-11-11': 0 });
	assert.deepEqual(
		parseDays({ '2026-13-40': 1, today: 2, '2026-11-12': -1, '2026-11-11': 1.5, '2026-11-10': '3', '2026-11-09': 1e9 }),
		{});
	for (const bad of [null, 'x', 5, [['2026-11-12', 5]]]) assert.deepEqual(parseDays(bad), {});
	assert.deepEqual(parseDays({ '2026-11-12': 5, '2026-11-11': 3 }, 1), { '2026-11-12': 5 });
});

test('addDays sums day by day', () => {
	assert.deepEqual(addDays({ '2026-11-12': 5, '2026-11-11': 3 }, { '2026-11-12': 2, '2026-11-01': 7 }),
		{ '2026-11-12': 7, '2026-11-11': 3, '2026-11-01': 7 });
});

test('the calendar counts days learned, reviews and the share of days', () => {
	const stats = reviewStats(ago({ 0: 5, 1: 3, 2: 10, 4: 1, 5: 1, 6: 1, 7: 1, 9: 20, 3: 0 }), TODAY);
	assert.deepEqual([stats.daysLearned, stats.total], [8, 42]);
	assert.equal(stats.average, 42 / 8);
	assert.equal(stats.share, 8 / 10); // eight of the ten days since the first
});

test('no reviews, no figures', () => {
	assert.deepEqual(reviewStats({}, TODAY), { daysLearned: 0, total: 0, average: 0, share: 0 });
	// A clock set wrong once must not leave a day in the future holding the streak.
	assert.equal(reviewStats({ [keyOfDay(TODAY + 3)]: 9 }, TODAY).daysLearned, 0);
});

test('a week starts on Monday', () => {
	// 12 November 2026 is a Thursday; its week began on Monday the 9th.
	assert.equal(keyOfDay(weekStart(TODAY)), '2026-11-09');
	assert.equal(weekStart(dayOfKey('2026-11-09')), dayOfKey('2026-11-09'));
	assert.equal(keyOfDay(weekStart(dayOfKey('2026-11-15'))), '2026-11-09');
	assert.equal(keyOfDay(weekStart(dayOfKey('2026-11-16'))), '2026-11-16');
	assert.equal(keyOfDay(weekStart(0)), '1969-12-29');
});

test('days practised this week and this month, where a missed day takes nothing away', () => {
	// Thursday, Tuesday and Monday this week; last Sunday counts for the month only.
	const days = ago({ 0: 5, 2: 3, 3: 1, 4: 7, 1: 0 });
	assert.deepEqual(weekProgress(days, TODAY), { week: 3, month: 4, bestMonth: 4 });
	// Yesterday missed and nothing yet today: the week still holds what was done.
	assert.equal(weekProgress(ago({ 2: 3, 3: 1 }), TODAY).week, 2);
	// A new month starts from nought, and the best month remembers the old one.
	const october = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`2026-10-${String(i + 10)}`, 2]));
	assert.deepEqual(weekProgress({ ...october, ...ago({ 0: 1 }) }, TODAY), { week: 1, month: 1, bestMonth: 9 });
	// A day in the future, from a clock set wrong, is not counted.
	assert.deepEqual(weekProgress({ [keyOfDay(TODAY + 1)]: 4 }, TODAY), { week: 0, month: 0, bestMonth: 0 });
	assert.deepEqual(weekProgress({}, TODAY), { week: 0, month: 0, bestMonth: 0 });
});
