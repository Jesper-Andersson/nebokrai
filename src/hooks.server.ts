// Reads the visitor's settings (theme, interface language) from cookies and
// writes them into the page before it is sent, so the first paint is already
// in the right theme and language. The settings menu sets the cookies.
//
// Also finds out who is signed in, from the session cookie. A visitor without
// that cookie costs no database query.
//
// Also the site's guard: it refuses writes that come from another site, and
// puts the security headers on every answer. The Content-Security-Policy
// itself is in vite.config.ts.
import type { Handle } from '@sveltejs/kit/hooks';
import { clearSessionCookie, setSessionCookie } from '#lib/server/oauth.ts';
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

export const handle: Handle = async ({ event, resolve }) => {
	const response = await answer({ event, resolve });
	for (const [name, value] of Object.entries(HEADERS)) response.headers.set(name, value);
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

const answer: Handle = async ({ event, resolve }) => {
	// A browser says where a write comes from. SvelteKit checks this for form
	// posts only; the JSON endpoints (/api/report, /api/saved/…) need it too,
	// or another site could write with a visitor's session. Requests with no
	// Origin header are not from a page in a browser (curl, a script).
	const origin = event.request.headers.get('origin');
	if (WRITES.has(event.request.method) && origin !== null && origin !== event.url.origin) {
		return Response.json({ error: 'cross_site' }, { status: 403 });
	}

	const settings = readSettings((name) => event.cookies.get(name));
	event.locals.settings = settings;

	event.locals.user = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token && !SESSION_TOKEN.test(token)) clearSessionCookie(event.cookies);
	else if (token) {
		try {
			const users = await getUserDb(event.platform);
			const session = users && (await validateSession(users, token));
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
		}
	}

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%app.lang%', settings.lang)
				.replace('%app.theme%', settings.theme === 'system' ? '' : `data-theme="${settings.theme}"`)
	});
};
