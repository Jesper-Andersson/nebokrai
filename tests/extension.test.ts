// Which store a visitor's browser installs the extension from
// (src/lib/extension.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserOf, EXTENSION_LIVE, offered, STORES } from '../src/lib/extension.ts';

const UA = {
	chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
	edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
	firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0',
	safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
	androidChrome: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36',
	androidFirefox: 'Mozilla/5.0 (Android 16; Mobile; rv:160.0) Gecko/160.0 Firefox/160.0',
	iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1'
};

test('a browser on a computer is sent to its own store', () => {
	assert.equal(browserOf(UA.chrome), 'chrome');
	assert.equal(browserOf(UA.firefox), 'firefox');
	// Edge says Chrome too, and has a store of its own
	assert.equal(browserOf(UA.edge), 'edge');
});

test('a phone and Safari are offered nothing', () => {
	for (const ua of [UA.safari, UA.androidChrome, UA.androidFirefox, UA.iphone, '']) assert.equal(browserOf(ua), null);
});

test('nothing is offered until a store has the extension', () => {
	const published = STORES.filter((store) => store.url);
	assert.equal(EXTENSION_LIVE, published.length > 0);
	assert.deepEqual(offered(), published);
	for (const store of published) assert.match(store.url, /^https:\/\//);
});
