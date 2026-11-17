import { error, redirect } from '@sveltejs/kit';
import { TURNSTILE_SECRET, TURNSTILE_SITE_KEY as OTHER_SITE_KEY } from '$app/env/private';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { TURNSTILE_SITE_KEY } from '#lib/report.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import { wordSlug } from '#lib/search/slug.ts';
import { wordDetails, wordDetailsBySlug } from '#lib/search/word.ts';
import type { PageServerLoad } from './$types';

// /word/shvetsiia is the address; /word/Швеція still works and redirects to
// it. The eleven words whose romanisation has no letters or digits (ь, №, and
// the smiley ")))") have no slug and keep their own spelling as the address.
//
// The entries are kept in Cloudflare's cache (src/lib/server/cache.ts) under
// the address alone, so a word read again costs no database read. An empty
// list is kept too: asking again for a word that is not here is free as well.
// The redirects and the 404 are decided outside, from the address and the list.
// `turnstile` is the site key of the bot check for a suggested correction
// (SuggestEdit.svelte), or null when the server has no secret to check a token
// with, as on /report.
const turnstile = () => (TURNSTILE_SECRET ? (OTHER_SITE_KEY ?? TURNSTILE_SITE_KEY) : null);

export const load: PageServerLoad = async ({ params, url }) => {
	const asked = params.word;
	// No address is this long (the longest slug has 62 letters): no need to ask the database.
	if (asked.length > MAX_WORD_LENGTH) error(404, 'No dictionary entry at this address.');
	const entriesFor = (find: typeof wordDetails) =>
		cachedJson(`${url.origin}/cache/word/${encodeURIComponent(asked)}`, async () =>
			find((await getDatabases()).db, asked));

	const slug = wordSlug(asked);
	if (!slug) {
		const entries = await entriesFor(wordDetails);
		if (!entries.length) error(404, `No dictionary entry for “${asked}”.`);
		return { entries, turnstile: turnstile() };
	}
	if (/[^\x00-\x7f]/.test(asked)) redirect(301, `/word/${slug}`);

	// Encoded, because the address can hold anything: /word/A%3Fb must not redirect to /word/a?b.
	if (asked !== asked.toLowerCase()) redirect(301, `/word/${encodeURIComponent(asked.toLowerCase())}`);
	const entries = await entriesFor(wordDetailsBySlug);
	if (!entries.length) error(404, `No dictionary entry for “${asked}”.`);
	return { entries, turnstile: turnstile() };
};
