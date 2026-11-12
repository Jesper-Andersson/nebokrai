// The Android app is the site shown full screen by Chrome (a Trusted Web
// Activity). Chrome hides its address bar only when the site vouches for the
// app: static/.well-known/assetlinks.json must name the app's package and the
// key it is signed with. These tests hold that file, android/twa-manifest.json
// (what Bubblewrap builds the app from) and the web manifest together. Needs
// no database and no Android tools, so it also runs in CI.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const twa = JSON.parse(readFileSync('android/twa-manifest.json', 'utf8'));
const links = JSON.parse(readFileSync('static/.well-known/assetlinks.json', 'utf8'));
const web = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));

test('the app is this site, opened where the installed site opens', () => {
	assert.equal(twa.packageId, 'app.nebokrai');
	assert.equal(twa.host, 'nebokrai.app');
	assert.equal(twa.startUrl, web.start_url);
	assert.equal(twa.display, web.display);
	assert.equal(twa.launcherName, web.short_name);
	assert.equal(twa.themeColor.toLowerCase(), web.theme_color);
	assert.equal(twa.backgroundColor.toLowerCase(), web.background_color);
	// The site sends no notifications, so the app does not ask to
	assert.equal(twa.enableNotifications, false);
});

test('the site vouches for the app and for every key it is signed with', () => {
	assert.equal(links.length, 1);
	const [link] = links;
	assert.deepEqual(link.relation, ['delegate_permission/common.handle_all_urls']);
	assert.equal(link.target.namespace, 'android_app');
	assert.equal(link.target.package_name, twa.packageId);
	const vouched: string[] = link.target.sha256_cert_fingerprints;
	assert.ok(vouched.length > 0);
	for (const print of vouched) {
		// SHA-256 as Android writes it: 32 pairs of capital hex digits with colons between
		assert.match(print, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
	}
	const known: string[] = twa.fingerprints.map((print: { value: string }) => print.value);
	assert.deepEqual([...vouched].sort(), [...known].sort());
});
