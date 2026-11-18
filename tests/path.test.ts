// The levelled path (src/lib/path.ts): stage boundaries, inputs left out, a
// placement past the end of the decks, and a stage staying reached. The last
// test checks the coverage thresholds against nebokrai.db.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { coverageTable, milestones } from '../src/lib/coverage.ts';
import {
	STAGE_IDS, STAGE_NEEDS, deckCounts, lessonDone, pathCoverage, pathOf, reachedStages, type PathInput
} from '../src/lib/path.ts';
import { LESSONS, lessonRows } from '../src/lib/practice/lessons.ts';
import type { PointState } from '../src/lib/practice/round.ts';
import { COMMON_DECKS } from '../src/lib/review/decks.ts';
import { DAY, REVIEW, newCard, type ReviewCard } from '../src/lib/review/fsrs.ts';
import { openLocal } from './local-db.ts';

const NOW = Date.UTC(2026, 10, 17);
const ALL_POINTS = [...new Set(LESSONS.flatMap((lesson) => lesson.points))];

/** The lessons, with the first `done` of each group held and the rest new; `placed` placed out. */
function lessons(done: { preposition?: number; government?: number } = {}, placed: string[] = []) {
	const doneIds = new Set<string>();
	for (const group of ['preposition', 'government'] as const) {
		LESSONS.filter((lesson) => lesson.group === group).slice(0, done[group] ?? 0)
			.forEach((lesson) => lesson.points.forEach((id) => doneIds.add(id)));
	}
	const held = (point: { id: string }): PointState => (doneIds.has(point.id) ? 'learning' : 'new');
	return lessonRows(ALL_POINTS, held, new Set(placed));
}

const NOBODY: PathInput = {
	letters: { known: 0, total: 33, skipped: false }, decks: {}, start: 1, lessons: lessons()
};

const deck = (known: number, total: number) => ({ known, total });

test('a newcomer is before the first stage, and the next step is the letters', () => {
	const path = pathOf(NOBODY);
	assert.equal(path.current, null);
	assert.equal(path.next?.stage, 'letters');
	assert.deepEqual([path.next?.criterion.kind, path.next?.criterion.href], ['letters', '/alphabet']);
	assert.ok(path.stages.every((stage) => !stage.reached));
});

test('the letters are reached by knowing them, by skipping them, or by a placement of 500 words or more', () => {
	assert.equal(pathOf({ ...NOBODY, letters: { known: 32, total: 33, skipped: false } }).current, null);
	assert.equal(pathOf({ ...NOBODY, letters: { known: 33, total: 33, skipped: false } }).current, 'letters');
	assert.equal(pathOf({ ...NOBODY, letters: { known: 0, total: 33, skipped: true } }).current, 'letters');
	assert.equal(pathOf({ ...NOBODY, start: 500 }).current, null); // 499 words placed
	assert.equal(pathOf({ ...NOBODY, start: 501 }).current, 'letters');
});

test('stage boundaries: one word or one lesson short is the stage before', () => {
	const letters = { known: 33, total: 33, skipped: false };
	const first: PathInput = { ...NOBODY, letters, decks: { 'common-500': deck(100, 500) }, lessons: lessons({ preposition: 2 }) };
	assert.equal(pathOf(first).current, 'first-words');
	assert.equal(pathOf({ ...first, decks: { 'common-500': deck(99, 500) } }).current, 'letters');
	assert.equal(pathOf({ ...first, lessons: lessons({ preposition: 1 }) }).current, 'letters');

	// Everyday: 60% of common-500 (300 words) and lessons 1–4
	const everyday: PathInput = { ...first, decks: { 'common-500': deck(300, 500) }, lessons: lessons({ preposition: 4 }) };
	assert.equal(pathOf(everyday).current, 'everyday');
	assert.equal(pathOf({ ...everyday, decks: { 'common-500': deck(299, 500) } }).current, 'first-words');

	// Getting around: the first verb lesson as well, and the coverage when it is given
	const around: PathInput = {
		...everyday, decks: { 'common-500': deck(425, 500), 'common-1000': deck(250, 500) },
		lessons: lessons({ preposition: 6, government: 1 }), coverage: 0.75
	};
	assert.equal(pathOf(around).current, 'getting-around');
	assert.equal(pathOf({ ...around, coverage: 0.7499 }).current, 'everyday');
	assert.equal(pathOf({ ...around, lessons: lessons({ preposition: 6 }) }).current, 'everyday');

	// The next step names the stage after and its first criterion not done, with where to go
	const next = pathOf(around).next;
	assert.equal(next?.stage, 'conversations');
	assert.deepEqual([next?.criterion.key, next?.criterion.have, next?.criterion.need], ['common-1000', 250, 400]);
	assert.equal(next?.criterion.href, '/review?deck=common-1000');
});

test('an input left out drops its criteria, and every stage can still be reached', () => {
	const path = pathOf(NOBODY);
	assert.ok(path.stages.every((stage) => stage.criteria.every((c) => c.kind !== 'texts' && c.kind !== 'coverage')));

	const everything: PathInput = {
		letters: { known: 33, total: 33, skipped: false },
		decks: { 'common-500': deck(500, 500), 'common-1000': deck(500, 500), 'common-2000': deck(1000, 1000) },
		start: 1, lessons: lessons({ preposition: 99, government: 99 })
	};
	const all = pathOf(everything);
	assert.equal(all.current, 'reading');
	assert.equal(all.next, null);

	// With the texts given, they count
	const reading = pathOf({ ...everything, texts: [{ level: 1 }, { level: 2 }] });
	assert.equal(reading.current, 'everyday'); // three texts are wanted for Getting around
	assert.equal(pathOf({ ...everything, texts: Array(3).fill({ level: 1 }) }).current, 'getting-around');
	assert.equal(pathOf({ ...everything, texts: Array(3).fill({ level: 3 }) }).current, 'conversations');
	// A harder text counts where an easier one is asked for
	assert.equal(pathOf({ ...everything, texts: Array(3).fill({ level: 4 }) }).current, 'reading');
	// A lesson missing from the database (no sentences) is not asked for
	assert.equal(pathOf({ ...everything, lessons: lessons({ preposition: 99 }).filter((l) => l.group !== 'government') })
		.current, 'reading');
});

test('a placement past the end of the decks counts every deck as had, without cards', () => {
	const prepositions = LESSONS.filter((l) => l.group === 'preposition').map((l) => l.id);
	const verbs = LESSONS.filter((l) => l.group === 'government').map((l) => l.id);
	// Every lesson placed out, prepositions and verbs: past Getting around, to Reading
	const all = pathOf(PathInputPlaced(2001, [...prepositions, ...verbs]));
	const words = all.stages.flatMap((stage) => stage.criteria.filter((c) => c.kind === 'deck'));
	assert.ok(words.every((c) => c.done));
	assert.ok(all.stages.find((s) => s.id === 'letters')!.met);
	assert.equal(all.current, 'reading');
	// With the coverage the placed words give (the commonest 2,000 cover about 90%), still Reading
	assert.equal(pathOf({ ...PathInputPlaced(2001, [...prepositions, ...verbs]), coverage: pathCoverage(0.1, 0.897) })
		.current, 'reading');
	// The first verb lesson placed and not the rest: Getting around, and the next step is the verbs
	const some = pathOf(PathInputPlaced(2001, [...prepositions, verbs[0]]));
	assert.equal(some.current, 'getting-around');
	assert.deepEqual([some.next?.stage, some.next?.criterion.key], ['conversations', 'government:all']);
	// No verb lesson placed: the stages build on each other, so Getting around waits on the first
	const path = pathOf(PathInputPlaced(2001, prepositions));
	assert.equal(path.current, 'everyday');
	assert.deepEqual([path.next?.stage, path.next?.criterion.key], ['getting-around', 'government:1']);

	// Half way through common-1000: the first deck is had, the second half had
	const half = pathOf(PathInputPlaced(751, []));
	const c1000 = half.stages.flatMap((s) => s.criteria).find((c) => c.key === 'common-1000')!;
	assert.equal(c1000.have, 250);
	// Cards begun before the placement still count where they are more
	const more = pathOf({ ...PathInputPlaced(751, []), decks: { 'common-1000': deck(400, 500) } });
	assert.equal(more.stages.flatMap((s) => s.criteria).find((c) => c.key === 'common-1000')!.have, 400);
});

function PathInputPlaced(start: number, placed: string[]): PathInput {
	return { ...NOBODY, start, lessons: lessons({}, placed) };
}

test('a stage once reached stays reached, and the stages before it with it', () => {
	const path = pathOf(NOBODY, ['everyday']);
	assert.equal(path.current, 'everyday');
	assert.deepEqual(path.stages.filter((s) => s.reached).map((s) => s.id), ['letters', 'first-words', 'everyday']);
	assert.ok(!path.stages.find((s) => s.id === 'everyday')!.met); // reached, though no longer met
	assert.deepEqual(reachedStages(path, ['nonsense']), ['letters', 'first-words', 'everyday']);
	assert.deepEqual(reachedStages(pathOf(NOBODY)), []);
});

test('a lesson is done when every rule is being learnt or known, or it was placed out', () => {
	assert.ok(lessonDone({ id: 'x', group: 'preposition', n: 1, points: [{ state: 'learning' }, { state: 'known' }] }));
	assert.ok(!lessonDone({ id: 'x', group: 'preposition', n: 1, points: [{ state: 'known' }, { state: 'weak' }] }));
	assert.ok(lessonDone({ id: 'x', group: 'preposition', n: 1, points: [{ state: 'new' }], placed: true }));
});

test('deck counts take known words as the vocabulary card does', () => {
	const card = (word: string, stability: number): ReviewCard =>
		({ ...newCard(word, NOW - DAY), state: REVIEW, stability, difficulty: 5, reps: 5, last_review: NOW, due: NOW + DAY });
	const cards = new Map([card('не', 30), card('я', 3)].map((c) => [c.word, c]));
	assert.deepEqual(deckCounts(cards, new Map([['common-500', ['не', 'я', 'ти']]]), NOW), { 'common-500': deck(1, 3) });
	assert.equal(pathCoverage(0.5, 0.8), 0.8);
	assert.equal(pathCoverage(0.9), 0.9);
});

test('the coverage thresholds stay below what each stage’s own words cover', { skip: !existsSync('nebokrai.db') && 'nebokrai.db is missing' }, async () => {
	const table = await coverageTable(openLocal('nebokrai.db'));
	// The share each deck is wanted at, by this stage or one before it
	const wanted = new Map<string, number>();
	for (const id of STAGE_IDS) {
		for (const need of STAGE_NEEDS[id]) {
			if (need.kind === 'deck') wanted.set(need.deck, Math.max(wanted.get(need.deck) ?? 0, need.share));
		}
		const coverage = STAGE_NEEDS[id].find((need) => need.kind === 'coverage');
		if (!coverage || coverage.kind !== 'coverage') continue;
		// The words the stage asks for, as if they were the commonest ones
		const words = COMMON_DECKS.reduce((sum, d) => sum + (d.to - d.from + 1) * (wanted.get(d.id) ?? 0), 0);
		const [share] = milestones(table, [Math.round(words)]);
		assert.ok(coverage.share <= share, `${id}: ${coverage.share} > ${share.toFixed(3)} for ${words} words`);
		assert.ok(coverage.share >= share - 0.06, `${id}: ${coverage.share} is far below ${share.toFixed(3)}`);
	}
});
