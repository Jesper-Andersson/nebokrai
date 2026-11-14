import { pointCounts } from '#lib/practice/gaps.ts';
import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { PageServerLoad } from './$types';

// Which grammar points have sentences: a rule with none is never asked, so
// the dashboard must not count it as one still to be met. The same value,
// under the same name in the cache, as /practice reads.
export const load: PageServerLoad = async ({ url }) => ({
	sentences: await cachedJson(`${url.origin}/cache/practice`, async () => {
		const { db } = await getDatabases();
		return pointCounts(db);
	})
});
