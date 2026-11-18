import { error, redirect } from '@sveltejs/kit';
import { TURNSTILE_SECRET, TURNSTILE_SITE_KEY as OTHER_SITE_KEY } from '$app/env/private';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases, type Databases } from '#lib/server/db.ts';
import { TURNSTILE_SITE_KEY } from '#lib/report.ts';
import { MAX_WORD_LENGTH } from '#lib/saved.ts';
import type { Db } from '#lib/search/db.ts';
import { wordSlug } from '#lib/search/slug.ts';
import { vesumFormsFor, vesumWords, vesumWordsBySlug, type VesumWord } from '#lib/search/vesum-word.ts';
import { isThin, wordDetails, wordDetailsBySlug, type WordEntry } from '#lib/search/word.ts';
import type { PageServerLoad } from './$types';

// /word/shvetsiia is the address; /word/Швеція still works and redirects to
// it. The eleven words whose romanisation has no letters or digits (ь, №, and
// the smiley ")))") have no slug and keep their own spelling as the address.
//
// The entries are kept in Cloudflare's cache (src/lib/server/cache.ts) under
// the address alone, so a word read again costs no database read. An empty
// answer is kept too: asking again for a word that is not here is free as well.
// The redirects and the 404 are decided outside, from the address and the answer.
// `turnstile` is the site key of the bot check for a suggested correction
// (SuggestEdit.svelte), or null when the server has no secret to check a token
// with, as on /report.
const turnstile = () => (TURNSTILE_SECRET ? (OTHER_SITE_KEY ?? TURNSTILE_SITE_KEY) : null);

/**
 * What the page shows: the dictionary's entries, or, when it has none at the
 * address, the words only VESUM knows there (книжечка), with their forms and
 * no meaning. `borrowed` lists the entries whose table is VESUM's, because
 * they had none of their own: an entry written for Nebokrai, or a thin one
 * (made from translation tables or from Ukrainian Wiktionary). Their footer
 * credits VESUM for it.
 */
interface WordPage {
	entries: WordEntry[];
	vesum: VesumWord[];
	borrowed: number[];
}

async function withVesum(
	{ db, vesum }: Databases, entries: WordEntry[], others: (db: Db, vesum: Db) => Promise<VesumWord[]>
): Promise<WordPage> {
	if (!vesum) return { entries, vesum: [], borrowed: [] };
	if (!entries.length) return { entries, vesum: await others(db, vesum), borrowed: [] };
	const borrowed: number[] = [];
	await Promise.all(entries.map(async (entry) => {
		if (entry.forms.length || (entry.source !== 'nebokrai' && !isThin(entry.source))) return;
		entry.forms = await vesumFormsFor(vesum, entry.word, entry.pos);
		if (entry.forms.length) borrowed.push(entry.id);
	}));
	return { entries, vesum: [], borrowed };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const asked = params.word;
	// No address is this long (the longest slug has 62 letters): no need to ask the database.
	if (asked.length > MAX_WORD_LENGTH) error(404, 'No dictionary entry at this address.');
	// Not /cache/word/: that held a bare list of entries before VESUM words had pages.
	const pageFor = (find: (dbs: Databases) => Promise<WordPage>) =>
		cachedJson(`${url.origin}/cache/word-page/${encodeURIComponent(asked)}`, async () =>
			find(await getDatabases()));
	const found = (page: WordPage) => page.entries.length > 0 || page.vesum.length > 0;

	const slug = wordSlug(asked);
	if (!slug) {
		const page = await pageFor(async (dbs) =>
			withVesum(dbs, await wordDetails(dbs.db, asked), (db, vesum) => vesumWords(db, vesum, asked)));
		if (!found(page)) error(404, `No dictionary entry for “${asked}”.`);
		return { ...page, turnstile: turnstile() };
	}
	if (/[^\x00-\x7f]/.test(asked)) redirect(301, `/word/${slug}`);

	// Encoded, because the address can hold anything: /word/A%3Fb must not redirect to /word/a?b.
	if (asked !== asked.toLowerCase()) redirect(301, `/word/${encodeURIComponent(asked.toLowerCase())}`);
	const page = await pageFor(async (dbs) =>
		withVesum(dbs, await wordDetailsBySlug(dbs.db, asked), (db, vesum) => vesumWordsBySlug(db, vesum, asked)));
	if (!found(page)) error(404, `No dictionary entry for “${asked}”.`);
	return { ...page, turnstile: turnstile() };
};
