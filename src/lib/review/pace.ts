// Where the chosen number of new words a day takes a visitor through the
// common words: from the words begun so far and how often they have practised
// lately. Shown on /review under "Your pace". No imports from SvelteKit, so
// tests/review-pace.test.ts runs it.
import { dayOfKey, type DayCounts } from './days.ts';
import { DAY } from './fsrs.ts';

/** The marks on the way: every one of the first 500, 1,000 and 2,000 common words begun. */
export const MILESTONES = [500, 1000, 2000];

/** Where the days a week come from: the reviews of the last weeks, the weekly goal, or none (every day). */
export type PaceBasis = 'lately' | 'goal' | 'daily';

/** History shorter than this says little about a habit: the goal, or every day, is taken instead. */
const HISTORY_DAYS = 14;
/** How far back "lately" looks. */
const WINDOW_DAYS = 28;

/**
 * Practice days a week. With two weeks of reviews or more, the days with a
 * review in the last four weeks (or since the first review): 12 days in 28
 * are 3 a week. Before that, the weekly goal; with no goal, every day.
 */
export function daysPerWeek(days: DayCounts, today: number, goalDays: number): { perWeek: number; basis: PaceBasis } {
	const practised = Object.entries(days)
		.filter(([, count]) => count > 0)
		.map(([key]) => dayOfKey(key))
		.filter((n) => n <= today);
	if (practised.length) {
		const first = Math.min(...practised);
		if (today - first + 1 >= HISTORY_DAYS) {
			const window = Math.min(WINDOW_DAYS, today - first + 1);
			const recent = practised.filter((n) => n > today - window).length;
			if (recent) return { perWeek: Math.min(7, (recent * 7) / window), basis: 'lately' };
		}
	}
	if (goalDays > 0) return { perWeek: goalDays, basis: 'goal' };
	return { perWeek: 7, basis: 'daily' };
}

export interface Milestone {
	/** How many of the commonest words: 500, 1,000, 2,000. */
	count: number;
	/** When every one of them will have been begun (ms); 0 when they all are; null when the pace never gets there. */
	at: number | null;
}

export interface Pace {
	/** Common words begun so far, out of `total`. */
	started: number;
	total: number;
	milestones: Milestone[];
}

/**
 * When each mark is reached. `queue` is the new words in the order they will
 * come (newWords in decks.ts: saved words first when ticked), `common` the
 * common words in order, all three decks. Once the queue runs out, new words
 * are taken to go on through the common words in order, so a mark beyond the
 * decks ticked still has a date: ticked the first 500 alone, the next 500
 * follow them. A practice day brings `newPerDay` new words, and there are
 * `perWeek` practice days a week.
 */
export function pace(
	queue: readonly string[], common: readonly string[], begun: (word: string) => boolean,
	newPerDay: number, perWeek: number, now: number
): Pace {
	const order = [...new Set([...queue, ...common])].filter((word) => !begun(word));
	const position = new Map(order.map((word, i) => [word, i]));
	const milestones = MILESTONES.filter((count) => count <= common.length).map((count) => {
		let last = -1;
		for (const word of common.slice(0, count)) last = Math.max(last, position.get(word) ?? -1);
		if (last < 0) return { count, at: 0 };
		if (newPerDay <= 0 || perWeek <= 0) return { count, at: null };
		const practiceDays = Math.ceil((last + 1) / newPerDay);
		return { count, at: now + Math.round((practiceDays * 7) / perWeek) * DAY };
	});
	return { started: common.filter(begun).length, total: common.length, milestones };
}
