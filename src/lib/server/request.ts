// What an endpoint does to a request before trusting it: read a JSON body
// without letting it grow past a limit, and name the visitor for a rate limit.
//
// Nothing here imports from SvelteKit, so `npm test` can run it.

const refuse = (status: number, error: string) => Response.json({ error }, { status });

/**
 * The request's JSON body, or the Response to answer with: 413 `too_large`
 * when it is over `maxBytes`, 400 `invalid_json` when it does not parse.
 *
 * `request.json()` would read whatever is sent, and a Worker has 128 MB of
 * memory. Reading stops at the limit even when Content-Length lies or is absent.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
	if (Number(request.headers.get('content-length')) > maxBytes) return refuse(413, 'too_large');
	const reader = request.body?.getReader();
	if (!reader) return refuse(400, 'invalid_json');

	const bytes = new Uint8Array(maxBytes);
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (size + value.byteLength > maxBytes) {
			await reader.cancel();
			return refuse(413, 'too_large');
		}
		bytes.set(value, size);
		size += value.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)));
	} catch {
		return refuse(400, 'invalid_json');
	}
}

// Where a browser extension's own scripts ask from (Chrome and Edge; Firefox),
// and the only addresses one may write to: PUT and DELETE /api/saved/<word>
const EXTENSION_ORIGIN = /^(chrome|moz)-extension:\/\/[\w-]+$/;
const EXTENSION_WRITES = /^\/api\/saved\/[^/]+$/;
// What a form on a page can send, with SvelteKit's own type for one
const FORM_TYPES = new Set([
	'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'application/x-sveltekit-formdata'
]);

/**
 * Whether a POST, PUT, PATCH or DELETE may go on to its endpoint, judged by
 * where the browser says it comes from. This is the site's whole check on
 * that: SvelteKit's own is turned off in vite.config.ts, because it runs
 * first and cannot be told about the one exception below.
 *
 * - From the site itself: yes.
 * - With no Origin header: not from a page in a browser (curl, a script), so
 *   yes, unless it is shaped like a form post (a form's content type, or
 *   none). SvelteKit refuses those, and an old browser may send one bare.
 * - From a browser extension: only saving a word and removing it (the pop-up
 *   dictionary in extension/ does). No page can send an extension's origin,
 *   and the browser gives the session cookie only to an extension its user
 *   has let onto this site, which could already act here as them.
 * - From any other site: no.
 */
export function mayWrite(
	from: { origin: string | null; contentType: string | null }, to: { origin: string; pathname: string }
): boolean {
	if (from.origin === to.origin) return true;
	if (from.origin === null) {
		const type = from.contentType?.split(';', 1)[0].trim().toLowerCase();
		return Boolean(type) && !FORM_TYPES.has(type!);
	}
	return EXTENSION_ORIGIN.test(from.origin) && EXTENSION_WRITES.test(to.pathname);
}

/**
 * The address to count requests by. An IPv6 visitor is counted by their /64:
 * one home connection is given that whole range, so counting single addresses
 * would let it send 2^64 times the limit. 2a02:8084:1:2:aaaa:bbbb:cccc:dddd
 * becomes 2a02:8084:1:2.
 */
export function rateKey(address: string): string {
	// IPv4, also when written as ::ffff:203.0.113.7
	if (!address.includes(':') || address.includes('.')) return address;
	const [head, tail] = address.toLowerCase().split('::');
	const groups = head ? head.split(':') : [];
	if (tail !== undefined) {
		const after = tail ? tail.split(':') : [];
		while (groups.length + after.length < 8) groups.push('0');
		groups.push(...after);
	}
	return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}

/** A path on this site and nothing else: `//host` and `/\host` leave it. */
export function isLocalPath(path: string): boolean {
	return path.length <= 500 && /^\/(?![/\\])/.test(path) && !/[\\\x00-\x1f]/.test(path);
}

/**
 * Where a visitor was when they chose to sign in, read from the Referer
 * header, so the callback can send them back to it and not always to Saved
 * words. Null for another site's page, for no header, and for the addresses
 * that are not pages to return to (/login, /auth, /logout, /api).
 */
export function returnPath(referer: string | null, origin: string): string | null {
	if (!referer) return null;
	try {
		const url = new URL(referer);
		if (url.origin !== origin) return null;
		if (/^\/(login|auth|logout|api)(\/|$)/.test(url.pathname)) return null;
		const path = url.pathname + url.search;
		return isLocalPath(path) ? path : null;
	} catch {
		return null;
	}
}
