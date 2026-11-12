import { error, redirect } from '@sveltejs/kit';
import { COMMON_PER_PAGE, COMMON_WORDS, commonPath, commonWords } from '#lib/browse.ts';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

// /common-words is the first hundred, /common-words/2 the second, to /common-words/10.
export const load: PageServerLoad = async ({ params, url }) => {
	// One address for the first page
	if (params.page === '1') redirect(301, commonPath());
	const page = params.page === undefined ? 1 : /^[1-9]\d?$/.test(params.page) ? Number(params.page) : 0;
	const pages = COMMON_WORDS / COMMON_PER_PAGE;
	if (page < 1 || page > pages) error(404, 'No such page of the common words.');

	// The whole list is made once and kept: every page is a slice of it
	const words = await cachedJson(`${url.origin}/cache/common-words`, async () =>
		commonWords((await getDatabases()).db));
	const first = (page - 1) * COMMON_PER_PAGE;
	return { page, pages, first: first + 1, words: words.slice(first, first + COMMON_PER_PAGE) };
};
