import { cachedJson } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { listTexts, type TextSummary } from '#lib/texts.ts';
import type { PageServerLoad } from './$types';

// Every story, with the words each is made of, so the page can say how much
// of each the visitor knows from their own cards, in the browser. Kept in
// Cloudflare's cache under /cache/read (src/lib/server/cache.ts). A database
// without the stories' tables (data/import_stories.py not yet run on it)
// gives an empty list, not an error page.
export const load: PageServerLoad = async ({ url }) => {
	let texts: TextSummary[] = [];
	try {
		texts = await cachedJson(`${url.origin}/cache/read`, async () => listTexts((await getDatabases()).db));
	} catch {
		texts = [];
	}
	return { texts };
};
