// The learning resources on /resources (src/lib/resources.ts). Needs no
// database, so it also runs in CI.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { messagesFor } from '../src/lib/i18n.ts';
import {
	KINDS, LEVEL_SPANS, RESOURCES, filterResources, kindsIn, lastChecked, levelSpan
} from '../src/lib/resources.ts';

test('every resource is complete', () => {
	const urls = new Set<string>();
	const names = new Set<string>();
	for (const r of RESOURCES) {
		assert.ok(r.name.trim(), `a name for ${r.url}`);
		assert.ok(!names.has(r.name), `${r.name} is listed twice`);
		names.add(r.name);

		const url = new URL(r.url);
		assert.equal(url.protocol, 'https:', `${r.name}: https only`);
		assert.ok(!urls.has(r.url), `${r.url} is listed twice`);
		urls.add(r.url);
		// No affiliate or tracking parameters: the list takes no payment
		assert.doesNotMatch(url.search, /utm_|[?&]ref=|affiliate/i, `${r.name}: a tracking parameter`);

		for (const text of [r.en, r.uk]) {
			assert.ok(text.trim(), `${r.name}: a description in both languages`);
			assert.ok(text.length <= 110, `${r.name}: a description of one line, not ${text.length} characters`);
			assert.match(text, /\.$/, `${r.name}: the description ends with a full stop`);
		}
		assert.match(r.uk, /[а-яіїєґ]/i, `${r.name}: the Ukrainian description is in Ukrainian`);

		assert.ok(KINDS.includes(r.kind), `${r.name}: kind ${r.kind}`);
		// Neighbouring levels only: "beginner and advanced" has no label
		assert.ok(LEVEL_SPANS.includes(levelSpan(r.levels)), `${r.name}: levels ${r.levels.join(', ')}`);
		assert.equal(new Set(r.levels).size, r.levels.length, `${r.name}: a level twice`);

		assert.match(r.checked, /^\d{4}-\d{2}-\d{2}$/, `${r.name}: checked is a day`);
		assert.ok(!Number.isNaN(Date.parse(r.checked)), `${r.name}: checked is a real day`);
	}
});

test('the list is in the order of its kinds', () => {
	const order = RESOURCES.map((r) => KINDS.indexOf(r.kind));
	assert.deepEqual(order, order.toSorted((a, b) => a - b));
});

test('every kind, cost and run of levels has a label in both languages', () => {
	for (const lang of ['en', 'uk'] as const) {
		const r = messagesFor(lang).resources;
		for (const kind of KINDS) {
			assert.ok(r.kinds[kind], `${lang}: kinds.${kind}`);
			assert.ok(r.kind[kind], `${lang}: kind.${kind}`);
		}
		for (const span of LEVEL_SPANS) assert.ok(r.levels[span], `${lang}: levels.${span}`);
		for (const cost of ['free', 'freemium', 'paid'] as const) assert.ok(r.cost[cost], `${lang}: cost.${cost}`);
	}
});

test('counting resources in Ukrainian', () => {
	const { count } = messagesFor('uk').resources;
	assert.equal(count(1, 1), '1 ресурс');
	assert.equal(count(2, 2), '2 ресурси');
	assert.equal(count(5, 5), '5 ресурсів');
	assert.equal(count(11, 11), '11 ресурсів');
	assert.equal(count(21, 21), '21 ресурс');
	assert.equal(count(24, 24), '24 ресурси');
	assert.equal(count(4, 25), '4 з 25');
	assert.equal(messagesFor('en').resources.count(1, 1), '1 resource');
	assert.equal(messagesFor('en').resources.count(25, 25), '25 resources');
	assert.equal(messagesFor('en').resources.count(4, 25), '4 of 25');
});

test('narrowing the list', () => {
	assert.equal(filterResources(RESOURCES, null, '').length, RESOURCES.length);
	assert.equal(filterResources(RESOURCES, null, '   ').length, RESOURCES.length);

	// Neither case nor a stress mark matters
	const names = (kind: Parameters<typeof filterResources>[1], text: string) =>
		filterResources(RESOURCES, kind, text).map((r) => r.name);
	assert.deepEqual(names(null, 'горох'), ['Горох']);
	assert.deepEqual(names(null, 'ГОРО́Х'), ['Горох']);
	assert.ok(names(null, 'forvo').includes('Forvo'));

	// The description counts, in either language, and every word must be there
	assert.ok(names(null, 'native speakers').includes('Forvo'));
	assert.ok(names(null, 'носіями').includes('Forvo'));
	assert.deepEqual(names(null, 'forvo горох'), []);

	// A kind and a word together
	assert.deepEqual(names('dictionary', 'forvo'), []);
	for (const r of filterResources(RESOURCES, 'dictionary', '')) assert.equal(r.kind, 'dictionary');

	for (const kind of kindsIn(RESOURCES)) assert.ok(filterResources(RESOURCES, kind, '').length > 0);
});

test('levels and the review date', () => {
	assert.equal(levelSpan(['intermediate', 'beginner']), 'beginner-intermediate');
	assert.equal(levelSpan(['advanced']), 'advanced');
	assert.equal(lastChecked(RESOURCES), RESOURCES.map((r) => r.checked).sort().at(-1));
});
