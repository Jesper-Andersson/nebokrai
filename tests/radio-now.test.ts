// The song a station is playing (src/lib/radio-now.ts). No station is rung
// up: the streams and lists here are made by hand, so it also runs in CI.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { icyTitle, nowPlaying, parseStreamTitle, playlistTitle, tidyTitle } from '../src/lib/radio-now.ts';
import { STATIONS, stationById } from '../src/lib/radio.ts';

const promin = stationById('promin')!;
const bayraktar = stationById('bayraktar')!;

/**
 * A stream as a station sends it: `interval` bytes of sound, the text block
 * (a length byte, then the text padded with zeros to a multiple of 16), and
 * more sound without end. `step` is how many bytes arrive at a time.
 */
function stream(text: string, interval = 100, step = 37): Response {
	const words = new TextEncoder().encode(text);
	const blocks = Math.ceil(words.length / 16);
	const head = new Uint8Array(interval + 1 + blocks * 16).fill(0xaa, 0, interval);
	head[interval] = blocks;
	head.fill(0, interval + 1);
	head.set(words, interval + 1);
	let sent = 0;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			// After the block, sound for ever: the reader must stop by itself
			if (sent >= head.length) controller.enqueue(new Uint8Array(step).fill(0xaa));
			else controller.enqueue(head.slice(sent, (sent += step)));
		}
	});
	return new Response(body, { headers: { 'icy-metaint': String(interval) } });
}

test('the title in a block of stream text', () => {
	assert.equal(parseStreamTitle("StreamTitle='PRIANA - Молода';"), 'PRIANA - Молода');
	assert.equal(parseStreamTitle("StreamTitle='PRIANA - Молода';\0\0\0\0"), 'PRIANA - Молода');
	// An apostrophe in the title does not end it; the next field does
	assert.equal(parseStreamTitle("StreamTitle='The Offspring - You're Gonna Go Far, Kid';StreamUrl='';"), "The Offspring - You're Gonna Go Far, Kid");
	assert.equal(parseStreamTitle("StreamTitle='Океан Ельзи - Обійми';StreamUrl='https://example.org/a';"), 'Океан Ельзи - Обійми');
	// Speech: the field is there and empty
	assert.equal(parseStreamTitle("StreamTitle='';"), '');
	assert.equal(parseStreamTitle(''), null);
	assert.equal(parseStreamTitle('no title here'), null);
});

test('reading the first title out of a stream', async () => {
	assert.equal(await icyTitle(stream("StreamTitle='Mad Heads - Молода кров';")), 'Mad Heads - Молода кров');
	// However the bytes are cut up on the way: one at a time, or all at once
	assert.equal(await icyTitle(stream("StreamTitle='SEMMAR - Богота';", 100, 1)), 'SEMMAR - Богота');
	assert.equal(await icyTitle(stream("StreamTitle='SEMMAR - Богота';", 100, 5000)), 'SEMMAR - Богота');
	// The stations' own interval
	assert.equal(await icyTitle(stream("StreamTitle='PRIANA - Молода';", 16000, 1400)), 'PRIANA - Молода');
	assert.equal(await icyTitle(stream("StreamTitle='';")), '');
	// A block of no length: nothing has changed since the last one
	assert.equal(await icyTitle(stream('')), null);
});

test('a stream that does not offer titles is let go of', async () => {
	let cancelled = false;
	const body = new ReadableStream<Uint8Array>({
		pull: (controller) => controller.enqueue(new Uint8Array(64)),
		cancel: () => void (cancelled = true)
	});
	assert.equal(await icyTitle(new Response(body)), null);
	assert.ok(cancelled, 'the connection was dropped');

	// A station that claims megabytes between titles is not read to find out
	assert.equal(await icyTitle(new Response(new Uint8Array(8), { headers: { 'icy-metaint': '50000000' } })), null);
	assert.equal(await icyTitle(new Response(new Uint8Array(8), { headers: { 'icy-metaint': 'soon' } })), null);
	// The stream ends before its first title
	assert.equal(await icyTitle(new Response(new Uint8Array(40), { headers: { 'icy-metaint': '100' } })), null);
});

test("the newest song in a station's own list", () => {
	// 18:09:00 in Kyiv on a winter day (UTC+2)
	const now = new Date('2026-11-12T16:09:00Z');
	const list = [
		{ stime: '18:07:03', time: '18:07', singer: 'Антитіла', song: 'Ok', cover: 'https://example.org/1.jpg' },
		{ stime: '18:04:25', time: '18:04', singer: 'Енджі Крейда', song: 'Хто Ти', cover: '' }
	];
	assert.equal(playlistTitle(list, now), 'Антитіла - Ok');
	// News or adverts since: the list still shows the last song, and it is over
	assert.equal(playlistTitle(list, new Date('2026-11-12T16:30:00Z')), null);
	// Across midnight in Kyiv: began 23:58, asked 00:03
	assert.equal(playlistTitle([{ stime: '23:58:10', singer: 'ДахаБраха', song: 'Баба' }], new Date('2026-11-12T22:03:00Z')), 'ДахаБраха - Баба');
	// Summer time is Kyiv's too (UTC+3)
	assert.equal(playlistTitle([{ stime: '12:00:00', singer: 'Jamala', song: '1944' }], new Date('2026-07-01T09:02:00Z')), 'Jamala - 1944');

	assert.equal(playlistTitle([{ stime: '18:07:03', singer: '', song: 'Ok' }], now), 'Ok');
	assert.equal(playlistTitle([{ singer: 'Антитіла', song: 'Ok' }], now), 'Антитіла - Ok', 'no time: taken as it is');
	for (const not of [[], null, 'text', { singer: 'x' }, [null], [{ stime: '18:07:03' }], [{ singer: 5, song: {} }]]) {
		assert.equal(playlistTitle(not, now), null, JSON.stringify(not));
	}
});

test('a title fit to show', () => {
	assert.equal(tidyTitle('  PRIANA  -  Молода \r\n', promin), 'PRIANA - Молода');
	assert.equal(tidyTitle('Mad\u0000 Heads\u0007 - Молода кров', promin), 'Mad Heads - Молода кров');
	// Between songs
	for (const nothing of [null, '', '   ', ' - ', '—', promin.name, promin.name.toUpperCase()]) {
		assert.equal(tidyTitle(nothing, promin), null, JSON.stringify(nothing));
	}
	// The station where the artist goes: only the rest is kept
	const nashe = stationById('nashe')!;
	const nakypilo = stationById('nakypilo')!;
	assert.equal(tidyTitle('Наше Радіо - Знай наших!', nashe), 'Знай наших!');
	assert.equal(tidyTitle('Радіо «Накипіло» - «Накипіло» з Тетяною Федорковою', nakypilo), '«Накипіло» з Тетяною Федорковою');
	assert.equal(tidyTitle('Наше Радіо - Наше Радіо', nashe), null);
	assert.equal(tidyTitle('Радіо «Накипіло»', nakypilo), null);
	// Another station's name is an artist like any other
	assert.equal(tidyTitle('Наше Радіо - Знай наших!', promin), 'Наше Радіо - Знай наших!');

	const long = tidyTitle('а'.repeat(400), promin)!;
	assert.equal(long.length, 150);
	assert.ok(long.endsWith('…'));
});

test('asking a station: the stream for most, its own list for the two that have one', async () => {
	const asked: { url: string; icy: string | null }[] = [];
	const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		asked.push({ url, icy: new Headers(init?.headers).get('icy-metadata') });
		if (url === promin.url) return stream("StreamTitle='PRIANA - Молода';");
		if (url === bayraktar.playlist) return Response.json([{ stime: '18:07:03', singer: 'Антитіла', song: 'Ok' }]);
		return new Response('gone', { status: 404 });
	}) as typeof fetch;
	const now = new Date('2026-11-12T16:09:00Z');

	assert.equal(await nowPlaying(promin, fetcher, now), 'PRIANA - Молода');
	assert.deepEqual(asked.pop(), { url: promin.url, icy: '1' });

	assert.equal(await nowPlaying(bayraktar, fetcher, now), 'Антитіла - Ok');
	assert.deepEqual(asked.pop(), { url: bayraktar.playlist, icy: null });

	// A station that refuses, one that fails, and one that sends something else: no title, no error
	assert.equal(await nowPlaying(stationById('nakypilo')!, fetcher, now), null);
	const broken = (async () => {
		throw new TypeError('fetch failed');
	}) as typeof fetch;
	assert.equal(await nowPlaying(promin, broken, now), null);
	const html = (async () => new Response('<html>busy</html>')) as typeof fetch;
	assert.equal(await nowPlaying(bayraktar, html, now), null);
	assert.equal(await nowPlaying(promin, html, now), null);
});

test("a station's own list is asked over https", () => {
	for (const s of STATIONS) {
		if (s.playlist) assert.equal(new URL(s.playlist).protocol, 'https:', `${s.name}: ${s.playlist}`);
	}
});
