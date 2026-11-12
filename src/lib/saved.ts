// Saved words: the shape and the limits the browser and the server share.
// The browser's side is saved.svelte.ts, the server's is server/users.ts.

/** `word` is the `word` field of a dictionary entry (книга). `saved_at` is in milliseconds. */
export interface SavedWord {
	word: string;
	saved_at: number;
}

/** When each word was last exported, in milliseconds: `{ "книга": 1794400000000 }`. */
export type ExportedMarks = Record<string, number>;

/**
 * A named list the visitor sorts saved words into ("Їжа", "Урок 3"). Lists work
 * like labels: a word can be in several, or in none. `id` is made in the
 * browser (lists.ts), so a list made while signed out is still the same list
 * once it has been merged into an account. `words` are saved words only.
 */
export interface WordList {
	id: string;
	name: string;
	created_at: number;
	words: string[];
}

/** Most words a visitor can save. */
export const MAX_SAVED = 5000;
/** Most lists one visitor can have: enough for a textbook's lessons, few enough to show as a row of chips. */
export const MAX_LISTS = 50;
/** Longest list name, in UTF-16 units, after cleaning (lists.ts). */
export const MAX_LIST_NAME = 40;
/** Longest word, or word page address, worth looking up: the longest in the dictionary has 62 letters. */
export const MAX_WORD_LENGTH = 100;
/** Most words in one POST /api/words/summary. */
export const SUMMARY_MAX = 500;
