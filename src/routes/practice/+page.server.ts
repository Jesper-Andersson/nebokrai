import { pointCounts } from '#lib/practice/gaps.ts';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

// Which grammar points have sentences, and how many: the same for every
// visitor until the dictionary is built again, so it is read once an hour at
// most. What the visitor has practised is the browser's to know.
export const load: PageServerLoad = async ({ url }) => ({
	sentences: await cachedJson(`${url.origin}/cache/practice`, async () => {
		const { db } = await getDatabases();
		return pointCounts(db);
	})
});
