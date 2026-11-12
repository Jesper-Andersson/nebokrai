// How many cards were reviewed on each day: what the heatmap on the review
// page draws, and what a streak is counted from. Shared by the browser and
// the server; no imports from SvelteKit.
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

export interface ReviewStats {
	/** Days in a row with a review, up to today; a day not yet reviewed does not end it until it is over. */
	streak: number;
	longest: number;
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
	if (!learned.length) return { streak: 0, longest: 0, daysLearned: 0, total: 0, average: 0, share: 0 };

	let longest = 1;
	let run = 1;
	for (let i = 1; i < learned.length; i++) {
		run = learned[i] === learned[i - 1] + 1 ? run + 1 : 1;
		longest = Math.max(longest, run);
	}
	// `run` is now the run that ends on the last day learned.
	const streak = learned.at(-1)! >= today - 1 ? run : 0;
	return {
		streak,
		longest,
		daysLearned: learned.length,
		total,
		average: total / learned.length,
		share: learned.length / (today - learned[0] + 1)
	};
}
