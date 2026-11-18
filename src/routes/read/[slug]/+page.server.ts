import { error } from '@sveltejs/kit';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { textBySlug } from '#lib/texts.ts';
import type { PageServerLoad } from './$types';

// One story with its pages and sentences, addressed by its slug
// (/read/duzhe-vysokyi-cholovik), kept in the cache as /read's list is.
export const load: PageServerLoad = async ({ params, url }) => {
	const text = await cachedJson(`${url.origin}/cache/read/${encodeURIComponent(params.slug)}`, async () =>
		textBySlug((await getDatabases()).db, params.slug));
	if (!text) error(404, 'No story at this address.');
	return { text };
};
