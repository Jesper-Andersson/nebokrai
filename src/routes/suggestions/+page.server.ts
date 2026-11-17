// /suggestions: the corrections readers have suggested (SuggestEdit.svelte on
// a word's page), for the site's owner to accept or reject. Anyone whose
// account id is not in the secret STATS_USER_IDS gets the same 404 as an
// address that does not exist, as on /stats, which links here.
//
// ?status=new (the default), accepted, rejected or applied picks the list.
import { error } from '@sveltejs/kit';
import { STATS_USER_IDS } from '$app/env/private';
import { ownerIds } from '#lib/server/stats.ts';
import { getSuggestionDb } from '#lib/server/suggestion-db.ts';
import { countSuggestions, isSuggestionStatus, listSuggestions } from '#lib/server/suggestions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	if (!locals.user || !ownerIds(STATS_USER_IDS).includes(locals.user.id)) error(404);
	setHeaders({ 'cache-control': 'private, no-store' });

	const asked = url.searchParams.get('status');
	const status = isSuggestionStatus(asked) ? asked : 'new';
	const db = await getSuggestionDb();
	const [counts, suggestions] = await Promise.all([countSuggestions(db), listSuggestions(db, status, 200)]);
	return { status, counts, suggestions };
};
