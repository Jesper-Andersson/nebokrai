// What a phone needs to install the site as an app: the manifest, its icons,
// the offline page and the service worker's rule about pages. Needs no
// database, so it also runs in CI. Whether a real browser offers "Install" is
// seen in the browser: Chrome's Application panel reads the same manifest.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

interface Icon {
	src: string;
	sizes: string;
	type: string;
	purpose: string;
}

const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));
const icons: Icon[] = manifest.icons;

test('the page names the manifest, and the manifest opens the site as an app', () => {
	assert.match(readFileSync('src/app.html', 'utf8'), /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
	assert.ok(manifest.name.includes('Nebokrai'));
	// Under a home-screen icon there is room for about 12 letters
	assert.ok(manifest.short_name.length <= 12, `short_name is ${manifest.short_name.length} letters`);
	// No address bar: the thing that makes it an app, and what a Trusted Web Activity asks for
	assert.equal(manifest.display, 'standalone');
	assert.equal(manifest.scope, '/');
	assert.ok(manifest.start_url.startsWith(manifest.scope), 'the app opens inside its own scope');
	// The splash screen and the app's bar take the page's colour (--bg in src/app.css, light)
	const light = /<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: light\)"/.exec(
		readFileSync('src/app.html', 'utf8')
	)?.[1];
	assert.equal(manifest.theme_color, light);
	assert.equal(manifest.background_color, light);
});

test('every icon is a PNG of the size the manifest says', () => {
	for (const icon of icons) {
		const path = 'static' + icon.src;
		assert.ok(existsSync(path), `${icon.src} is in static/`);
		const png = readFileSync(path);
		assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG', `${icon.src} is a PNG`);
		assert.equal(icon.type, 'image/png');
		// A PNG states its width and height in bytes 16 to 23
		assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
	}
});

test('the icons are the ones Chrome and Android ask for', () => {
	const has = (sizes: string, purpose: string) => icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose);
	// Chrome offers to install only with both of these
	assert.ok(has('192x192', 'any'), 'a 192 pixel icon');
	assert.ok(has('512x512', 'any'), 'a 512 pixel icon');
	// Android cuts the home-screen icon to its own shape: without a maskable one it shrinks the plain icon onto a white disc
	assert.ok(has('512x512', 'maskable'), 'a maskable icon');
	// One purpose to an icon: "any maskable" shows the padded icon where the plain one was wanted
	for (const icon of icons) assert.match(icon.purpose, /^(any|maskable)$/, icon.src);
});

test('the shortcuts lead to pages of the site', () => {
	for (const shortcut of manifest.shortcuts) {
		assert.ok(shortcut.name && shortcut.url.startsWith(manifest.scope), shortcut.url);
		assert.ok(existsSync(`src/routes${shortcut.url}/+page.svelte`), `${shortcut.url} is a page`);
	}
});

test('the offline page stands alone and stays out of search engines', () => {
	const page = readFileSync('static/offline.html', 'utf8');
	// Nothing it would have to fetch: with no connection, it could not
	assert.doesNotMatch(page, /<script|<link rel="stylesheet"|@import|url\(/);
	assert.match(page, /<meta name="robots" content="noindex" \/>/);
	// Both languages: the page cannot know which one the visitor chose
	assert.match(page, /You are offline/);
	assert.match(page, /<section lang="uk">/);
	// Cloudflare serves the file at /offline as well; the one line covers both
	assert.match(readFileSync('static/robots.txt', 'utf8'), /^Disallow: \/offline$/m);
});

test('the service worker shows the offline page and keeps no page of the site', () => {
	const worker = readFileSync('src/service-worker/index.ts', 'utf8');
	assert.match(worker, /const OFFLINE = '\/offline\.html';/);
	// The only thing put in a cache is the offline page. A kept page would
	// show one visitor's settings or saved words to the next.
	const puts = worker.match(/\.(put|add|addAll)\(/g) ?? [];
	assert.equal(puts.length, 1, 'one put, of the offline page');
	assert.ok(worker.includes('cache.put(OFFLINE, page)'));
	// Not the answer as it came: one that arrived by a redirect cannot answer a visit
	assert.ok(worker.includes('new Response(await response.blob(),'));
	// And only a visit to a page is answered by the worker at all
	assert.ok(worker.includes("if (request.mode !== 'navigate' || request.method !== 'GET') return;"));
});
