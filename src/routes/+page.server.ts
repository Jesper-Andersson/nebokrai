import { getDatabases } from '#lib/server/db.ts';
import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
import type { LookupResult } from '#lib/search/suggest.ts';
import { today, wordOfDay, type WordOfDay } from '#lib/word-of-day.ts';
import type { PageServerLoad } from './$types';

// The day's word is the same for every visitor, so a running server asks the
// database for it once a day, not once a page.
let kept: { day: number; entry: WordOfDay | null } | undefined;

async function dayWord(): Promise<WordOfDay | null> {
	const day = today();
	if (kept?.day !== day) {
		try {
			const { db } = await getDatabases();
			kept = { day, entry: await wordOfDay(db, day) };
		} catch {
			// The search page must open even when the database does not answer:
			// no word this time, and the next visit asks again.
			return null;
		}
	}
	return kept.entry;
}

// /?q=kava opens the page with the search already made, so a search has an
// address: one to send to someone, to keep as a bookmark, or to give to a
// browser's address bar (static/opensearch.xml) or a reading tool as "look
// this word up here". Without `q` the page is the empty search box.
export const load: PageServerLoad = async ({ url, fetch }) => {
	// A longer query is cut where the search box itself stops typing
	const query = (url.searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH).trim();

	// Asked of /api/search, not of the database, so the answer is the one the
	// page gets while typing, and comes from Cloudflare's cache when it is there.
	const search = async (): Promise<LookupResult | null> => {
		if (!query) return null;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
			return res.ok ? await res.json() : null;
		} catch {
			return null;
		}
	};

	const [entry, found] = await Promise.all([dayWord(), search()]);
	// With no answer the page says so, and asks again from the browser
	return { wordOfDay: entry, query, found, failed: Boolean(query) && !found };
};
