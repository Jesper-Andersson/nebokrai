// POST /api/hit: count a page view or a search (see src/lib/server/stats.ts
// and docs/api.md). The page sends it with navigator.sendBeacon after each
// page it shows (+layout.svelte) and after a search (the search page and
// QuickSearch). Always answers 204, counted or not: there is nothing for the
// browser to do with the answer.
//
// The IP address is only an ingredient of the day's visitor hash and is never
// stored. A program, or a browser sending Do Not Track or Global Privacy
// Control, is not counted. Nor is the site's owner (the accounts that may
// read /stats): on a small site their own testing would be a large share.
//
// A visitor's first count of a day also adds to that day's counts by country
// (Cloudflare's code for the request, never the address), by phone or
// desktop, and by referring site, which the first page of a visit sends as a
// host name only.
import { waitUntil } from 'cloudflare:workers';
import { dev } from '$app/env';
import { STATS_USER_IDS } from '$app/env/private';
import { rateKey, readJson } from '#lib/server/request.ts';
import { countedReferrer, ownerIds, recordSearch, recordView, skipCounting, type Visit } from '#lib/server/stats.ts';
import { getStatsDb } from '#lib/server/stats-db.ts';
import type { RequestHandler } from './$types';

const MAX_BODY = 1024;
const MAX_QUERY = 200;

// At most 300 counts per 10 minutes from one address, so a script cannot
// inflate the numbers cheaply. In memory, per server instance: a brake.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 300;
const recent = new Map<string, { since: number; count: number }>();

function tooMany(key: string, now: number): boolean {
	const seen = recent.get(key);
	if (!seen || now - seen.since > WINDOW_MS) {
		if (recent.size > 10_000) recent.clear(); // keep memory bounded
		recent.set(key, { since: now, count: 1 });
		return false;
	}
	seen.count += 1;
	return seen.count > LIMIT;
}

const done = () => new Response(null, { status: 204 });

/**
 * Cloudflare's two-letter country code for the request. The Worker's own
 * request carries it as `cf.country`, and the adapter hands that request to
 * SvelteKit; the CF-IPCountry header says the same should it arrive without.
 */
function countryOf(request: Request): string | undefined {
	const cf = (request as Request & { cf?: { country?: unknown } }).cf;
	const country = cf?.country ?? request.headers.get('cf-ipcountry');
	return typeof country === 'string' ? country : undefined;
}

export const POST: RequestHandler = async ({ request, url, locals, getClientAddress }) => {
	if (skipCounting(request.headers)) return done();
	if (locals.user && ownerIds(STATS_USER_IDS).includes(locals.user.id)) return done();
	const body = await readJson(request, MAX_BODY);
	if (body instanceof Response || typeof body !== 'object' || body === null) return done();
	const { kind, path, query, results, referrer, suggested } = body as Record<string, unknown>;
	const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

	const now = Date.now();
	// An IPv6 home connection changes its address within its /64 (rateKey):
	// counting the /64 keeps one person one visitor.
	const ip = rateKey(getClientAddress());
	if (tooMany(ip, now)) return done();
	const visit: Visit = {
		ip,
		userAgent: request.headers.get('user-agent') ?? '',
		signedIn: Boolean(locals.user),
		now,
		country: countryOf(request)
	};

	const count = async () => {
		const db = await getStatsDb();
		if (!db) return;
		if (kind === 'view' && typeof path === 'string') {
			await recordView(db, path, visit, countedReferrer(referrer, url.hostname));
		} else if (kind === 'search' && typeof query === 'string' && query.length <= MAX_QUERY) {
			await recordSearch(db, query, number(results), visit, number(suggested));
		}
	};
	// A slow or missing database must never hold anything back; a failure is only logged.
	const counting = count().catch((err) => console.error('Counting failed:', err));
	if (dev) await counting;
	else waitUntil(counting);
	return done();
};
