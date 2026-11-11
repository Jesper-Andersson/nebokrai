import { error, redirect } from '@sveltejs/kit';
import { getDatabases } from '#lib/server/db.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { wordSlug } from '#lib/search/slug.ts';
import { wordDetails, wordDetailsBySlug } from '#lib/search/word.ts';
import type { PageServerLoad } from './$types';

// /word/shvetsiia is the address; /word/Швеція still works and redirects to
// it. The few words with no Latin letters (ь, №) keep their Cyrillic address.
export const load: PageServerLoad = async ({ params }) => {
	const asked = params.word;
	// No address is this long (the longest slug has 62 letters): no need to ask the database.
	if (asked.length > MAX_WORD_LENGTH) error(404, 'No dictionary entry at this address.');
	const { db } = await getDatabases();

	if (/[^\x00-\x7f]/.test(asked)) {
		const slug = wordSlug(asked);
		if (slug) redirect(301, `/word/${slug}`);
		const entries = await wordDetails(db, asked);
		if (!entries.length) error(404, `No dictionary entry for “${asked}”.`);
		return { entries };
	}

	// Encoded, because the address can hold anything: /word/A%3Fb must not redirect to /word/a?b.
	if (asked !== asked.toLowerCase()) redirect(301, `/word/${encodeURIComponent(asked.toLowerCase())}`);
	const entries = await wordDetailsBySlug(db, asked);
	if (!entries.length) error(404, `No dictionary entry for “${asked}”.`);
	return { entries };
};
