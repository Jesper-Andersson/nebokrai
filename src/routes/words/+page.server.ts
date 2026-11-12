import { ALPHABET, OTHER, guideWords, wordsUnder } from '#lib/browse.ts';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

// The index of the index: every letter with the guide words of its pages, so
// each page of words is one step from here.
export const load: PageServerLoad = async ({ url }) => ({
	// Thirty-four lists make this one: kept whole, so they are read once an hour at most
	letters: await cachedJson(`${url.origin}/cache/words`, async () => {
		const { db } = await getDatabases();
		const letters = [];
		for (const letter of [...ALPHABET, OTHER]) {
			const words = await wordsUnder(db, letter);
			letters.push({ letter, count: words.length, pages: guideWords(words) });
		}
		return letters;
	})
});
