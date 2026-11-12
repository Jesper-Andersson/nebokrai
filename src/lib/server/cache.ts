// Keeps answers that are the same for every visitor (a search, a word's
// details) in Cloudflare's cache for a while, so asking the same thing again
// costs no database read. One search can read tens of thousands of rows
// ("of" matches 7,442 entries), which is the cheapest way to use up the
// database's allowance; with this, repeating it is free.
//
// The cache belongs to each Cloudflare data centre, so the first visitor in
// each one still reaches the database. During `npm run dev` nothing is cached
// and every request is answered afresh.
//
// After the dictionary is replaced (data/README.md, "Publishing to D1"),
// answers can be up to an hour old, with the entry ids of the old build.
// Purge the cache in the Cloudflare dashboard to switch at once.
//
// This is the Cache API, called from here. Cloudflare's "Workers Cache",
// which caches by response headers alone, is deliberately not switched on in
// wrangler.jsonc: pages differ by cookie (theme, language) and must not be
// cached, and only the two endpoints that use this file are safe to share.
import { waitUntil } from 'cloudflare:workers';
import { dev } from '$app/env';

/** The part of a Worker's `caches.default` used here. Browsers' own `caches` has no `default`. */
interface EdgeCache {
	match(key: string): Promise<Response | undefined>;
	put(key: string, response: Response): Promise<void>;
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
 *
 * `cacheControl` is for an answer that goes stale sooner than the dictionary
 * does: the song a radio station is playing lasts seconds, not an hour.
 */
export async function cached(
	key: string,
	produce: () => Promise<Response>,
	cacheControl: string = CACHE_CONTROL
): Promise<Response> {
	// Not in dev: the adapter provides a stand-in cache there, and an hour-old
	// answer is the last thing wanted while changing the search.
	const cache = dev ? undefined : (globalThis.caches as { default?: EdgeCache } | undefined)?.default;
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
	response.headers.set('cache-control', cacheControl);
	// Stored after the answer has gone out, so the visitor does not wait for it.
	waitUntil(cache.put(key, response.clone()).catch(() => {}));
	return response;
}
