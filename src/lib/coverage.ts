// How much of everyday Ukrainian the learner's known words cover: each word
// weighs what it is used, per million words of film and TV subtitles
// (FrequencyWords, through the freq column of nebokrai.db).
//
// The server sends one table, the same for everyone and cached
// (GET /api/coverage); the browser holds the cards and does the sum, so the
// figure follows a review at once and the cards never leave the browser for it.
//
// Counted in dictionary words, as the decks count them: a spelling with two
// entries (мати the verb and мати the noun) is one card and weighs both.
// Names and what is not a word are left out of both sides of the fraction
// (isListWord), and so are grammar cards. The denominator is every ranked
// word, not every word of the subtitles: much of what is said there has no
// entry here (names, slang, misspellings), and counting it would hold even a
// learner who knew every entry to about 61%.
//
// No SvelteKit imports, so tests/coverage.test.ts runs this on the local database.
import { isListWord } from './browse.ts';
import { stateOf } from './practice/round.ts';
import type { ReviewCard } from './review/fsrs.ts';
import type { Db } from './search/db.ts';

export interface CoverageTable {
	/** Spellings, commonest first, in the order of the decks of common words. */
	words: string[];
	/** Uses per million words, beside each spelling, to three significant figures. */
	freq: number[];
	/** Uses per million of every ranked word, those cut from the table included. */
	total: number;
}

/**
 * Words used less than once per million are left out of the table: they are
 * more than half of its rows and about half a percent of the total, which
 * stays in the denominator.
 */
const MIN_FREQ = 1;

/** Three significant figures: 27842.11 is 27800, 1.234 is 1.23. Enough for a percentage. */
function round3(n: number): number {
	return Number(n.toPrecision(3));
}

/** The table, from one query. */
export async function coverageTable(db: Db): Promise<CoverageTable> {
	const rows = await db.all<{ word: string; pos: string; freq: number }>(
		'SELECT word, pos, freq FROM entries WHERE freq_rank IS NOT NULL ORDER BY freq_rank');
	// A Map keeps the order a spelling was first met in: its commonest entry's rank
	const sums = new Map<string, number>();
	let total = 0;
	for (const { word, pos, freq } of rows) {
		if (!isListWord(word, pos)) continue;
		sums.set(word, (sums.get(word) ?? 0) + freq);
		total += freq;
	}
	const words: string[] = [];
	const freq: number[] = [];
	for (const [word, sum] of sums) {
		if (sum < MIN_FREQ) continue;
		words.push(word);
		freq.push(round3(sum));
	}
	return { words, freq, total: Math.round(total) };
}

export interface Coverage {
	/** The share of the total that the known words make up, 0 to 1. */
	known: number;
	/** The same for the words being learnt (and the shaky ones). */
	learning: number;
	/** How many known cards are in the table. */
	knownWords: number;
}

const lookups = new WeakMap<CoverageTable, Map<string, number>>();

function lookup(table: CoverageTable): Map<string, number> {
	let map = lookups.get(table);
	if (!map) {
		map = new Map(table.words.map((word, i) => [word, table.freq[i]]));
		lookups.set(table, map);
	}
	return map;
}

/**
 * The share of the total that the cards cover. A card not in the table (a
 * grammar point, a rare word, a name) adds nothing.
 */
export function coverage(table: CoverageTable, cards: ReadonlyMap<string, ReviewCard>, now: number): Coverage {
	const freqOf = lookup(table);
	let known = 0;
	let learning = 0;
	let knownWords = 0;
	for (const [key, card] of cards) {
		const freq = freqOf.get(key);
		if (freq === undefined) continue;
		const state = stateOf(card, now);
		if (state === 'known') {
			known += freq;
			knownWords += 1;
		} else if (state !== 'new') learning += freq;
	}
	const total = table.total || 1;
	return { known: Math.min(known / total, 1), learning: Math.min(learning / total, 1 - known / total), knownWords };
}

/**
 * The share the commonest `counts` words cover, in the same order: the first
 * 1,000 cover about 80%.
 */
export function milestones(table: CoverageTable, counts: readonly number[]): number[] {
	return counts.map((count) => {
		let sum = 0;
		for (let i = 0; i < Math.min(count, table.freq.length); i++) sum += table.freq[i];
		return table.total ? Math.min(sum / table.total, 1) : 0;
	});
}

/** A share as a whole percent, rounded down: 99.6% is 99, never 100. */
export function percent(share: number): number {
	return Math.floor(share * 100 + 1e-9);
}
