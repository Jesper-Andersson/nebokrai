// Words an import could not find in the dictionary (POST /api/words/missing).
// They are kept so the dictionary can grow where learners need it: картинка
// and ґоблін were in a real deck and are in no entry. Only the word is sent,
// never who sent it or the rest of the card. This is the check the server
// makes before keeping any; pure, so `npm test` runs it.
import { stripControls } from '../report.ts';
import { MAX_WORD_LENGTH } from '../saved.ts';
import { isCyrillic } from '../search/normalize.ts';

/** The most words in one request. A deck of 1,389 cards had 65 with no match. */
export const MISSING_MAX = 200;

/**
 * The words worth keeping from a request's `words`, once each, or null when
 * the request is not a list of at most MISSING_MAX. A word with no Cyrillic
 * letter (a stray English back of a card) is dropped, as are empty ones.
 */
export function cleanMissing(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length > MISSING_MAX) return null;
	const words = new Set<string>();
	for (const item of value) {
		if (typeof item !== 'string') continue;
		const word = stripControls(item).normalize('NFC').replace(/\s+/g, ' ').trim();
		if (word && word.length <= MAX_WORD_LENGTH && isCyrillic(word)) words.add(word);
	}
	return [...words];
}
