// Readable addresses for word pages: /word/shvetsiia instead of
// /word/%D0%A8%D0%B2%D0%B5%D1%86%D1%96%D1%8F. The slug is the official
// national romanisation in lower case, with hyphens between words.
//
// A slug is not unique: а, А and -а are all "a". The word page shows every
// word whose slug matches, the same way it shows several entries for one
// spelling. Eleven dictionary words have no Latin letters at all (ь, №); they
// keep their Cyrillic address.

import { nationalTranslit } from './normalize.ts';

export function wordSlug(word: string): string {
	return nationalTranslit(word)
		.toLowerCase()
		// A few entries are already in Latin letters with accents (Paryž): š → s
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/['’ʼ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** The address of a word's Details page. */
export function wordPath(word: string): string {
	return `/word/${wordSlug(word) || encodeURIComponent(word)}`;
}
