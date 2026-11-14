// The learning resources on /resources (src/lib/resources.ts). Needs no
// database, so it also runs in CI.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { messagesFor } from '../src/lib/i18n.ts';
import {
	KINDS, LEVEL_SPANS, ORDERS, PRICES, RESOURCES, byKind, byLevel, byPrice, kindsIn, lastChecked, levelSpan
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

		// Saved into the project, never loaded from the resource's own site
		assert.ok(existsSync(new URL(`../src/lib/assets/${r.logo}`, import.meta.url)), `${r.name}: icon ${r.logo}`);

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
		for (const price of PRICES) assert.ok(r.prices[price], `${lang}: prices.${price}`);
		for (const order of ORDERS) assert.ok(r.orders[order], `${lang}: orders.${order}`);
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

test('the price filter', () => {
	assert.equal(byPrice(RESOURCES, 'any').length, RESOURCES.length);
	// Free + paid is under both: usable without paying, and selling something
	assert.ok(byPrice(RESOURCES, 'free').every((r) => r.cost !== 'paid'));
	assert.ok(byPrice(RESOURCES, 'paid').every((r) => r.cost !== 'free'));
	const freemium = RESOURCES.filter((r) => r.cost === 'freemium').map((r) => r.name);
	for (const price of ['free', 'paid'] as const) {
		const names = byPrice(RESOURCES, price).map((r) => r.name);
		for (const name of freemium) assert.ok(names.includes(name), `${name} under ${price}`);
	}
});

test('sorting by level', () => {
	const before = RESOURCES.map((r) => r.name);
	const easiest = byLevel(RESOURCES, 'easiest');
	const hardest = byLevel(RESOURCES, 'hardest');
	assert.equal(easiest.length, RESOURCES.length);
	assert.equal(easiest[0].levels.join(), 'beginner');
	assert.equal(hardest[0].levels.join(), 'advanced');
	assert.deepEqual(hardest.at(-1)?.levels, ['beginner']);

	// Within the dictionaries: every level first, then intermediate and up, then advanced only
	const dictionaries = (list: typeof RESOURCES) => list.filter((r) => r.kind === 'dictionary').map((r) => r.name);
	const order = dictionaries(easiest);
	assert.ok(order.indexOf('Горох') < order.indexOf('ГРАК'));
	assert.ok(order.indexOf('Wiktionary') < order.indexOf('Горох'));

	// Equals keep their hand-made order
	const allLevels = RESOURCES.filter((r) => r.levels.length === 3).map((r) => r.name);
	assert.deepEqual(easiest.filter((r) => r.levels.length === 3).map((r) => r.name), allLevels);
	assert.deepEqual(RESOURCES.map((r) => r.name), before, 'the list itself is not sorted in place');
});

test('grouping by kind', () => {
	const groups = byKind(RESOURCES);
	assert.deepEqual(groups.map((g) => g.kind), kindsIn(RESOURCES));
	assert.equal(groups.reduce((n, g) => n + g.items.length, 0), RESOURCES.length);
	for (const g of groups) assert.ok(g.items.every((r) => r.kind === g.kind));
	// A price choice that empties a kind drops its heading
	for (const g of byKind(byPrice(RESOURCES, 'paid'))) assert.ok(g.items.length > 0);
});

test('levels and the review date', () => {
	assert.equal(levelSpan(['intermediate', 'beginner']), 'beginner-intermediate');
	assert.equal(levelSpan(['advanced']), 'advanced');
	assert.equal(lastChecked(RESOURCES), RESOURCES.map((r) => r.checked).sort().at(-1));
});
