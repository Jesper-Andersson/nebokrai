// Saved words: the shape and the limits the browser and the server share.
// The browser's side is saved.svelte.ts, the server's is server/users.ts.

/** `word` is the `word` field of a dictionary entry (книга). `saved_at` is in milliseconds. */
export interface SavedWord {
	word: string;
	saved_at: number;
}

/** When each word was last exported, in milliseconds: `{ "книга": 1794400000000 }`. */
export type ExportedMarks = Record<string, number>;

/** Most words one list can hold. */
export const MAX_SAVED = 5000;
/** Longest word, or word page address, worth looking up: the longest in the dictionary has 62 letters. */
export const MAX_WORD_LENGTH = 100;
/** Most words in one POST /api/words/summary. */
export const SUMMARY_MAX = 500;
