// Reviews by day and the streak counted from them (src/lib/review/days.ts).
// Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, dayKey, dayOfKey, keyOfDay, parseDays, reviewStats } from '../src/lib/review/days.ts';
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

test('a streak runs up to today', () => {
	const stats = reviewStats(ago({ 0: 5, 1: 3, 2: 10, 4: 1, 5: 1, 6: 1, 7: 1, 9: 20 }), TODAY);
	assert.deepEqual([stats.streak, stats.longest, stats.daysLearned, stats.total], [3, 4, 8, 42]);
	assert.equal(stats.average, 42 / 8);
	assert.equal(stats.share, 8 / 10); // eight of the ten days since the first
});

test('a day not yet reviewed does not end the streak; a day missed does', () => {
	assert.equal(reviewStats(ago({ 1: 3, 2: 10 }), TODAY).streak, 2);
	assert.equal(reviewStats(ago({ 2: 3, 3: 10 }), TODAY).streak, 0);
	assert.equal(reviewStats(ago({ 2: 3, 3: 10 }), TODAY).longest, 2);
	// A day with a count of nought is a day missed.
	assert.equal(reviewStats(ago({ 0: 4, 1: 0, 2: 6 }), TODAY).streak, 1);
});

test('no reviews, no streak', () => {
	assert.deepEqual(reviewStats({}, TODAY), { streak: 0, longest: 0, daysLearned: 0, total: 0, average: 0, share: 0 });
	// A clock set wrong once must not leave a day in the future holding the streak.
	assert.equal(reviewStats({ [keyOfDay(TODAY + 3)]: 9 }, TODAY).daysLearned, 0);
});
