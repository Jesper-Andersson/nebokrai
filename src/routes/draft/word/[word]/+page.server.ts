import { error, redirect } from '@sveltejs/kit';
import { DRAFT } from '#lib/draft/paths.ts';
import { getDatabases } from '#lib/server/db.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { wordSlug } from '#lib/search/slug.ts';
import { wordDetails, wordDetailsBySlug } from '#lib/search/word.ts';
import type { PageServerLoad } from './$types';

// The same answers as src/routes/word/[word]/+page.server.ts. It is a copy and
// not a re-export only because the redirects must stay under /draft.
export const load: PageServerLoad = async ({ params }) => {
	const asked = params.word;
	if (asked.length > MAX_WORD_LENGTH) error(404, 'No dictionary entry at this address.');
	const { db } = await getDatabases();

	if (/[^\x00-\x7f]/.test(asked)) {
		const slug = wordSlug(asked);
		if (slug) redirect(301, `${DRAFT}/word/${slug}`);
		const entries = await wordDetails(db, asked);
		if (!entries.length) error(404, `No dictionary entry for “${asked}”.`);
		return { entries };
	}

	if (asked !== asked.toLowerCase()) redirect(301, `${DRAFT}/word/${encodeURIComponent(asked.toLowerCase())}`);
	const entries = await wordDetailsBySlug(db, asked);
	if (!entries.length) error(404, `No dictionary entry for “${asked}”.`);
	return { entries };
};
