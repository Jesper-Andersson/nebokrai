// The alphabet trainer (src/lib/alphabet/): the letters, checking an answer,
// and the drill. Needs no data, except the last test, which looks the example
// words up in nebokrai.db.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { checkLetter, checkWord, checkWritten, misreading, reading, wordPattern } from '../src/lib/alphabet/answers.ts';
import {
	DEFAULT_OPTIONS, MIN_WORDS, ROUND, type Options, type Prompt, type Random,
	answerOf, byChoice, choices, finished, grade, isRight, knownAmong, newRound, next, parseOptions, parseProgress, poolFor,
	readable, stateOf
} from '../src/lib/alphabet/drill.ts';
import { APOSTROPHE, GROUP_IDS, LETTERS, isSign, letterInfo, lettersOf, pair } from '../src/lib/alphabet/letters.ts';
import { ALPHABET } from '../src/lib/browse.ts';
import { nationalTranslit } from '../src/lib/search/normalize.ts';
import { openLocal } from './local-db.ts';

/** Chance a test can repeat: a small generator (mulberry32) from a seed. */
function seeded(seed: number): Random {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const letter = (item: string): Prompt => ({ kind: 'letter', item });
const word = (item: string): Prompt => ({ kind: 'word', item });
const ALL: Options = { ...DEFAULT_OPTIONS, groups: [...GROUP_IDS] };
// Commonest first, as the site's list is; some need letters of later groups
const WORDS = ['так', 'там', 'мама', 'тато', 'око', 'тема', 'і', 'вода', 'він', 'ресторан', 'день', "п'ять", 'щастя'];

test('the letters are the alphabet in its order, then the apostrophe', () => {
	assert.deepEqual(LETTERS.slice(0, 33).map((l) => l.letter), ALPHABET);
	assert.equal(LETTERS.length, 34);
	assert.equal(LETTERS[33].letter, APOSTROPHE);
	assert.equal(pair('ж'), 'Ж ж');
	assert.equal(pair(APOSTROPHE), "'");
});

test('every letter is in one group, and the groups come to all of them', () => {
	const grouped = GROUP_IDS.flatMap((id) => lettersOf([id]));
	assert.equal(grouped.length, LETTERS.length);
	assert.equal(new Set(grouped).size, LETTERS.length);
	assert.deepEqual(lettersOf(['same']), [...'аеікмот']);
	assert.deepEqual(lettersOf(['signs']), ['ь', APOSTROPHE]);
	// Whatever order the groups are given in, the letters keep the alphabet's
	assert.deepEqual(lettersOf(['hushing', 'same']), [...'аежікмотцчшщ']);
});

test('the Latin of a letter is the national transliteration', () => {
	for (const { letter: l, latin, accept, confusable } of LETTERS) {
		if (isSign(l)) {
			assert.deepEqual(accept, [], l);
			continue;
		}
		// At the start of a word, and after another letter (є: ye, then ie)
		assert.equal(latin, nationalTranslit(l), l);
		assert.ok(accept.includes(latin), l);
		assert.ok(accept.includes(nationalTranslit('а' + l).slice(1)), l);
		for (const other of confusable) assert.ok(letterInfo(other) && other !== l, `${l}: ${other}`);
	}
	assert.deepEqual(LETTERS.filter((l) => isSign(l.letter)).map((l) => l.letter), ['ь', APOSTROPHE]);
});

test('a typed letter is taken leniently, except where the letter is the lesson', () => {
	assert.ok(checkLetter('ж', 'zh') && checkLetter('ж', ' ZH '));
	assert.ok(checkLetter('є', 'ye') && checkLetter('є', 'ie') && checkLetter('є', 'je'));
	assert.ok(checkLetter('щ', 'shch') && checkLetter('щ', 'sch'));
	assert.ok(checkLetter('й', 'y') && checkLetter('й', 'j'));
	// г is h and ґ is g: the pair is what is being learnt
	assert.ok(checkLetter('г', 'h') && !checkLetter('г', 'g'));
	assert.ok(checkLetter('ґ', 'g') && !checkLetter('ґ', 'h'));
	for (const wrong of ['', 'z', 'zhh', 'ж']) assert.ok(!checkLetter('ж', wrong), wrong);
	// A sign has no Latin to type
	assert.ok(!checkLetter('ь', '') && !checkLetter('ь', "'"));

	assert.ok(checkWritten('ж', 'ж') && checkWritten('ж', 'Ж ') && !checkWritten('ж', 'з') && !checkWritten('ж', 'zh'));
});

test('a typed word is taken letter by letter', () => {
	assert.equal(reading('вода'), 'voda');
	for (const w of WORDS) assert.ok(checkWord(w, reading(w)), w);
	assert.ok(checkWord('щастя', 'shchastia') && checkWord('щастя', 'schastya') && checkWord('щастя', 'Shchastja'));
	// The apostrophe and the soft sign may be typed or left out
	assert.ok(checkWord("п'ять", 'piat') && checkWord("п'ять", "p'iat'") && checkWord("п'ять", 'p’yat'));
	assert.ok(checkWord('день', 'den') && checkWord('день', "den'"));
	assert.ok(!checkWord('вода', 'boda') && !checkWord('вода', 'vod') && !checkWord('вода', 'vodaa'));
	assert.ok(!checkWord('гора', 'gora') && checkWord('гора', 'hora'));
	// The stress mark of a headword does not matter
	assert.equal(wordPattern('ма́ма').source, wordPattern('мама').source);
});

test('a word is misread by the look of its letters', () => {
	assert.equal(misreading('ресторан'), 'pectopah');
	assert.equal(misreading('вода'), 'boda');
	assert.equal(misreading('мама'), null);
});

test('the words that can be read with the letters chosen', () => {
	// і is a bare letter; вода needs в and д
	assert.deepEqual(readable(WORDS, lettersOf(['same'])), ['так', 'там', 'мама', 'тато', 'око', 'тема']);
	assert.ok(readable(WORDS, lettersOf(['same', 'false-friends'])).includes('він'));
	assert.ok(!readable(WORDS, lettersOf(['same', 'false-friends'])).includes('вода'));
	// ресторан has all its letters in the first two groups, and one letter too many
	assert.deepEqual(readable(WORDS, lettersOf(GROUP_IDS)), WORDS.filter((w) => w !== 'і' && w !== 'ресторан'));
});

test('what the choices come to', () => {
	const same: Options = { ...DEFAULT_OPTIONS, groups: ['same'] };
	assert.deepEqual(poolFor(same, WORDS), { letters: [...'аеікмот'], words: [] });
	assert.deepEqual(poolFor({ ...same, content: 'words' }, WORDS).letters, []);
	assert.equal(poolFor({ ...same, content: 'both' }, WORDS).words.length, 6);
	assert.equal(poolFor({ ...same, content: 'both' }, WORDS).letters.length, 7);
	// Too few words to choose among: the letters are asked instead
	assert.ok(MIN_WORDS > 2);
	assert.deepEqual(poolFor({ ...same, content: 'words' }, ['так', 'там']), { letters: [...'аеікмот'], words: [] });
	// Words are not written, and a sign has no Latin to be shown
	assert.deepEqual(poolFor({ ...ALL, groups: ['same', 'signs'], direction: 'write', content: 'both' }, WORDS),
		{ letters: [...'аеікмот'], words: [] });
	assert.ok(byChoice(letter('ж'), ALL) && !byChoice(letter('ж'), { ...ALL, answer: 'type' }));
	assert.ok(byChoice(letter('ь'), { ...ALL, answer: 'type' }) && !byChoice(word('день'), { ...ALL, answer: 'type' }));
});

test('an answer is judged by how it was given', () => {
	const typing: Options = { ...ALL, answer: 'type' };
	// A choice is the letter itself, or the word's reading
	assert.ok(isRight(letter('ж'), ALL, 'ж') && !isRight(letter('ж'), ALL, 'zh') && !isRight(letter('ж'), ALL, 'ш'));
	assert.ok(isRight(word('вода'), ALL, 'voda') && !isRight(word('вода'), ALL, 'boda'));
	// Typed: Latin for what is read, the letter for what is written
	assert.ok(isRight(letter('ж'), typing, 'ZH') && !isRight(letter('ж'), typing, 'ж'));
	assert.ok(isRight(letter('ж'), { ...typing, direction: 'write' }, 'Ж') && !isRight(letter('ж'), { ...typing, direction: 'write' }, 'zh'));
	assert.ok(isRight(word('щастя'), typing, 'schastya') && !isRight(word('щастя'), typing, 'shastya'));
	// A sign is chosen even where the rest is typed
	assert.ok(isRight(letter('ь'), typing, 'ь') && !isRight(letter('ь'), typing, "'"));
});

test('four answers are offered, the right one among them, no two alike', () => {
	const random = seeded(1);
	const pool = poolFor({ ...ALL, content: 'both' }, WORDS);
	for (const { letter: l } of LETTERS) {
		for (const direction of ['read', 'write'] as const) {
			if (direction === 'write' && isSign(l)) continue;
			const offered = choices(letter(l), direction, pool, random);
			assert.equal(offered.length, 4, l);
			assert.ok(offered.includes(answerOf(letter(l))), l);
			const printed = offered.map((o) => (direction === 'read' && letterInfo(o)!.latin) || o);
			assert.equal(new Set(printed).size, 4, `${l}: ${printed}`);
			// A sign is offered only beside a sign
			if (!isSign(l)) assert.ok(!offered.some(isSign), l);
			// и and й are both "y": one is never the wrong answer to the other
			if (direction === 'write') assert.ok(!offered.some((o) => o !== l && letterInfo(o)!.latin === letterInfo(l)!.latin), l);
		}
	}
	// The letters a letter is taken for come first: в beside б, which it looks like
	assert.ok(choices(letter('в'), 'read', pool, random).includes('б'));

	const offered = choices(word('вода'), 'read', pool, random);
	assert.equal(offered.length, 4);
	assert.ok(offered.includes('voda') && offered.includes('boda'));
	assert.equal(new Set(offered).size, 4);
	// Nothing to tell apart from: fewer than four, and still the answer
	assert.deepEqual(choices(word('мама'), 'read', { letters: [], words: ['мама'] }, random), ['mama']);
});

test('a round asks nothing twice running and brings a miss back', () => {
	const random = seeded(7);
	const pool = poolFor({ ...ALL, groups: ['same', 'false-friends'], content: 'both' }, WORDS);
	let round = newRound();
	let progress = parseProgress(null);
	let before: Prompt | null = null;
	const asked: Prompt[] = [];
	while (!finished(round)) {
		const prompt = next(round, pool, progress, random);
		assert.ok(!before || before.kind !== prompt.kind || before.item !== prompt.item, 'asked twice running');
		assert.ok(prompt.kind === 'letter' ? pool.letters.includes(prompt.item) : pool.words.includes(prompt.item));
		asked.push(prompt);
		// The fourth prompt is missed, the rest answered rightly
		({ round, progress } = grade(round, progress, prompt, asked.length !== 4));
		before = prompt;
	}
	assert.equal(asked.length, ROUND);
	assert.deepEqual(asked[6], asked[3], 'the miss comes back after two other prompts');
	assert.deepEqual([round.right, round.wrong, round.best, round.streak], [ROUND - 1, 1, ROUND - 4, ROUND - 4]);
	assert.deepEqual(round.missed, [asked[3]]);
	assert.deepEqual(round.again, []);
	assert.ok(asked.some((p) => p.kind === 'word') && asked.some((p) => p.kind === 'letter'));
});

test('one letter alone is asked again and again', () => {
	const pool = { letters: ['а'], words: [] };
	let round = newRound();
	for (let i = 0; i < 3; i++) {
		assert.deepEqual(next(round, pool, {}, seeded(i)), letter('а'));
		round = grade(round, {}, letter('а'), true).round;
	}
});

test('a weak letter is asked oftener than a known one', () => {
	const random = seeded(3);
	const progress = { а: { box: 4, seen: 9, right: 9 }, е: { box: 4, seen: 9, right: 9 }, о: { box: 0, seen: 3, right: 0 } };
	const counts: Record<string, number> = { а: 0, е: 0, о: 0 };
	// Each asked from a fresh round, so "not twice running" does not even them out
	for (let i = 0; i < 600; i++) counts[next(newRound(), { letters: ['а', 'е', 'о'], words: [] }, progress, random).item] += 1;
	assert.ok(counts.о > counts.а * 4 && counts.о > counts.е * 4, JSON.stringify(counts));
	assert.ok(counts.а > 0 && counts.е > 0);
});

test('a right answer moves a letter up a box, a wrong one down two', () => {
	let progress = parseProgress(null);
	let round = newRound();
	const give = (prompt: Prompt, correct: boolean) => ({ round, progress } = grade(round, progress, prompt, correct));
	assert.equal(stateOf(progress['ж']), 'new');
	give(letter('ж'), true);
	assert.deepEqual(progress['ж'], { box: 1, seen: 1, right: 1 });
	assert.equal(stateOf(progress['ж']), 'learning');
	give(letter('ж'), true);
	give(letter('ж'), true);
	assert.equal(stateOf(progress['ж']), 'known');
	assert.equal(knownAmong(progress, ['ж', 'ш']), 1);
	for (let i = 0; i < 5; i++) give(letter('ж'), true);
	assert.equal(progress['ж'].box, 4);
	give(letter('ж'), false);
	assert.deepEqual(progress['ж'], { box: 2, seen: 9, right: 8 });
	give(letter('ж'), false);
	give(letter('ж'), false);
	assert.equal(progress['ж'].box, 0);
	// A word read wrongly does not say which letter was at fault
	const marks = progress;
	give(word('жінка'), false);
	assert.equal(progress, marks);
	assert.deepEqual(round.missed, [letter('ж'), word('жінка')]);
});

test('choices and progress from storage are read defensively', () => {
	assert.deepEqual(parseOptions({ groups: ['signs', 'nope', 'same'], answer: 'type', direction: 'write', content: 'both', sound: false }),
		{ groups: ['same', 'signs'], answer: 'type', direction: 'write', content: 'both', sound: false });
	assert.deepEqual(parseOptions({ groups: [], answer: 'sing', sound: 'yes' }), DEFAULT_OPTIONS);
	for (const bad of [null, 'x', 7, []]) assert.deepEqual(parseOptions(bad), DEFAULT_OPTIONS);

	assert.deepEqual(
		parseProgress({
			ж: { box: 3, seen: 5, right: 4 }, ш: { box: 9, seen: 2, right: 7 }, я: { box: -1, seen: 1.5 }, q: { box: 1, seen: 1, right: 1 },
			а: 'known', б: { box: 2, seen: 0, right: 0 }
		}),
		{ ж: { box: 3, seen: 5, right: 4 }, ш: { box: 4, seen: 2, right: 2 } });
	for (const bad of [null, 'x', 7]) assert.deepEqual(parseProgress(bad), {});
});

test('every example word is in the dictionary', { skip: !existsSync('nebokrai.db') && 'nebokrai.db is missing' }, async () => {
	const db = openLocal('nebokrai.db');
	const found = await db.all<{ word: string }>(
		'SELECT DISTINCT word FROM entries WHERE word IN (SELECT value FROM json_each(?))',
		[JSON.stringify(LETTERS.map((l) => l.example))]);
	const have = new Set(found.map((row) => row.word));
	for (const { letter: l, example } of LETTERS) {
		assert.ok(have.has(example), example);
		assert.ok(example.includes(l), `${example} has no ${l}`);
	}
});
