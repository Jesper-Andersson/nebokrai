// The word of the day (src/lib/word-of-day.ts). The choice of rank needs no
// database; the entry itself needs nebokrai.db in the repo root.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { rankForDay, today, wordOfDay } from '../src/lib/word-of-day.ts';
import { openLocal } from './local-db.ts';

const skip = !existsSync('nebokrai.db') && 'nebokrai.db is missing';

test('the rank for a day', () => {
	const day = today(Date.UTC(2026, 10, 12));
	assert.equal(day, 20769);
	assert.equal(today(Date.UTC(2026, 10, 12, 23, 59)), day); // the same word until midnight UTC
	assert.equal(rankForDay(day), rankForDay(day)); // and for everyone

	// Sixteen years of days: every rank in range, and none of them twice
	const ranks = new Set<number>();
	for (let d = day; d < day + 5701; d++) {
		const rank = rankForDay(d);
		assert.ok(rank >= 300 && rank <= 6000, `rank ${rank}`);
		ranks.add(rank);
	}
	assert.equal(ranks.size, 5701);
	// Tomorrow's word is not the next one down the frequency list
	assert.ok(Math.abs(rankForDay(day + 1) - rankForDay(day)) > 100);
});

test('the entry for a day', { skip }, async () => {
	const db = openLocal('nebokrai.db');
	const day = today(Date.UTC(2026, 10, 12));
	const entry = await wordOfDay(db, day);
	assert.ok(entry);
	assert.deepEqual(await wordOfDay(db, day), entry);
	assert.ok(['noun', 'verb', 'adj', 'adv'].includes(entry.pos));
	assert.ok(entry.freq_rank !== null && entry.freq_rank >= rankForDay(day));
	assert.ok(entry.senses.length >= 1 && entry.senses.length <= 3);
	assert.ok(entry.example.uk && entry.example.en && entry.example.tatoeba_id);

	// A month of words: all different, and none a word to keep off the front page
	const rude = ['vulgar', 'offensive', 'derogatory', 'slang'];
	const words = new Set<string>();
	for (let d = day; d < day + 30; d++) {
		const found = await wordOfDay(db, d);
		assert.ok(found);
		words.add(found.word);
		const all = await db.all<{ tags: string }>(
			`SELECT s.tags FROM senses s JOIN entries e ON e.id = s.entry_id
			 WHERE e.word = ? AND e.freq_rank = ?`, [found.word, found.freq_rank]);
		for (const { tags } of all) assert.ok(!rude.some((tag) => tags.includes(`"${tag}"`)), found.word);
	}
	assert.equal(words.size, 30);
});
