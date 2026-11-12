import { error, redirect } from '@sveltejs/kit';
import { ALPHABET, OTHER, WORDS_PER_PAGE, guideWords, letterPath, wordsUnder } from '#lib/browse.ts';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

// /words/п is the first page of п, /words/п/2 the second; /words/other is
// what begins with no Ukrainian letter.
export const load: PageServerLoad = async ({ params, url }) => {
	const { letter } = params;
	if (letter !== OTHER && !ALPHABET.includes(letter)) {
		// /words/П is /words/п
		const small = letter.toLowerCase();
		if (small !== letter && ALPHABET.includes(small)) {
			redirect(301, encodeURI(letterPath(small, Number(params.page) || 1)));
		}
		error(404, 'No such letter in the Ukrainian alphabet.');
	}
	// One address for the first page
	if (params.page === '1') redirect(301, encodeURI(letterPath(letter)));
	const page = params.page === undefined ? 1 : /^[1-9]\d?$/.test(params.page) ? Number(params.page) : 0;

	// All of the letter is read to put it in order; kept, so its pages share one reading
	const words = await cachedJson(`${url.origin}/cache/words/${encodeURIComponent(letter)}`, async () =>
		wordsUnder((await getDatabases()).db, letter));
	const pages = guideWords(words);
	if (page < 1 || page > pages.length) error(404, 'No such page of this letter.');

	const first = (page - 1) * WORDS_PER_PAGE;
	return { letter, page, pages, words: words.slice(first, first + WORDS_PER_PAGE) };
};
