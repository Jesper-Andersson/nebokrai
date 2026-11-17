// Sentences left out by hand (data/excluded-sentences.tsv) must not reach the site.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { openLocal } from './local-db.ts';

const GROUPS = new Set(['russia', 'ukraine-war', 'soviet', 'politicians', 'faith-people', 'extremism', 'other']);

/** The listed ids, read the way import_wiktionary.excluded_sentences reads them. */
function listed(): number[] {
	const ids: number[] = [];
	const lines = readFileSync('data/excluded-sentences.tsv', 'utf8').split('\n');
	lines.forEach((line, n) => {
		if (!line.trim() || line.startsWith('#')) return;
		const cols = line.split('\t');
		assert.equal(cols.length, 3, `line ${n + 1}: want id, group and reason`);
		assert.match(cols[0], /^\d+$/, `line ${n + 1}: the id`);
		assert.ok(GROUPS.has(cols[1]), `line ${n + 1}: unknown group ${cols[1]}`);
		assert.ok(cols[2].trim(), `line ${n + 1}: the reason`);
		ids.push(Number(cols[0]));
	});
	return ids;
}

test('the excluded list is well formed', () => {
	const ids = listed();
	// The sentence that started the list: Putin thanking Russians, on the дякувати grammar card
	assert.ok(ids.includes(3950344));
	assert.equal(new Set(ids).size, ids.length, 'an id is listed twice');
});

const skip = existsSync('nebokrai.db') ? false : 'nebokrai.db is missing';

test('no excluded sentence is shown as an example or in grammar practice', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const ids = JSON.stringify(listed());
	for (const table of ['examples', 'cloze']) {
		const rows = await db.all<{ tatoeba_id: number }>(
			`SELECT DISTINCT tatoeba_id FROM ${table} WHERE tatoeba_id IN (SELECT value FROM json_each(?))`,
			[ids]
		);
		assert.deepEqual(rows.map((r) => r.tatoeba_id), [], `${table} still holds excluded sentences`);
	}
});
