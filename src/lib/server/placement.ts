// The placement test's data: the words it draws from, the made-up words, and
// the grammar sentences. The rules are in ../placement.ts; this file only
// reads the databases. No SvelteKit imports, so tests/placement.test.ts runs
// it on the local files.
import { commonRange } from '../browse.ts';
import { MAX_GAPS, drawGaps, pointCounts } from '../practice/gaps.ts';
import type { Gap, Random } from '../practice/round.ts';
import {
	PSEUDO_COUNT, TEST_WORDS, drawWords, grammarAsks, scoreWords, type WordAnswer, type WordScore
} from '../placement.ts';
import type { Db } from '../search/db.ts';

/** The made-up words as the build left them (meta.placement_pseudo), or none in a database built before. */
export async function pseudoWords(db: Db): Promise<string[]> {
	const rows = await db.all<{ value: string }>("SELECT value FROM meta WHERE key = 'placement_pseudo'");
	try {
		const words: unknown = JSON.parse(rows[0]?.value ?? '[]');
		return Array.isArray(words) ? words.filter((word): word is string => typeof word === 'string') : [];
	} catch {
		return [];
	}
}

/**
 * The made-up words VESUM does not know. Some are real words the dictionary
 * lacks (вужчий, сальний), and a learner who knows one is right to say so.
 * Asked here, when the test is served, so nothing from VESUM is ever written
 * into nebokrai.db; without VESUM every one is kept.
 */
export async function unknownToVesum(words: readonly string[], vesum: Db | undefined): Promise<string[]> {
	if (!vesum || !words.length) return [...words];
	const found = await vesum.all<{ form: string }>(
		'SELECT DISTINCT form FROM vesum_forms WHERE form IN (SELECT value FROM json_each(?))', [JSON.stringify(words)]);
	const real = new Set(found.map((row) => row.form));
	return words.filter((word) => !real.has(word));
}

export interface PlacementTest {
	/** Part 1: 80 words, real and made up, shuffled. */
	words: string[];
	/** Part 2: for each lesson, in order (prepositions, then verbs' patterns), its sentences to choose a form for. */
	grammar: { lesson: string; gaps: Gap[] }[];
}

/** A new test, or null when there are not enough made-up words to tell a guess from a word known. */
export async function drawTest(db: Db, vesum: Db | undefined, random: Random): Promise<PlacementTest | null> {
	const pseudo = await unknownToVesum(await pseudoWords(db), vesum);
	if (pseudo.length < PSEUDO_COUNT) return null;
	const words = drawWords(await commonRange(db, 1, TEST_WORDS), pseudo, random);

	const counts = await pointCounts(db);
	const asks = grammarAsks(Object.keys(counts).filter((point) => counts[point] > 0), random);
	// More than one /api/practice call holds (MAX_GAPS), so drawn in turns of it,
	// never two sentences alike within a turn
	const points = asks.flatMap((ask) => ask.points);
	const gaps: Gap[] = [];
	for (let i = 0; i < points.length; i += MAX_GAPS) gaps.push(...await drawGaps(db, points.slice(i, i + MAX_GAPS), random));
	// Gaps come back in the order asked, one for each rule that had a sentence
	let at = 0;
	const grammar = asks.map(({ lesson, points }) => {
		const mine: Gap[] = [];
		for (const point of points) if (gaps[at]?.point === point) mine.push(gaps[at++]);
		return { lesson, gaps: mine };
	}).filter((lesson) => lesson.gaps.length);
	return { words, grammar };
}

/** Score part 1 against the database: a word's place among the commonest spellings, and the made-up words. */
export async function scoreTest(db: Db, answers: readonly WordAnswer[]): Promise<WordScore> {
	const common = await commonRange(db, 1, TEST_WORDS);
	const placeOf = new Map(common.map((word, i) => [word, i + 1]));
	// Every made-up word counts as one here, VESUM or not: it was offered as made up
	const pseudo = new Set(await pseudoWords(db));
	return scoreWords(answers, (word) => placeOf.get(word), (word) => pseudo.has(word) && !placeOf.has(word));
}
