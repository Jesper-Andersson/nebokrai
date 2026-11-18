// Stories to read (src/lib/texts.ts): how much of a text a learner knows, and
// the rows data/import_stories.py makes.
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY, LEARNING, REVIEW, type CardState, type ReviewCard } from '../src/lib/review/fsrs.ts';
import { tokens } from '../src/lib/sentence.ts';
import { knownShare, listTexts, textBySlug, vocabOf, type Vocab } from '../src/lib/texts.ts';
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

test('texts come easiest first, and every known word is in the vocabulary', { skip }, async () => {
	const texts = await listTexts(openLocal(path));
	for (let i = 1; i < texts.length; i++) {
		const [a, b] = [texts[i - 1], texts[i]];
		assert.ok((a.level ?? Infinity) < (b.level ?? Infinity) ||
			(a.level === b.level && a.tokens <= b.tokens), `${a.slug} before ${b.slug}`);
	}
	for (const t of texts) {
		assert.equal(t.vocab.reduce((n, [, count]) => n + count, 0), t.tokens - t.unknown, t.slug);
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
