// What the endpoints do before trusting a request (src/lib/server/request.ts)
// and a report's text (src/lib/report.ts). Needs no dictionary data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { stripControls } from '../src/lib/report.ts';
import { isLocalPath, mayWrite, rateKey, readJson, returnPath } from '../src/lib/server/request.ts';
import { SESSION_TOKEN, createSession, findOrCreateUser } from '../src/lib/server/users.ts';
import { openMemoryUsers } from './local-db.ts';

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
	new Request('http://localhost/api/report', { method: 'POST', body, headers });

const refusal = async (answer: unknown) => {
	assert.ok(answer instanceof Response);
	return [answer.status, (await answer.json()).error];
};

test('a JSON body is read up to a limit', async () => {
	assert.deepEqual(await readJson(post('{"word":"книга"}'), 100), { word: 'книга' });
	assert.deepEqual(await refusal(await readJson(post('{"word":'), 100)), [400, 'invalid_json']);
	assert.deepEqual(await refusal(await readJson(new Request('http://localhost/'), 100)), [400, 'invalid_json']);

	// Exactly at the limit is fine; one byte more is not. книга is 10 bytes, not 5.
	const exact = JSON.stringify('книга'); // 12 bytes with the quotes
	assert.equal(await readJson(post(exact), 12), 'книга');
	assert.deepEqual(await refusal(await readJson(post(exact), 11)), [413, 'too_large']);
});

test('a body larger than it claims is still stopped', async () => {
	// Sent in pieces with no Content-Length, as a client that wants to hide the size would.
	const pieces = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < 50; i++) controller.enqueue(new TextEncoder().encode('"' + 'a'.repeat(98) + '"'));
			controller.close();
		}
	});
	const request = new Request('http://localhost/api/report', {
		method: 'POST', body: pieces, duplex: 'half'
	} as RequestInit);
	assert.equal(request.headers.get('content-length'), null);
	assert.deepEqual(await refusal(await readJson(request, 1000)), [413, 'too_large']);
});

test('a write is let in by where it comes from', () => {
	const site = 'https://nebokrai.app';
	const json = 'application/json';
	const to = (pathname: string) => ({ origin: site, pathname });
	const save = to('/api/saved/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0');

	// The site's own pages, whatever they send
	assert.equal(mayWrite({ origin: site, contentType: null }, to('/logout')), true);
	assert.equal(mayWrite({ origin: site, contentType: json }, to('/api/report')), true);
	// Another site, whatever it sends
	assert.equal(mayWrite({ origin: 'https://example.com', contentType: json }, save), false);
	assert.equal(mayWrite({ origin: 'null', contentType: json }, save), false);

	// The extension: saving and removing, with a body or without (0.1.2 and
	// older send neither a body nor a content type for a plain save)
	for (const origin of ['chrome-extension://abcdefghijklmnopabcdefghijklmnop', 'moz-extension://0a1b2c3d-4e5f-6789-abcd-ef0123456789']) {
		assert.equal(mayWrite({ origin, contentType: null }, save), true);
		assert.equal(mayWrite({ origin, contentType: json }, save), true);
		assert.equal(mayWrite({ origin, contentType: json }, to('/api/saved/merge/x')), false);
		assert.equal(mayWrite({ origin, contentType: json }, to('/api/account')), false);
		assert.equal(mayWrite({ origin, contentType: null }, to('/logout')), false);
	}
	assert.equal(mayWrite({ origin: 'chrome-extension://a.example.com', contentType: json }, save), false);

	// No Origin header: a script may send JSON, but nothing shaped like a form post
	assert.equal(mayWrite({ origin: null, contentType: json }, to('/api/report')), true);
	assert.equal(mayWrite({ origin: null, contentType: null }, save), false);
	assert.equal(mayWrite({ origin: null, contentType: '' }, save), false);
	assert.equal(mayWrite({ origin: null, contentType: 'Text/Plain; charset=utf-8' }, to('/api/report')), false);
	assert.equal(mayWrite({ origin: null, contentType: 'multipart/form-data; boundary=x' }, to('/logout')), false);
});

test('rate limits count an IPv6 visitor by their /64', () => {
	assert.equal(rateKey('203.0.113.7'), '203.0.113.7');
	assert.equal(rateKey('::ffff:203.0.113.7'), '::ffff:203.0.113.7');
	// One home connection: the same key whatever the last 64 bits are.
	assert.equal(rateKey('2a02:8084:1:2:aaaa:bbbb:cccc:dddd'), '2a02:8084:1:2');
	assert.equal(rateKey('2A02:8084:0001:0002::1'), '2a02:8084:1:2');
	assert.equal(rateKey('2a02:8084:1:3::1'), '2a02:8084:1:3');
	assert.equal(rateKey('2001:db8::1'), '2001:db8:0:0');
	assert.equal(rateKey('::1'), '0:0:0:0');
});

test('control characters are removed from a report', () => {
	// Clear the screen, then pretend to be a shell prompt.
	assert.equal(stripControls('\u001b[2J\u001b[Hdone\r\n$ '), '[2J[Hdone\n$ ');
	// Text that displays reversed, to disguise an address.
	assert.equal(stripControls('see ‮gro.elpmaxe‬'), 'see gro.elpmaxe');
	// Ukrainian, stress marks, line breaks and tabs are left alone.
	const fine = 'У слові кни́га наголос не там:\n\tп\'ять → п’ять';
	assert.equal(stripControls(fine), fine);
});

test('security.txt is not about to expire', () => {
	// RFC 9116 requires an Expires date and readers ignore the file after it.
	// When this fails, move the date in static/.well-known/security.txt up to a year ahead.
	const file = readFileSync('static/.well-known/security.txt', 'utf8');
	const expires = Date.parse(/^Expires: (.+)$/m.exec(file)?.[1] ?? '');
	assert.ok(expires - Date.now() > 30 * 24 * 60 * 60 * 1000, 'security.txt expires within 30 days');
	assert.match(file, /^Contact: mailto:\S+@nebokrai\.app$/m);
});

test('a new session token has the shape the hook lets through', async () => {
	const db = openMemoryUsers();
	const user = await findOrCreateUser(db, 'github', '42', 'Олена');
	for (let i = 0; i < 20; i++) assert.match((await createSession(db, user)).token, SESSION_TOKEN);
	assert.doesNotMatch('not-a-token', SESSION_TOKEN);
});

test('sign-in returns only to a page of this site', () => {
	const site = 'https://nebokrai.app';
	assert.equal(returnPath(`${site}/word/voda`, site), '/word/voda');
	assert.equal(returnPath(`${site}/?q=%D0%B2%D0%BE%D0%B4%D0%B0`, site), '/?q=%D0%B2%D0%BE%D0%B4%D0%B0');
	assert.equal(returnPath('https://example.com/word/voda', site), null);
	assert.equal(returnPath(`${site}//example.com`, site), null);
	assert.equal(returnPath(`${site}/login/github`, site), null);
	assert.equal(returnPath(`${site}/api/account`, site), null);
	assert.equal(returnPath(null, site), null);
	assert.equal(returnPath('not an address', site), null);
	assert.ok(isLocalPath('/saved'));
	for (const path of ['//example.com', '/\\example.com', 'https://example.com', 'saved', ''])
		assert.ok(!isLocalPath(path), path);
});
