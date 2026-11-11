// Keeps answers that are the same for every visitor (a search, a word's
// details) in Cloudflare's cache for a while, so asking the same thing again
// costs no database read. One search can read tens of thousands of rows
// ("of" matches 7,442 entries), which is the cheapest way to use up the
// database's daily allowance; with this, repeating it is free.
//
// The cache belongs to each Cloudflare data centre, so the first visitor in
// each one still reaches the database. During `npm run dev` there is no cache
// and every request is answered afresh.
//
// After nebokrai.db is rebuilt and uploaded, answers can be up to an hour old.
// Entry ids change on a rebuild, so wait that hour before trusting an id in a
// new report, or purge the cache in the Cloudflare dashboard.

/** The parts of Cloudflare's `platform` used here. */
export interface EdgePlatform {
	caches?: {
		default?: {
			match(key: string): Promise<Response | undefined>;
			put(key: string, response: Response): Promise<void>;
		};
	};
	ctx?: { waitUntil(promise: Promise<unknown>): void };
}

const HOUR = 60 * 60;
/** Browsers keep an answer for five minutes, Cloudflare for an hour. */
const CACHE_CONTROL = `public, max-age=300, s-maxage=${HOUR}`;

/**
 * Answer from the cache, or call `produce` and remember its answer if it is a 200.
 *
 * `key` must be an absolute URL built only from what the answer depends on.
 * Never pass the request's own URL: extra parameters (`&x=1`, `&x=2`) would
 * each get an entry of their own and reach the database every time.
 */
export async function cached(
	platform: EdgePlatform | undefined, key: string, produce: () => Promise<Response>
): Promise<Response> {
	const cache = platform?.caches?.default;
	if (!cache) return produce();

	// A cache that fails must not take the search down with it.
	try {
		const hit = await cache.match(key);
		// Copied, because the headers of a response from the cache cannot be
		// changed, and hooks.server.ts adds headers to every answer.
		if (hit) return new Response(hit.body, hit);
	} catch {}

	const response = await produce();
	if (response.status !== 200) return response;
	response.headers.set('cache-control', CACHE_CONTROL);
	const stored = cache.put(key, response.clone()).catch(() => {});
	// Store after answering where the platform allows it.
	if (platform.ctx) platform.ctx.waitUntil(stored);
	else await stored;
	return response;
}
