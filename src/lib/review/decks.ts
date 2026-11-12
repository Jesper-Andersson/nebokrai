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

/** The choices offered for new cards a day. */
export const NEW_PER_DAY = [5, 10, 20];

export interface ReviewSettings {
	/** How many words not yet seen are shown in a day. */
	new_per_day: number;
	/** The decks switched on, by id: "saved", lists as "list:<id>", then the decks of common words. */
	decks: string[];
	/** When the visitor last changed these (ms): the later of two copies is kept. */
	updated_at: number;
}

export const DEFAULT_SETTINGS: ReviewSettings = { new_per_day: 10, decks: [SAVED_DECK], updated_at: 0 };

/** Read settings from storage or from a browser, or null when they are not settings. */
export function parseSettings(value: unknown, now = Date.now()): ReviewSettings | null {
	if (!value || typeof value !== 'object') return null;
	const { new_per_day, decks, updated_at } = value as Record<string, unknown>;
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
		updated_at: at
	};
}
