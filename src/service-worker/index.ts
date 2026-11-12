// The service worker: with static/manifest.webmanifest, what lets a phone
// install the site as an app, and what the app shows when there is no
// connection. SvelteKit builds this file to /service-worker.js and registers
// it on every page.
//
// It does one thing: a page that cannot be reached is answered with
// static/offline.html, kept from the day the worker was installed.
//
// It keeps nothing else, on purpose:
//
// - Not pages or API answers. A page differs by cookie (theme, language, who
//   is signed in), which is also why src/lib/server/cache.ts keeps pages out
//   of Cloudflare's cache: a kept copy would show one visitor's settings, or
//   their saved words, to whoever opens the app next.
// - Not the build's scripts, styles and fonts. They are served with
//   "immutable, max-age=31536000" (_headers), so the browser's own cache
//   already keeps them for a year; a second copy here would save nothing.
//
// Requests to other sites (a radio station's stream, a recording on Wikimedia
// Commons) are not touched at all.
//
// This folder has a tsconfig.json of its own: a service worker has no window
// or document, and its types (WebWorker) cannot be mixed with the pages'.
// `npm run check` checks it after the rest.

const sw = self as unknown as ServiceWorkerGlobalScope;

const OFFLINE = '/offline.html';
/**
 * Where the offline page is kept. It is never older than the last deploy:
 * SvelteKit writes each build's version into the built worker, so every deploy
 * is a new worker to the browser, and each new worker fetches the page again.
 */
const SHELL = 'shell';

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			// `reload`: from the network, not the browser's cache of an older copy
			const response = await fetch(new Request(OFFLINE, { cache: 'reload' }));
			// Failing here leaves the worker uninstalled, and the browser tries again on the next visit
			if (!response.ok) throw new Error(`${OFFLINE} answered ${response.status}`);
			// Kept as a new answer made from the page's bytes, not as the answer
			// that came. Cloudflare serves a .html file at the address without
			// the ending and redirects /offline.html there, and a browser will
			// not take an answer that arrived by a redirect as the answer to a
			// visit: it shows its own error page instead (seen 2026-11-12).
			const page = new Response(await response.blob(), {
				headers: { 'content-type': response.headers.get('content-type') ?? 'text/html; charset=utf-8' }
			});
			const cache = await caches.open(SHELL);
			await cache.put(OFFLINE, page);
		})()
	);
});

sw.addEventListener('activate', (event) => {
	// Whatever an earlier version of this file kept under another name
	event.waitUntil(
		caches.keys().then((names) => Promise.all(names.filter((name) => name !== SHELL).map((name) => caches.delete(name))))
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	// Only a visitor going to a page of this site. Everything else (scripts,
	// the API, files in static/, other sites) goes to the network as if this
	// file were not here.
	if (request.mode !== 'navigate' || request.method !== 'GET') return;
	if (new URL(request.url).origin !== sw.location.origin) return;

	// Any failure to reach the server at all: no connection, or none that
	// answers. An error page from the server is an answer, and is shown.
	// (`ignoreVary`: the kept page is the answer whatever headers this request carries.)
	event.respondWith(
		fetch(request).catch(async () => (await caches.match(OFFLINE, { ignoreVary: true })) ?? Response.error())
	);
});
