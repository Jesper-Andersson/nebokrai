// The style guide, in `npm run dev` only; the built site answers 404. It
// shows the real components, so it asks the dictionary for one real word
// (кава) the way the search page and the word's page would.
import { error } from '@sveltejs/kit';
import { getDatabases } from '#lib/server/db.ts';
import { lookup } from '#lib/search/suggest.ts';
import { wordDetails } from '#lib/search/word.ts';
import type { PageServerLoad } from './$types';

const WORD = 'кава';

export const load: PageServerLoad = async () => {
	if (!import.meta.env.DEV) error(404, 'Not found');

	const { db, vesum } = await getDatabases();
	const [found, entries] = await Promise.all([lookup(db, WORD, { limit: 1, vesum }), wordDetails(db, WORD)]);
	return { card: found.results[0] ?? null, entry: entries[0] ?? null };
};
