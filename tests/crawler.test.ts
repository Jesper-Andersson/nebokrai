// The crawler limit's decisions: which requests count, whom they count for,
// and the 429. The counting itself is Cloudflare's binding and is not run here.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isCounted, limitKey, RETRY_AFTER, tooMany } from '../src/lib/server/crawler.ts';

const CHROME =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BINGBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36';
const counted = (path: string) => isCounted(new URL(path, 'https://nebokrai.app'));

test('the routes that read the dictionary are counted', () => {
	for (const path of [
		'/word/kalyna',
		'/word/kalyna/__data.json',
		'/api/word/%D0%BA%D0%B0%D0%BB%D0%B8%D0%BD%D0%B0',
		'/api/search?q=kava',
		'/api/gloss?w=kava',
		'/?q=kava'
	]) {
		assert.equal(counted(path), true, path);
	}
});

test('other pages, files and the signed-in features are not', () => {
	for (const path of [
		'/',
		'/about',
		'/common-words/2',
		'/learn',
		'/words',
		'/wordle',
		'/api/report',
		'/api/saved/kava',
		'/api/words/summary',
		'/favicon.svg'
	]) {
		assert.equal(counted(path), false, path);
	}
});

test('a browser is counted by its address, an IPv6 one by its /64', () => {
	assert.deepEqual(limitKey({ address: '203.0.113.7', userAgent: CHROME, asn: 1234 }), {
		kind: 'address',
		key: 'ip:203.0.113.7'
	});
	assert.deepEqual(limitKey({ address: '2a02:8084:1:2:aaaa:bbbb:cccc:dddd', userAgent: CHROME, asn: 1 }), {
		kind: 'address',
		key: 'ip:2a02:8084:1:2'
	});
	assert.deepEqual(limitKey({ address: '203.0.113.7', userAgent: null, asn: undefined }), {
		kind: 'address',
		key: 'ip:203.0.113.7'
	});
});

test('a bot that names itself is counted by that name, from any address', () => {
	const ahrefs = 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)';
	const one = limitKey({ address: '203.0.113.7', userAgent: ahrefs, asn: 1 });
	const two = limitKey({ address: '198.51.100.9', userAgent: ahrefs, asn: 2 });
	assert.deepEqual(one, { kind: 'bot', key: 'bot:ahrefsbot' });
	assert.deepEqual(two, one);

	const names: [string, string][] = [
		['curl/8.4.0', 'bot:curl'],
		['python-requests/2.32.3', 'bot:python-requests'],
		['Scrapy/2.11.0 (+https://scrapy.org)', 'bot:scrapy'],
		['Go-http-client/2.0', 'bot:go-http-client'],
		['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'bot:claudebot'],
		['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot', 'bot:gptbot']
	];
	for (const [agent, key] of names) {
		assert.deepEqual(limitKey({ address: '203.0.113.7', userAgent: agent, asn: 1 }), { kind: 'bot', key }, agent);
	}
});

test('a phone whose make ends in "bot" is a person, counted by address', () => {
	const cubot =
		'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
	assert.deepEqual(limitKey({ address: '203.0.113.7', userAgent: cubot, asn: 1 }), {
		kind: 'address',
		key: 'ip:203.0.113.7'
	});
});

test('Googlebot and bingbot from their own networks are not counted', () => {
	assert.equal(limitKey({ address: '66.249.66.1', userAgent: GOOGLEBOT, asn: 15169 }), null);
	assert.equal(limitKey({ address: '40.77.167.1', userAgent: BINGBOT, asn: 8075 }), null);
});

test('a Googlebot user agent from anywhere else is counted as a bot', () => {
	assert.deepEqual(limitKey({ address: '203.0.113.7', userAgent: GOOGLEBOT, asn: 16509 }), {
		kind: 'bot',
		key: 'bot:googlebot'
	});
	assert.deepEqual(limitKey({ address: '203.0.113.7', userAgent: BINGBOT, asn: undefined })?.kind, 'bot');
});

test('the API is told in JSON to wait a minute', async () => {
	const res = tooMany('/api/search');
	assert.equal(res.status, 429);
	assert.equal(res.headers.get('retry-after'), String(RETRY_AFTER));
	assert.equal(res.headers.get('cache-control'), 'no-store');
	assert.deepEqual(await res.json(), { error: 'too_many' });
});

test('a page is told in one line of text, in both languages', async () => {
	const res = tooMany('/word/kalyna');
	assert.equal(res.status, 429);
	assert.equal(res.headers.get('retry-after'), '60');
	assert.match(res.headers.get('content-type') ?? '', /^text\/plain; charset=utf-8/);
	const text = await res.text();
	assert.match(text, /Too many requests/);
	assert.match(text, /Забагато запитів/);
});
