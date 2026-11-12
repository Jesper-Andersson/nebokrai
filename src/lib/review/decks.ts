// Where the review page takes its words from, and the visitor's choices about
// it. Shared by the browser and the server; no imports from SvelteKit.

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

/** The choices offered for new cards a day. */
export const NEW_PER_DAY = [5, 10, 20];

export interface ReviewSettings {
	/** How many words not yet seen are shown in a day. */
	new_per_day: number;
	/** The decks switched on, by id. */
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
		// In the decks' own order, each once, and none that does not exist.
		decks: DECK_IDS.filter((id) => decks.includes(id)),
		updated_at: at
	};
}
