// How many cards were reviewed on each day: what the heatmap on the review
// page draws, and what the weekly goal is counted from. Shared by the
// browser and the server; no imports from SvelteKit.
import { DAY, dayNumber } from './fsrs.ts';

/** Reviews by day: `{ "2026-11-12": 34 }`. A day is the visitor's own, starting at 04:00 (fsrs.ts). */
export type DayCounts = Record<string, number>;

/** The most days in one POST /api/review/sync: a little over a year. */
export const DAYS_MAX = 400;

const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The key of day number `n` (see dayNumber). */
export const keyOfDay = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
/** The key of the day `ms` falls in, on this machine's clock. */
export const dayKey = (ms: number): string => keyOfDay(dayNumber(ms));
export const dayOfKey = (key: string): number => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY);

/** Read day counts from storage or from a browser, dropping what is malformed. */
export function parseDays(value: unknown, max = Infinity): DayCounts {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const days: DayCounts = {};
	for (const [key, count] of Object.entries(value).slice(0, max)) {
		if (!KEY.test(key) || Number.isNaN(Date.parse(key))) continue;
		if (Number.isInteger(count) && count >= 0 && count <= 100_000) days[key] = count;
	}
	return days;
}

/** Two sets of counts added together, day by day. */
export function addDays(a: DayCounts, b: DayCounts): DayCounts {
	const sum: DayCounts = { ...a };
	for (const [key, count] of Object.entries(b)) sum[key] = (sum[key] ?? 0) + count;
	return sum;
}

/** The number of the Monday that starts the week of day `n`: weeks start on Monday in English (en-GB) and Ukrainian. */
export const weekStart = (n: number): number => n - ((n + 3) % 7); // day 0, 1 January 1970, was a Thursday

/**
 * Practice counted the forgiving way, in place of days in a row: a day
 * missed takes nothing away, it only fails to add. The research behind it is
 * in the plan for learning goals: a broken streak lowers later practice,
 * while one missed day barely slows a habit forming.
 */
export interface WeekProgress {
	/** Days with a review this week, Monday to today. */
	week: number;
	/** Days with a review this calendar month, up to today. */
	month: number;
	/** The most days with a review in any one calendar month, this one included. */
	bestMonth: number;
}

export function weekProgress(days: DayCounts, today: number): WeekProgress {
	const monday = weekStart(today);
	const thisMonth = keyOfDay(today).slice(0, 7);
	const byMonth = new Map<string, number>();
	let week = 0;
	for (const [key, count] of Object.entries(days)) {
		const n = dayOfKey(key);
		if (count <= 0 || n > today) continue;
		if (n >= monday) week += 1;
		const month = key.slice(0, 7);
		byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
	}
	return { week, month: byMonth.get(thisMonth) ?? 0, bestMonth: Math.max(0, ...byMonth.values()) };
}

/** The calendar's figures. Days in a row are no longer counted (2026-11-15): see WeekProgress. */
export interface ReviewStats {
	/** Days with at least one review. */
	daysLearned: number;
	total: number;
	/** Reviews a day, over the days with any. */
	average: number;
	/** The share of days with a review since the first one, 0 to 1. */
	share: number;
}

export function reviewStats(days: DayCounts, today: number): ReviewStats {
	const learned = Object.keys(days).filter((key) => days[key] > 0).map(dayOfKey).filter((n) => n <= today)
		.sort((a, b) => a - b);
	const total = learned.reduce((sum, n) => sum + days[keyOfDay(n)], 0);
	if (!learned.length) return { daysLearned: 0, total: 0, average: 0, share: 0 };
	return {
		daysLearned: learned.length,
		total,
		average: total / learned.length,
		share: learned.length / (today - learned[0] + 1)
	};
}
