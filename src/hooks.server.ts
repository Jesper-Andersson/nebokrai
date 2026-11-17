// Reads the visitor's settings (theme, interface language, background) from
// cookies and writes them into the page before it is sent, so the first paint
// is already in the right theme and language. The settings menu sets the cookies.
//
// Also finds out who is signed in, from the session cookie. A visitor without
// that cookie costs no database query.
//
// Also the site's guard: it refuses writes that come from another site, and
// puts the security headers on every answer. The Content-Security-Policy
// itself is in vite.config.ts.
//
// And it slows crawlers: a client that asks the pages and endpoints that read
// the dictionary too often gets 429 (src/lib/server/crawler.ts).
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { isCounted, limitKey, tooMany } from '#lib/server/crawler.ts';
import { clearSessionCookie, setSessionCookie } from '#lib/server/oauth.ts';
import { mayWrite } from '#lib/server/request.ts';
import { getUserDb } from '#lib/server/user-db.ts';
import { SESSION_COOKIE, SESSION_TOKEN, validateSession } from '#lib/server/users.ts';
import { readSettings } from '#lib/settings.ts';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const HEADERS: Record<string, string> = {
	// Never guess a file's type from its content
	'x-content-type-options': 'nosniff',
	// No other site may show this one in a frame (older browsers; the CSP says the same)
	'x-frame-options': 'DENY',
	// Other sites learn that a visitor came from here, not which word they were reading
	'referrer-policy': 'strict-origin-when-cross-origin',
	// A window this site opens, or is opened from, gets no handle on it
	'cross-origin-opener-policy': 'same-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

// Not pages to find through a search engine: the API, a visitor's own list
// and flashcards, the report form and the sign-in addresses. static/robots.txt asks crawlers
// not to fetch most of these; this covers the ones that are fetched anyway.
// /stats is the private visit counts (404 for all but the site's owner).
// /dev is pages for building the site (the style guide): the built site
// answers 404 for them, and this is the second lock on that door.
const NOT_FOR_SEARCH = /^\/(api|saved|review|import|report|login|auth|logout|dev|stats)(\/|$)/;
// Nor is a search made from the address (/?q=kava): the page to find is the
// search page itself, and the words have pages of their own.
const isSearch = (url: URL) => url.pathname === '/' && url.searchParams.has('q');

// How long a page waits to learn who is signed in. A lookup takes a few
// milliseconds; this is for the day it takes for ever.
const SESSION_WAIT_MS = 3000;

export const handle: Handle = async ({ event, resolve }) => {
	const response = await answer({ event, resolve });
	for (const [name, value] of Object.entries(HEADERS)) response.headers.set(name, value);
	if (NOT_FOR_SEARCH.test(event.url.pathname) || isSearch(event.url)) {
		response.headers.set('x-robots-tag', 'noindex');
	}
	if (event.url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
	}
	// Anything answered to a signed-in visitor may hold their name or their
	// words: no cache between here and their browser may keep it.
	if (event.cookies.get(SESSION_COOKIE) && !response.headers.has('cache-control')) {
		response.headers.set('cache-control', 'private, no-store');
	}
	return response;
};

/**
 * True when this request is over its client's limit. Not in dev (no
 * bindings), not for SvelteKit's own requests (/?q= fetches /api/search
 * itself, and that is one search), and never when the limiter fails: a
 * limit that breaks must not take the dictionary down with it.
 */
async function overLimit(event: Parameters<Handle>[0]['event']): Promise<boolean> {
	if (dev || event.isSubRequest || !isCounted(event.url)) return false;
	const cf = (event.request as Request & { cf?: { asn?: number } }).cf;
	const who = limitKey({
		address: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent'),
		asn: cf?.asn
	});
	if (!who) return false;
	const limiter = who.kind === 'bot' ? env.CRAWLER_LIMIT : env.VISITOR_LIMIT;
	if (!limiter) return false;
	try {
		return !(await limiter.limit({ key: who.key })).success;
	} catch (err) {
		console.error('Rate limit failed:', err);
		return false;
	}
}

const answer: Handle = async ({ event, resolve }) => {
	if (await overLimit(event)) return tooMany(event.url.pathname);

	// A browser says where a write comes from, and one from another site is
	// refused, or that site could write with a visitor's session. `mayWrite`
	// has the rules, and the one exception (a browser extension saving a word).
	const allowed = mayWrite(
		{ origin: event.request.headers.get('origin'), contentType: event.request.headers.get('content-type') },
		event.url
	);
	if (WRITES.has(event.request.method) && !allowed) {
		return Response.json({ error: 'cross_site' }, { status: 403 });
	}

	const settings = readSettings((name) => event.cookies.get(name));
	event.locals.settings = settings;

	event.locals.user = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token && !SESSION_TOKEN.test(token)) clearSessionCookie(event.cookies);
	else if (token) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			// A database that never answers must not hold the page back either:
			// after SESSION_WAIT_MS the lookup counts as failed.
			const session = await Promise.race([
				getUserDb().then((users) => users && validateSession(users, token)),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error(`no answer in ${SESSION_WAIT_MS} ms`)), SESSION_WAIT_MS);
				})
			]);
			if (!session) clearSessionCookie(event.cookies);
			else {
				event.locals.user = session.user;
				if (session.renewed) setSessionCookie(event.cookies, token, session.expiresAt);
			}
		} catch (err) {
			// The user database cannot be reached. The dictionary does not need
			// it: answer as to a signed-out visitor and keep their cookie, so
			// they are signed in again once the database is back.
			console.error('Session lookup failed:', err);
		} finally {
			// The lookup answered in time: no timer is left behind for every signed-in request.
			clearTimeout(timer);
		}
	}

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%app.lang%', settings.lang)
				.replace('%app.theme%', settings.theme === 'system' ? '' : `data-theme="${settings.theme}"`)
				.replace('%app.bg%', settings.background === 'plain' ? '' : `data-bg="${settings.background}"`)
				.replace('%app.font%', settings.font === 'serif' ? '' : `data-font="${settings.font}"`)
	});
};
