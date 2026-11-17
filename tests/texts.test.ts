// Stories to read (src/lib/texts.ts): how much of a text a learner knows, the
// band rule, and the rows data/import_stories.py makes.
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY, LEARNING, REVIEW, type CardState, type ReviewCard } from '../src/lib/review/fsrs.ts';
import { tokens } from '../src/lib/sentence.ts';
import { BANDS, bandOf, knownShare, listTexts, textBySlug, vocabOf, type Vocab } from '../src/lib/texts.ts';
import { openLocal } from './local-db.ts';

const NOW = Date.UTC(2026, 10, 17);

function card(word: string, stability: number, state: CardState = REVIEW): ReviewCard {
	return {
		word, due: NOW + stability * DAY, stability, difficulty: 5, state, step: 0, reps: 5, lapses: 0,
		added_at: NOW - 100 * DAY, last_review: NOW
	};
}

test('vocabOf counts the words of a text by what they may be', () => {
	const vocab = vocabOf([
		[['вода', 'водити'], ['бути'], []],
		[['вода', 'водити'], ['кіт']]
	]);
	assert.deepEqual(vocab, [[['вода', 'водити'], 2], [['бути'], 1], [['кіт'], 1]]);
});

test('knownShare counts a word as known when one of its entries is known', () => {
	const vocab: Vocab = [[['вода', 'водити'], 2], [['бути'], 1], [['кіт'], 1]];
	const cards = new Map([
		['водити', card('водити', 30)],
		['бути', card('бути', 5)], // still being learnt: not counted
		['кіт', card('кіт', 30, LEARNING)]
	]);
	assert.equal(knownShare(vocab, cards, NOW), 0.5);
	assert.equal(knownShare(vocab, new Map(), NOW), 0);
	assert.equal(knownShare([], cards, NOW), 0);
});

test('bandOf picks the smallest band that covers 95% of the known words', () => {
	// Each word once, so no topic words
	const once = (ranks: (number | null)[]) => ranks.map((r): [number | null, number] => [r, 1]);
	assert.equal(bandOf([]), null);
	assert.equal(bandOf(once(Array(20).fill(10))), 500);
	// 19 of 20 within 1000 is 95% exactly
	assert.equal(bandOf(once([...Array(19).fill(900), 6000])), 1000);
	assert.equal(bandOf(once([...Array(18).fill(100), 4000, 4000])), 5000);
	assert.equal(bandOf(once([...Array(18).fill(100), null, null])), null);
	assert.deepEqual([...BANDS], [500, 1000, 2000, 5000]);
});

test('bandOf leaves out topic words: rare words the story has three times or more', () => {
	// 17 common words, and віслюк (rank 8000) six times: the story teaches it
	const story: [number | null, number][] = [[50, 10], [300, 7], [8000, 6]];
	assert.equal(bandOf(story), 500);
	// Twice is not a topic: 2 of 19 outside every band
	assert.equal(bandOf([[50, 10], [300, 7], [8000, 2]]), null);
	// An unranked word repeated is a topic word too
	assert.equal(bandOf([[50, 20], [null, 4]]), 500);
	// A repeated word is set aside only for a band it lies outside: within 1000 it counts
	assert.equal(bandOf([[900, 19], [3000, 1]]), 1000);
	// Set aside for 500 (17 of 18), counted for 2000 (20 of 21)
	assert.equal(bandOf([[100, 17], [1500, 3], [9000, 1]]), 2000);
});

const path = 'nebokrai.db';
function hasTexts() {
	if (!existsSync(path)) return false;
	const sqlite = new DatabaseSync(path, { readOnly: true });
	const found = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name = 'texts'").all().length > 0;
	sqlite.close();
	return found;
}
const skip = hasTexts() ? false : 'nebokrai.db is missing, or has no texts (run data/import_stories.py)';

test('only CC BY stories, each with its credits and link', { skip }, async () => {
	const texts = await listTexts(openLocal(path));
	assert.ok(texts.length >= 20, `${texts.length} texts`);
	for (const t of texts) {
		assert.match(t.licence, /^CC BY \d\.\d$/, t.slug);
		assert.match(t.licence_url, /^https:\/\/creativecommons\.org\/licenses\/by\/\d\.\d\/$/, t.slug);
		assert.ok(t.credits.length > 0 && t.credits.every((c) => c.role && c.name), t.slug);
		assert.ok(t.credits.some((c) => c.role === 'Read by'), `${t.slug} names who reads it`);
		assert.match(t.url, /^https:\/\//);
		assert.ok(t.vocab.length > 0, t.slug);
	}
	assert.equal(new Set(texts.map((t) => t.slug)).size, texts.length);
});

test('each text is in the band its words give', { skip }, async () => {
	const db = openLocal(path);
	const rank = new Map(
		(await db.all<{ word: string; rank: number }>(
			'SELECT word, MIN(freq_rank) AS rank FROM entries WHERE freq_rank IS NOT NULL GROUP BY word'
		)).map((r) => [r.word, r.rank])
	);
	for (const t of await listTexts(db)) {
		const words = t.vocab.map(([lemmas, count]): [number | null, number] => {
			const known = lemmas.map((w) => rank.get(w)).filter((r) => r !== undefined);
			return [known.length ? Math.min(...known) : null, count];
		});
		assert.equal(t.band, bandOf(words), t.slug);
		assert.equal(words.reduce((n, [, count]) => n + count, 0), t.tokens - t.unknown, t.slug);
		const edge = t.band ?? 5000;
		const topic = words.filter(([r, count]) => count >= 3 && !(r !== null && r <= edge));
		assert.equal(t.topic, topic.reduce((n, [, count]) => n + count, 0), t.slug);
	}
});

test('every text has its pages, recordings and a lemma list for every word', { skip }, async () => {
	const db = openLocal(path);
	for (const { slug } of await listTexts(db)) {
		const text = await textBySlug(db, slug);
		assert.ok(text, slug);
		assert.equal(text.contents.length, text.pages, slug);
		assert.equal(text.contents[0].page, 1, slug);
		let words = 0;
		for (const page of text.contents) {
			assert.equal(page.audio, `/audio/texts/${slug}/${String(page.page).padStart(2, '0')}.mp3`);
			assert.ok(page.sentences.length > 0, `${slug} page ${page.page}`);
			for (const s of page.sentences) {
				assert.equal(s.uk.normalize('NFC').replaceAll('́', ''), s.uk_source.normalize('NFC'));
				assert.equal(tokens(s.uk).filter((t) => t.word).length, s.lemmas.length, s.uk);
				words += s.lemmas.length;
			}
		}
		assert.equal(words, text.tokens, slug);
	}
	assert.equal(await textBySlug(db, 'no-such-story'), null);
	assert.equal(await textBySlug(db, '../texts'), null);
});
