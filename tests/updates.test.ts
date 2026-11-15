// The entries on /updates (src/lib/updates.ts). Needs no database, so it
// also runs in CI.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { messagesFor } from '../src/lib/i18n.ts';
import { BODY_MAX, KINDS, TITLE_MAX, UPDATES, byMonth, hasUnseen, latestId } from '../src/lib/updates.ts';

test('every update is complete', () => {
	const ids = new Set<string>();
	// A day of slack: an entry dated today here may be read by CI in an earlier time zone
	const latestDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	for (const u of UPDATES) {
		assert.match(u.date, /^\d{4}-\d{2}-\d{2}$/, `${u.id}: date is a day`);
		assert.ok(!Number.isNaN(Date.parse(u.date)), `${u.id}: date is a real day`);
		assert.ok(u.date <= latestDay, `${u.id}: dated in the future`);

		assert.match(u.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/, `${u.id}: a date and a short name`);
		assert.ok(u.id.startsWith(`${u.date}-`), `${u.id}: begins with its own date`);
		assert.ok(!ids.has(u.id), `${u.id} is listed twice`);
		ids.add(u.id);

		assert.ok(KINDS.includes(u.kind), `${u.id}: kind ${u.kind}`);
		// The round-up takes its heading from the interface strings; everything else names itself
		assert.equal(Boolean(u.title), u.kind !== 'fixes', `${u.id}: a title unless it is the round-up`);

		if (u.title) {
			for (const text of [u.title.en, u.title.uk]) {
				assert.ok(text.trim(), `${u.id}: a title in both languages`);
				assert.ok(text.length <= TITLE_MAX, `${u.id}: a title of ${text.length} characters, over ${TITLE_MAX}`);
				assert.doesNotMatch(text, /\.$/, `${u.id}: a title has no full stop`);
				assert.doesNotMatch(text, /#\d+/, `${u.id}: no pull request numbers`);
			}
			assert.match(u.title.uk, /[а-яіїєґ]/i, `${u.id}: the Ukrainian title is in Ukrainian`);
		}

		for (const text of [u.body.en, u.body.uk]) {
			assert.ok(text.trim(), `${u.id}: a body in both languages`);
			assert.ok(text.length <= BODY_MAX, `${u.id}: a body of ${text.length} characters, over ${BODY_MAX}`);
			assert.match(text, /\.$/, `${u.id}: the body ends with a full stop`);
			assert.doesNotMatch(text, /#\d+/, `${u.id}: no pull request numbers`);
		}
		assert.match(u.body.uk, /[а-яіїєґ]/i, `${u.id}: the Ukrainian body is in Ukrainian`);

		if (u.href !== undefined) {
			assert.match(u.href, /^\/[a-z0-9/-]*$/, `${u.id}: href is a path on this site`);
			const route = new URL(`../src/routes${u.href}/+page.svelte`, import.meta.url);
			assert.ok(existsSync(route), `${u.id}: no page at ${u.href}`);
			// The link is named after its page (routes/updates/+page.svelte)
			for (const lang of ['en', 'uk'] as const) {
				const titles: Record<string, string> = messagesFor(lang).pageTitle;
				assert.ok(titles[u.href.slice(1)], `${u.id}: ${lang} has no page title for ${u.href}`);
			}
		}
	}
});

test('the list is newest first', () => {
	const dates = UPDATES.map((u) => u.date);
	assert.deepEqual(dates, dates.toSorted().reverse());
});

test('one round-up of fixes a month at most', () => {
	for (const { month, items } of byMonth()) {
		assert.ok(items.filter((u) => u.kind === 'fixes').length <= 1, `${month}: two round-ups`);
	}
});

test('grouping by month', () => {
	const list = [
		{ id: '2026-12-02-b', date: '2026-12-02', kind: 'new' as const, body: { en: '.', uk: '.' } },
		{ id: '2026-12-01-a', date: '2026-12-01', kind: 'new' as const, body: { en: '.', uk: '.' } },
		{ id: '2026-11-30-z', date: '2026-11-30', kind: 'new' as const, body: { en: '.', uk: '.' } }
	];
	assert.deepEqual(byMonth(list).map((g) => [g.month, g.items.length]), [['2026-12', 2], ['2026-11', 1]]);
	assert.equal(byMonth().reduce((n, g) => n + g.items.length, 0), UPDATES.length);
});

test('what counts as unseen', () => {
	const list = [
		{ id: '2026-12-02-b', date: '2026-12-02', kind: 'new' as const, body: { en: '.', uk: '.' } },
		{ id: '2026-12-02-z', date: '2026-12-02', kind: 'new' as const, body: { en: '.', uk: '.' } },
		{ id: '2026-11-30-a', date: '2026-11-30', kind: 'new' as const, body: { en: '.', uk: '.' } }
	];
	assert.equal(latestId(list), '2026-12-02-b');
	// A first visit: nothing to catch up on
	assert.equal(hasUnseen('', list), false);
	assert.equal(hasUnseen('2026-12-02-b', list), false);
	// Same day, and later in the alphabet, yet older: position decides
	assert.equal(hasUnseen('2026-12-02-z', list), true);
	assert.equal(hasUnseen('2026-11-30-a', list), true);
	// An id that has left the list falls back to its date
	assert.equal(hasUnseen('2026-11-01-gone', list), true);
	assert.equal(hasUnseen('2026-12-02-gone', list), false);
	assert.equal(hasUnseen('nonsense', list), false);
	assert.equal(hasUnseen('2026-12-02-b', []), false);
});
