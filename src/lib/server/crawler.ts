// Which requests count towards the crawler limit in hooks.server.ts, whom
// they are counted for, and what a client gets once it is over.
//
// Written after 16 Nov 2026, when one client asked for about 2,000 pages an
// interval for four and a half hours, each a database read. The word cache
// (src/lib/server/cache.ts) does not stop that: a crawler asks for each word
// once, and the cache belongs to each data centre. This does.
//
// The counting itself is Cloudflare's Rate Limiting binding (wrangler.jsonc,
// `ratelimits`): it counts across all the Worker's instances in a data centre,
// where a Map in memory would count per instance. Counts are approximate, so
// this is a brake, not a wall.
//
// Nothing here imports from SvelteKit, so `npm test` can run it.
import { rateKey } from './request.ts';

/**
 * The addresses that read the dictionary on every request. Other pages read
 * nothing or are cached whole (/common-words, /learn), and the signed-in
 * features are a visitor's own. /api/report has a limit of its own.
 * /word/kalyna/__data.json is the same page fetched by the app, and counts.
 */
const COUNTED = /^\/(word|api\/word|api\/search|api\/gloss)(\/|$)/;

export function isCounted(url: URL): boolean {
	return COUNTED.test(url.pathname) || (url.pathname === '/' && url.searchParams.has('q'));
}

/**
 * Search engines this site wants, each with the network it crawls from. The
 * user agent alone can be written by anyone; the network (ASN) cannot.
 * Cloudflare's own "verified bot" flag needs Bot Management, an Enterprise
 * feature, so this pair is the check available.
 */
const SEARCH_ENGINES: { agent: RegExp; asn: number }[] = [
	{ agent: /\bGooglebot\b/i, asn: 15169 },
	{ agent: /\bbingbot\b/i, asn: 8075 }
];

/**
 * Words a program puts in its user agent when it says what it is. The name
 * up to the word is the bot's name: "Mozilla/5.0 (compatible; AhrefsBot/7.0)"
 * is counted as "ahrefsbot" from whichever address it asks.
 */
const BOT_NAME =
	/([\w.-]*(?:bot|crawler|spider|scraper|curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|okhttp|java|libwww-perl|axios|node-fetch|undici))\b/i;

/**
 * Only a user agent that is not a browser's is read for a bot's name: one
 * that does not start "Mozilla/", or that says "compatible;" as crawlers do.
 * A phone's own browser must never share a count with every phone of its
 * make: "Mozilla/5.0 (Linux; Android 10; CUBOT X30) … Mobile Safari" has
 * "bot" in it and is a person.
 */
const declaresItself = (agent: string) => !agent.startsWith('Mozilla/') || /compatible;/i.test(agent);

export interface Client {
	/** The address Cloudflare saw (getClientAddress()) */
	address: string;
	userAgent: string | null;
	/** `request.cf.asn`; undefined in dev and on requests SvelteKit made anew */
	asn: number | undefined;
}

export type LimitKey = { kind: 'bot' | 'address'; key: string };

/**
 * Whom a request is counted for, or null for a search engine from its own
 * network. A bot that names itself is counted by name, so all its addresses
 * share one count; everyone else by address (an IPv6 visitor by their /64).
 */
export function limitKey({ address, userAgent, asn }: Client): LimitKey | null {
	const agent = userAgent ?? '';
	if (SEARCH_ENGINES.some((e) => e.agent.test(agent) && e.asn === asn)) return null;
	const name = declaresItself(agent) ? BOT_NAME.exec(agent)?.[1] : undefined;
	if (name) return { kind: 'bot', key: `bot:${name.toLowerCase()}` };
	return { kind: 'address', key: `ip:${rateKey(address)}` };
}

/** The window of both limits in wrangler.jsonc, in seconds: also how long to wait. */
export const RETRY_AFTER = 60;

/**
 * The answer once a client is over its limit: 429 with Retry-After. The API
 * answers in JSON like its other errors; a page gets one line of text, not
 * the site's error page, which would cost a render.
 */
export function tooMany(pathname: string): Response {
	const headers = { 'retry-after': String(RETRY_AFTER), 'cache-control': 'no-store' };
	if (pathname.startsWith('/api/')) return Response.json({ error: 'too_many' }, { status: 429, headers });
	return new Response(
		'Too many requests: please wait a minute. / Забагато запитів: зачекайте хвилину.\n',
		{ status: 429, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } }
	);
}
