// The placement test (src/lib/placement.ts and src/lib/server/placement.ts):
// scoring, drawing the words and the grammar, and the made-up words. The
// last tests need nebokrai.db, and vesum.db for the VESUM check.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { commonRange } from '../src/lib/browse.ts';
import {
	BANDS, GRAMMAR_ITEMS, ITEMS_PER_LESSON, MAX_START, PLACEMENT_LESSONS, PSEUDO_COUNT, TEST_WORDS, WORDS_PER_BAND, WORD_ITEMS,
	bandOf, drawWords, grammarAsks, placeLessons, scoreWords, sizeRange, type WordAnswer
} from '../src/lib/placement.ts';
import { pointCounts } from '../src/lib/practice/gaps.ts';
import { drawTest, pseudoWords, scoreTest, unknownToVesum } from '../src/lib/server/placement.ts';
import { openLocal } from './local-db.ts';

/** Chance a test can repeat: a small generator (mulberry32) from a seed. */
function seeded(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// A made-up list of 5,000 spellings, w1 … w5000, and 30 made-up words
const COMMON = Array.from({ length: TEST_WORDS }, (_, i) => `w${i + 1}`);
const PSEUDO = Array.from({ length: 30 }, (_, i) => `p${i}`);
const placeOf = (word: string) => (word.startsWith('w') ? Number(word.slice(1)) : undefined);
const isPseudo = (word: string) => word.startsWith('p');

/** Answers to a drawn test: yes to real words up to `knows`, and to made-up words `falseYes` of them. */
function answer(words: string[], knows: number, falseYes = 0): WordAnswer[] {
	let made = 0;
	return words.map((word) => {
		if (isPseudo(word)) return { word, yes: made++ < falseYes };
		return { word, yes: placeOf(word)! <= knows };
	});
}

test('part 1 draws 12 words from each band and 20 made-up words, shuffled', () => {
	const words = drawWords(COMMON, PSEUDO, seeded(1));
	assert.equal(words.length, WORD_ITEMS);
	assert.equal(new Set(words).size, WORD_ITEMS);
	assert.equal(words.filter(isPseudo).length, PSEUDO_COUNT);
	for (const [i, band] of BANDS.entries()) {
		const inBand = words.filter((w) => !isPseudo(w) && bandOf(placeOf(w)!) === i);
		assert.equal(inBand.length, WORDS_PER_BAND, `${band.from}–${band.to}`);
	}
	// Shuffled: the made-up words are not all at the end
	assert.ok(words.slice(0, 40).some(isPseudo));
	assert.notDeepEqual(drawWords(COMMON, PSEUDO, seeded(2)), words);
	assert.deepEqual([bandOf(1), bandOf(500), bandOf(501), bandOf(5000), bandOf(5001)], [0, 0, 1, 4, -1]);
});

test('scoring: a beginner starts at 1, an advanced learner at 2,001, saying yes to everything places nowhere', () => {
	const words = drawWords(COMMON, PSEUDO, seeded(3));

	const beginner = scoreWords(answer(words, 0), placeOf, isPseudo);
	assert.deepEqual([beginner.start, beginner.size, beginner.reliable], [1, 0, true]);

	const advanced = scoreWords(answer(words, 5000), placeOf, isPseudo);
	assert.deepEqual([advanced.start, advanced.size, advanced.reliable], [MAX_START, 5000, true]);
	assert.equal(MAX_START, 2001);

	// Knows the first thousand: starts at 1,001, about 1,000 words
	const middle = scoreWords(answer(words, 1000), placeOf, isPseudo);
	assert.deepEqual([middle.start, middle.size], [1001, 1000]);

	const yesToAll = scoreWords(words.map((word) => ({ word, yes: true })), placeOf, isPseudo);
	assert.deepEqual([yesToAll.reliable, yesToAll.start, yesToAll.size], [false, 1, 0]);
	assert.deepEqual(yesToAll.pseudo, { asked: 20, yes: 20 });
});

test('false alarms are taken off each band, and over 40% of them is not reliable', () => {
	const words = drawWords(COMMON, PSEUDO, seeded(4));
	// Knows 1,000 and says yes to 4 made-up words of 20 (f = 0.2): the first two
	// bands stay at 1 = (1 − 0.2) / 0.8, the third is 0, not 0.2
	const some = scoreWords(answer(words, 1000, 4), placeOf, isPseudo);
	assert.deepEqual(some.bands.map((b) => Number(b.known.toFixed(3))), [1, 1, 0, 0, 0]);
	assert.equal(some.start, 1001);
	assert.ok(scoreWords(answer(words, 1000, 8), placeOf, isPseudo).reliable); // f = 0.4
	assert.ok(!scoreWords(answer(words, 1000, 9), placeOf, isPseudo).reliable); // f = 0.45

	// A band under 80% after the correction is where the learner starts
	const half = scoreWords(answer(words, 750), placeOf, isPseudo);
	assert.equal(half.start, 501);
	// Too few made-up words answered to tell
	const fewPseudo = answer(words, 1000).filter((a) => !isPseudo(a.word)).concat(PSEUDO.slice(0, 9).map((word) => ({ word, yes: false })));
	assert.ok(!scoreWords(fewPseudo, placeOf, isPseudo).reliable);
	// A word answered twice counts once, and one in no band not at all
	const twice = scoreWords([{ word: 'w1', yes: true }, { word: 'w1', yes: false }, { word: 'w9999', yes: true }], placeOf, isPseudo);
	assert.deepEqual([twice.bands[0].asked, twice.bands[0].yes], [1, 1]);
	assert.deepEqual(sizeRange(1240), { from: 1001, to: 2000 });
	assert.equal(sizeRange(0), null);
});

test('part 2 asks two rules of each preposition lesson and one of each verbs’ lesson, 28 in all', () => {
	const offered = PLACEMENT_LESSONS.flatMap((lesson) => lesson.points);
	const asks = grammarAsks(offered, seeded(5));
	assert.equal(asks.length, 19);
	assert.equal(asks.flatMap((a) => a.points).length, GRAMMAR_ITEMS);
	assert.equal(GRAMMAR_ITEMS, 28);
	assert.deepEqual(asks.map((a) => a.lesson), PLACEMENT_LESSONS.map((l) => l.id));
	// The prepositions first, then the verbs
	assert.deepEqual([asks[8].lesson, asks[9].lesson], ['above-below', 'gov-na-acc']);
	for (const ask of asks) {
		const lesson = PLACEMENT_LESSONS.find((l) => l.id === ask.lesson)!;
		assert.ok(ask.points.every((p) => lesson.points.includes(p)));
		assert.equal(ask.points.length, ITEMS_PER_LESSON[lesson.group]);
		// Two rules where the lesson has two; its only one twice
		assert.equal(new Set(ask.points).size, Math.min(ITEMS_PER_LESSON[lesson.group], lesson.points.length));
	}
	// A lesson without sentences is left out
	assert.ok(!grammarAsks(offered.filter((p) => p !== 'who-acc'), seeded(5)).some((a) => a.lesson === 'who-whom'));

	const r = (lesson: string, ...right: boolean[]) => ({ lesson, right });
	assert.deepEqual(placeLessons([r('where', true, true), r('where-to', true, false), r('who-whom', true, true)]),
		{ placed: ['where', 'who-whom'], stopped: [] });
	// Two failed lessons in a row stop that group; the verbs are still asked, one right item placing a lesson
	assert.deepEqual(placeLessons([
		r('where', true, true), r('where-to', false, true), r('who-whom', false, false), r('numbers', true, true),
		r('gov-na-acc', true), r('gov-ins', false), r('gov-gen', true)
	]), { placed: ['where', 'gov-na-acc', 'gov-gen'], stopped: ['preposition'] });
	assert.deepEqual(placeLessons([r('gov-na-acc', false), r('gov-ins', false)]).stopped, ['government']);
	// A preposition lesson still being answered: one right is not yet a pass or a fail
	assert.deepEqual(placeLessons([r('where', true)]), { placed: [], stopped: [] });
	// A lesson not in the test is ignored
	assert.deepEqual(placeLessons([r('made-up', true, true)]), { placed: [], stopped: [] });
});

const skipDb = !existsSync('nebokrai.db') && 'nebokrai.db is missing';

test('the made-up words are no form or search key of the dictionary, and most survive VESUM', { skip: skipDb }, async () => {
	const db = openLocal('nebokrai.db');
	const pseudo = await pseudoWords(db);
	assert.ok(pseudo.length >= 250 && pseudo.length <= 300, `${pseudo.length} made-up words`);
	const json = JSON.stringify(pseudo);
	assert.deepEqual(await db.all('SELECT DISTINCT plain FROM forms WHERE plain IN (SELECT value FROM json_each(?))', [json]), []);
	assert.deepEqual(await db.all('SELECT DISTINCT key FROM search_keys WHERE key IN (SELECT value FROM json_each(?))', [json]), []);
	// None is among the common words the test asks for
	const common = new Set(await commonRange(db, 1, TEST_WORDS));
	assert.ok(pseudo.every((word) => !common.has(word)));
	if (existsSync('vesum.db')) {
		const kept = await unknownToVesum(pseudo, openLocal('vesum.db'));
		assert.ok(kept.length >= pseudo.length * 0.9, `${kept.length} of ${pseudo.length} survive VESUM`);
	}
	assert.deepEqual(await unknownToVesum(pseudo, undefined), pseudo);
});

test('a test drawn from the database, and scored against it', { skip: skipDb }, async () => {
	const db = openLocal('nebokrai.db');
	const vesum = existsSync('vesum.db') ? openLocal('vesum.db') : undefined;
	const drawn = await drawTest(db, vesum, seeded(6));
	assert.ok(drawn);
	assert.equal(drawn.words.length, WORD_ITEMS);

	// Every lesson that has sentences, prepositions then verbs, with its own number of sentences of its own rules
	const counts = await pointCounts(db);
	const withSentences = PLACEMENT_LESSONS.filter((l) => l.points.some((p) => counts[p] > 0));
	assert.deepEqual(drawn.grammar.map((g) => g.lesson), withSentences.map((l) => l.id));
	assert.equal(drawn.grammar.flatMap((g) => g.gaps).length, GRAMMAR_ITEMS);
	// A verb's sentence marks its verb
	assert.ok(drawn.grammar.filter((g) => g.lesson.startsWith('gov-')).every((g) => g.gaps[0].cue_length! > 0));
	for (const { lesson, gaps } of drawn.grammar) {
		const { points, group } = PLACEMENT_LESSONS.find((l) => l.id === lesson)!;
		assert.equal(gaps.length, ITEMS_PER_LESSON[group], lesson);
		// Each is answered by choice: among forms, or for a who item between its two nouns
		assert.ok(gaps.every((gap) => points.includes(gap.point) && (gap.choices.length > 1 || gap.kind === 'who')), lesson);
	}

	// Scored on the real places: knowing the first 1,000 starts at 1,001
	const common = await commonRange(db, 1, TEST_WORDS);
	const place = new Map(common.map((w, i) => [w, i + 1]));
	const knows = (n: number) => drawn.words.map((word) => ({ word, yes: (place.get(word) ?? Infinity) <= n }));
	assert.deepEqual([(await scoreTest(db, knows(0))).start, (await scoreTest(db, knows(1000))).start], [1, 1001]);
	const all = await scoreTest(db, knows(5000));
	assert.deepEqual([all.start, all.reliable, all.pseudo.asked], [MAX_START, true, PSEUDO_COUNT]);
});
