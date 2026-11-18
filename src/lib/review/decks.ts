// Where the review page takes its words from, and the visitor's choices about
// it. Shared by the browser and the server; no imports from SvelteKit.
import { LIST_ID } from '../lists.ts';
import { MAX_LISTS, type WordList } from '../saved.ts';

/** The visitor's own saved words. */
export const SAVED_DECK = 'saved';

/**
 * Ready-made decks: the commonest spellings in order, as /common-words counts
 * them (src/lib/browse.ts). `from` and `to` are places in that list, from 1.
 */
export const COMMON_DECKS = [
	{ id: 'common-500', from: 1, to: 500 },
	{ id: 'common-1000', from: 501, to: 1000 },
	{ id: 'common-2000', from: 1001, to: 2000 }
] as const;

export type CommonDeckId = (typeof COMMON_DECKS)[number]['id'];
export type DeckId = typeof SAVED_DECK | CommonDeckId;

/**
 * The decks there are to tick and to pause, in the order new words are taken
 * from them: the saved words, then the common words. A list of saved words is
 * a choice inside the saved words, not a deck of its own here.
 */
export const DECK_IDS: readonly string[] = [SAVED_DECK, ...COMMON_DECKS.map((deck) => deck.id)];

/**
 * One of the visitor's own lists of saved words (saved.ts) as a deck: "list:"
 * and the list's id. Switching on "saved" takes in every list; a list by
 * itself is for learning Їжа this week and leaving the rest for later.
 */
const LIST_DECK = 'list:';
export const listDeck = (listId: string): string => LIST_DECK + listId;
/** The id of the list a deck stands for, or null when the deck is not a list. */
export function listOfDeck(deck: string): string | null {
	const id = deck.startsWith(LIST_DECK) ? deck.slice(LIST_DECK.length) : '';
	return LIST_ID.test(id) ? id : null;
}

/**
 * The words of a deck, in the order new ones should be met. A list that has
 * since been deleted, and a deck of common words not yet fetched, have none.
 */
export function wordsOfDeck(
	deck: string, saved: string[], lists: Pick<WordList, 'id' | 'words'>[], common: ReadonlyMap<string, string[]>
): string[] {
	if (deck === SAVED_DECK) return saved;
	const listId = listOfDeck(deck);
	if (listId) return lists.find((list) => list.id === listId)?.words ?? [];
	return common.get(deck) ?? [];
}

type DeckSettings = Pick<ReviewSettings, 'decks' | 'paused'>;

/** The deck a choice of decks belongs to for pausing: a list is paused with the saved words. */
const pausedWith = (deck: string): string => (listOfDeck(deck) ? SAVED_DECK : deck);

/**
 * The words whose cards come back for review: every deck not paused, ticked
 * or not. Started on Common words 1–500 and then ticked only Saved words, the
 * 37 words begun there keep coming; nothing is lost by changing where new
 * words come from.
 */
export function reviewWords(
	settings: DeckSettings, saved: string[], lists: Pick<WordList, 'id' | 'words'>[], common: ReadonlyMap<string, string[]>
): string[] {
	return DECK_IDS.filter((deck) => !settings.paused.includes(deck))
		.flatMap((deck) => wordsOfDeck(deck, saved, lists, common));
}

/**
 * The words new cards come from, in the order they are met: the decks ticked
 * and not paused. `start` is where the common words begin, from the placement
 * test (review/progress.ts startOf): with 1,001 the first two decks give no
 * new words, and the third starts at its first word. Saved words are never
 * skipped, and nor is a review: a card begun before the test keeps coming
 * (reviewWords).
 */
export function newWords(
	settings: DeckSettings, saved: string[], lists: Pick<WordList, 'id' | 'words'>[], common: ReadonlyMap<string, string[]>,
	start = 1
): string[] {
	return settings.decks.filter((deck) => !settings.paused.includes(pausedWith(deck)))
		.flatMap((deck) => {
			const words = wordsOfDeck(deck, saved, lists, common);
			const range = COMMON_DECKS.find((d) => d.id === deck);
			return range && start > range.from ? words.slice(start - range.from) : words;
		});
}

/**
 * The choices offered for new cards a day. Each new card a day brings about
 * nine answers a day three months on (see reviewEstimate), so 30 is for the
 * keen. The settings still accept any number from 0 to 100.
 */
export const NEW_PER_DAY = [5, 10, 15, 20, 30];

/**
 * Answers a day, three months on, for each new card a day. Simulated with
 * fsrs.ts at 90% retention, learning steps included: 10 new a day came to
 * about 94 answers a session, 20 to about 182 (tests/review-cards.test.ts
 * runs it again). The load still grows after that, to about 13 a year on.
 */
const ANSWERS_PER_NEW_CARD = 9;
/** Seconds an answer takes, for turning answers into minutes. */
const SECONDS_PER_ANSWER = 10;

/** What `newPerDay` new cards a day will cost after three months: answers a day, rounded to tens, and minutes. */
export function reviewEstimate(newPerDay: number): { answers: number; minutes: number } {
	const answers = Math.round((newPerDay * ANSWERS_PER_NEW_CARD) / 10) * 10;
	return { answers, minutes: Math.round((answers * SECONDS_PER_ANSWER) / 60) };
}

/** The most days a week a goal can ask for. 0 is no goal. */
export const MAX_GOAL_DAYS = 7;
/** The longest if-then plan kept, in characters: "When I have my morning coffee". */
export const MAX_PLAN_LENGTH = 80;

export interface ReviewSettings {
	/** How many words not yet seen are shown in a day. */
	new_per_day: number;
	/**
	 * The decks new words come from, by id: "saved" for every saved word, or
	 * lists as "list:<id>" for only those, then the decks of common words.
	 * Reviews do not depend on it: every word started comes back (reviewWords).
	 */
	decks: string[];
	/**
	 * Decks whose reviews wait, by id from DECK_IDS: a paused deck gives no
	 * reviews and no new words until it is resumed. A word that is also in a
	 * deck not paused keeps coming. "saved" pauses every list with it.
	 */
	paused: string[];
	/** On how many days a week the visitor means to practise, 1 to 7; 0 when they have set no goal. */
	goal_days: number;
	/** The visitor's if-then plan in their own words, "When I have my morning coffee"; empty when none. */
	plan: string;
	/** When the visitor last changed these (ms): the later of two copies is kept. */
	updated_at: number;
}

export const DEFAULT_SETTINGS: ReviewSettings = {
	new_per_day: 10, decks: [SAVED_DECK], paused: [], goal_days: 0, plan: '', updated_at: 0
};

/**
 * A plan as it is kept: one line, no control or formatting characters,
 * trimmed, and at most MAX_PLAN_LENGTH characters, counted by code point so
 * that a character is never cut in half.
 */
export function cleanPlan(value: unknown): string {
	if (typeof value !== 'string') return '';
	const line = value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\s]+/gu, ' ').trim();
	return [...line].slice(0, MAX_PLAN_LENGTH).join('').trim();
}

/**
 * Read settings from storage or from a browser, or null when they are not
 * settings. A goal or plan that is missing, as in settings kept before goals
 * existed, or malformed, is read as none: the decks are not lost with it.
 */
export function parseSettings(value: unknown, now = Date.now()): ReviewSettings | null {
	if (!value || typeof value !== 'object') return null;
	const { new_per_day, decks, paused, goal_days, plan, updated_at } = value as Record<string, unknown>;
	if (!Number.isInteger(new_per_day) || (new_per_day as number) < 0 || (new_per_day as number) > 100) return null;
	if (!Array.isArray(decks)) return null;
	const at = Number.isInteger(updated_at) && (updated_at as number) > 0 ? Math.min(updated_at as number, now) : 0;
	return {
		new_per_day: new_per_day as number,
		// In the decks' own order, each once, and none that cannot exist: the
		// saved words, the visitor's lists as they were given, the common words.
		// Whether a list still exists only the browser knows; a deleted one has no words.
		decks: [
			...(decks.includes(SAVED_DECK) ? [SAVED_DECK] : []),
			...[...new Set(decks.filter((d): d is string => typeof d === 'string' && listOfDeck(d) !== null))]
				.slice(0, MAX_LISTS),
			...COMMON_DECKS.map((deck) => deck.id as string).filter((id) => decks.includes(id))
		],
		// Settings kept before decks could be paused have none paused
		paused: Array.isArray(paused) ? DECK_IDS.filter((id) => paused.includes(id)) : [],
		goal_days: Number.isInteger(goal_days) && (goal_days as number) >= 0 && (goal_days as number) <= MAX_GOAL_DAYS
			? (goal_days as number)
			: 0,
		plan: cleanPlan(plan),
		updated_at: at
	};
}
