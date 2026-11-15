// The estimate under "Your pace" on /review (src/lib/review/pace.ts). Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { keyOfDay } from '../src/lib/review/days.ts';
import { DAY } from '../src/lib/review/fsrs.ts';
import { daysPerWeek, pace } from '../src/lib/review/pace.ts';

const TODAY = 20_400;
const NOW = TODAY * DAY;

/** Reviews on each of these days back from today. */
const practised = (...back: number[]) => Object.fromEntries(back.map((n) => [keyOfDay(TODAY - n), 10]));

test('days a week come from the last four weeks, once there are two weeks of them', () => {
	// 12 days in the last 28: three a week
	const twelve = practised(...Array.from({ length: 12 }, (_, i) => i * 2), 40);
	assert.deepEqual(daysPerWeek(twelve, TODAY, 5), { perWeek: 3, basis: 'lately' });
	// Begun 13 days ago, every other day: 7 days in 14
	assert.deepEqual(daysPerWeek(practised(0, 2, 4, 6, 8, 10, 13), TODAY, 0), { perWeek: 3.5, basis: 'lately' });
	// A week of history is not yet a habit: the goal, or every day without one
	assert.deepEqual(daysPerWeek(practised(0, 1, 2), TODAY, 4), { perWeek: 4, basis: 'goal' });
	assert.deepEqual(daysPerWeek({}, TODAY, 0), { perWeek: 7, basis: 'daily' });
	// Nothing in the last four weeks: the goal again
	assert.deepEqual(daysPerWeek(practised(60, 70, 80), TODAY, 2), { perWeek: 2, basis: 'goal' });
});

test('a mark is reached when the last of its words comes up', () => {
	const common = Array.from({ length: 2000 }, (_, i) => `w${i}`);
	const begun = new Set(common.slice(0, 100));
	const has = (word: string) => begun.has(word);
	// The first 500 ticked; 10 a day, 5 days a week: 400 words left are 40 practice days, 8 weeks
	const result = pace(common.slice(0, 500), common, has, 10, 5, NOW);
	assert.equal(result.started, 100);
	assert.deepEqual(result.milestones.map((m) => m.count), [500, 1000, 2000]);
	assert.equal(result.milestones[0].at, NOW + 56 * DAY);
	// Then on through the next 500 and the 1,000 after them
	assert.equal(result.milestones[1].at, NOW + 126 * DAY);
	assert.equal(result.milestones[2].at, NOW + 266 * DAY);
});

test('saved words come first and push the marks back; a mark already reached is done', () => {
	const common = Array.from({ length: 1000 }, (_, i) => `w${i}`);
	const begun = new Set(common.slice(0, 500));
	const has = (word: string) => begun.has(word);
	const queue = ['кіт', 'пес', ...common.slice(500)];
	const result = pace(queue, common, has, 1, 7, NOW);
	assert.deepEqual(result.milestones, [{ count: 500, at: 0 }, { count: 1000, at: NOW + 502 * DAY }]);
	// No new words a day: no date
	assert.equal(pace(queue, common, has, 0, 7, NOW).milestones[1].at, null);
});
