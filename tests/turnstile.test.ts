// The server's side of the bot check on the report form
// (src/lib/server/turnstile.ts). Cloudflare is played by a stand-in fetch, so
// this needs no network, no key and no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyTurnstile } from '../src/lib/server/turnstile.ts';

/** A fetch that answers as given and remembers what it was asked. */
function cloudflare(answer: () => Response | Promise<Response>) {
	const asked: { url: string; body: Record<string, unknown> }[] = [];
	const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
		asked.push({ url: String(url), body: JSON.parse(String(init?.body)) });
		return answer();
	}) as typeof fetch;
	return { asked, fetcher };
}

test('a token Cloudflare accepts lets the report through', async () => {
	const { asked, fetcher } = cloudflare(() => Response.json({ success: true, hostname: 'nebokrai.app' }));
	assert.equal(await verifyTurnstile('token', 'secret', '203.0.113.7', fetcher), 'ok');
	assert.equal(asked.length, 1);
	assert.equal(asked[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
	assert.deepEqual(asked[0].body, { secret: 'secret', response: 'token', remoteip: '203.0.113.7' });
});

test('no address is sent when there is none', async () => {
	const { asked, fetcher } = cloudflare(() => Response.json({ success: true }));
	await verifyTurnstile('token', 'secret', null, fetcher);
	assert.deepEqual(asked[0].body, { secret: 'secret', response: 'token' });
});

test('a false, used or expired token is refused', async () => {
	for (const code of ['invalid-input-response', 'timeout-or-duplicate', 'missing-input-response']) {
		const { fetcher } = cloudflare(() => Response.json({ success: false, 'error-codes': [code] }));
		assert.equal(await verifyTurnstile('token', 'secret', null, fetcher), 'refused', code);
	}
	// No codes at all still is not a yes
	const { fetcher } = cloudflare(() => Response.json({ success: false }));
	assert.equal(await verifyTurnstile('token', 'secret', null, fetcher), 'refused');
});

test('only a plain true counts as success', async () => {
	const { fetcher } = cloudflare(() => Response.json({ success: 'true' }));
	assert.equal(await verifyTurnstile('token', 'secret', null, fetcher), 'refused');
});

test('no verdict is not a pass', async () => {
	const down = cloudflare(() => new Response('Bad gateway', { status: 502 }));
	assert.equal(await verifyTurnstile('token', 'secret', null, down.fetcher), 'unreachable');

	const offline = cloudflare(() => {
		throw new TypeError('fetch failed');
	});
	assert.equal(await verifyTurnstile('token', 'secret', null, offline.fetcher), 'unreachable');

	const notJson = cloudflare(() => new Response('<html>', { status: 200 }));
	assert.equal(await verifyTurnstile('token', 'secret', null, notJson.fetcher), 'unreachable');
});

test('a fault of ours or of Cloudflare is not blamed on the visitor', async () => {
	const error = console.error;
	console.error = () => {};
	try {
		for (const code of ['invalid-input-secret', 'missing-input-secret', 'bad-request', 'internal-error']) {
			const { fetcher } = cloudflare(() => Response.json({ success: false, 'error-codes': [code] }));
			assert.equal(await verifyTurnstile('token', 'secret', null, fetcher), 'unreachable', code);
		}
	} finally {
		console.error = error;
	}
});
