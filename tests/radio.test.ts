// The radio's stations (src/lib/radio.ts). Needs no database, so it also runs
// in CI. It does not ring the stations up: whether a stream answers today is
// checked by hand, and the day is written in `checked`.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { messagesFor } from '../src/lib/i18n.ts';
import { KINDS, RADIO_ORIGINS, STATIONS, neighbour, stationById } from '../src/lib/radio.ts';

test('every station is complete', () => {
	const ids = new Set<string>();
	const urls = new Set<string>();
	for (const s of STATIONS) {
		// The id is kept in the visitor's browser and never shown
		assert.match(s.id, /^[a-z][a-z0-9-]*$/, `${s.name}: id ${s.id}`);
		assert.ok(!ids.has(s.id), `${s.id} is listed twice`);
		ids.add(s.id);
		assert.ok(s.name.trim(), `a name for ${s.id}`);

		const url = new URL(s.url);
		// A page served over https may not play sound fetched over http
		assert.equal(url.protocol, 'https:', `${s.name}: https only`);
		// A stream address with a token in it stops working when the token does
		assert.equal(url.search, '', `${s.name}: no parameters in the stream address`);
		assert.ok(!urls.has(s.url), `${s.url} is listed twice`);
		urls.add(s.url);
		assert.equal(new URL(s.home).protocol, 'https:', `${s.name}: its site over https`);

		for (const text of [s.en, s.uk]) {
			assert.ok(text.trim(), `${s.name}: a description in both languages`);
			assert.ok(text.length <= 70, `${s.name}: a description of one line, not ${text.length} characters`);
			assert.match(text, /\.$/, `${s.name}: the description ends with a full stop`);
		}
		assert.match(s.uk, /[а-яіїєґ]/i, `${s.name}: the Ukrainian description is in Ukrainian`);

		assert.ok(KINDS.includes(s.kind), `${s.name}: kind ${s.kind}`);
		assert.match(s.checked, /^\d{4}-\d{2}-\d{2}$/, `${s.name}: checked is a day`);
		assert.ok(!Number.isNaN(Date.parse(s.checked)), `${s.name}: checked is a real day`);
	}
});

test('the list is in the order of its kinds, and every kind has a label and a station', () => {
	const order = STATIONS.map((s) => KINDS.indexOf(s.kind));
	assert.deepEqual(order, order.toSorted((a, b) => a - b));
	for (const kind of KINDS) {
		assert.ok(STATIONS.some((s) => s.kind === kind), `a station of kind ${kind}`);
		for (const lang of ['en', 'uk'] as const) assert.ok(messagesFor(lang).radio.kinds[kind], `${lang}: kinds.${kind}`);
	}
});

test('the page may load every stream, and nothing more', () => {
	// vite.config.ts puts these in the Content-Security-Policy's media-src
	for (const s of STATIONS) {
		assert.ok(RADIO_ORIGINS.includes(new URL(s.url).origin as (typeof RADIO_ORIGINS)[number]), `${s.name}: ${s.url}`);
	}
	assert.equal(new Set(RADIO_ORIGINS).size, RADIO_ORIGINS.length, 'an origin twice');
	for (const origin of RADIO_ORIGINS) {
		// A host, and a port where the station serves on one (Армія FM, on 8443): no path, no wildcard
		assert.match(origin, /^https:\/\/[a-z0-9.-]+(:\d+)?$/, `${origin}: a plain https origin`);
		assert.ok(STATIONS.some((s) => s.url.startsWith(origin + '/')), `${origin}: no station uses it`);
	}
});

test('finding a station, and the one next to it', () => {
	const first = STATIONS[0];
	const last = STATIONS.at(-1)!;
	assert.equal(stationById(first.id), first);
	assert.equal(stationById('no-such-station'), undefined);
	assert.equal(stationById(null), undefined);

	assert.equal(neighbour(first.id, 1), STATIONS[1]);
	assert.equal(neighbour(STATIONS[1].id, -1), first);
	// Round at both ends
	assert.equal(neighbour(last.id, 1), first);
	assert.equal(neighbour(first.id, -1), last);
	// An id from an older list, still in someone's browser
	assert.equal(neighbour('no-such-station', 1), first);
});
