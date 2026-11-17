// The placement test: about five minutes that say where a learner who knows
// some Ukrainian already should start. It moves starting points only (the
// first common word new cards come from, and lessons marked "placed out"); it
// never makes a card.
//
// Part 1 is 80 words, one at a time, "I know it" or "Not sure": 12 real words
// from each of five bands of the commonest spellings (the order the decks of
// common words use, browse.ts), and 20 made-up words that look like real ones
// (data/import_wiktionary.py, add_placement_pseudo). Saying yes to a made-up
// word is a false alarm; the hit rate of each band is corrected by it, as in
// yes/no vocabulary tests (Meara and Buxton 1987), so a learner who says yes to
// everything is placed nowhere.
//
// Part 2 is two grammar items for each lesson about cases after prepositions,
// in the lessons' order, as multiple choice (the gaps of /api/practice). A
// lesson is placed out when both are right; the part stops after two failed
// lessons in a row.
//
// Pure: GET and POST /api/placement draw and score with it, and the browser
// works out the lessons placed out with it. No SvelteKit imports.
import { LESSONS } from './practice/lessons.ts';
import type { Random } from './practice/round.ts';
import { COMMON_DECKS } from './review/decks.ts';

/** The bands of commonest spellings words are drawn from, by place (from 1). */
export const BANDS = [
	{ from: 1, to: 500 },
	{ from: 501, to: 1000 },
	{ from: 1001, to: 2000 },
	{ from: 2001, to: 3000 },
	{ from: 3001, to: 5000 }
] as const;
/** How many common spellings the test reads: the end of the last band. */
export const TEST_WORDS = BANDS[BANDS.length - 1].to;
export const WORDS_PER_BAND = 12;
export const PSEUDO_COUNT = 20;
/** Real and made-up words together: 80. */
export const WORD_ITEMS = BANDS.length * WORDS_PER_BAND + PSEUDO_COUNT;

/** A band counts as known when its corrected hit rate is at least this. */
export const KNOWN_SHARE = 0.8;
/** Above this share of yes to made-up words the result is not to be trusted, and nothing is placed. */
export const MAX_FALSE_ALARMS = 0.4;
/** Fewer made-up words answered than this, and the false alarms cannot be measured. */
export const MIN_PSEUDO_ANSWERS = 10;
/**
 * The furthest start: one past the end of the decks of common words. A start
 * past 2,000 means every deck is had; bigger decks are a change of their own.
 */
export const MAX_START = COMMON_DECKS[COMMON_DECKS.length - 1].to + 1;

/** The lessons part 2 asks about, in order: the cases after prepositions, nine of them. */
export const PLACEMENT_LESSONS = LESSONS.filter((lesson) => lesson.group === 'preposition');
export const ITEMS_PER_LESSON = 2;

function shuffled<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

const sample = <T>(items: readonly T[], count: number, random: Random): T[] =>
	shuffled(items, random).slice(0, count);

/** The band of a place among the commonest spellings, by index into BANDS, or -1 past them. */
export const bandOf = (place: number): number => BANDS.findIndex((band) => place >= band.from && place <= band.to);

/**
 * The words of part 1, shuffled. `common` are the commonest spellings in
 * order (place 1 first), at least TEST_WORDS of them; `pseudo` the made-up
 * words that may be asked, already checked against every dictionary at hand.
 */
export function drawWords(common: readonly string[], pseudo: readonly string[], random: Random): string[] {
	const real = BANDS.flatMap((band) => sample(common.slice(band.from - 1, band.to), WORDS_PER_BAND, random));
	const madeUp = sample(pseudo.filter((word) => !real.includes(word)), PSEUDO_COUNT, random);
	return shuffled([...real, ...madeUp], random);
}

export interface WordAnswer {
	word: string;
	/** "I know it". */
	yes: boolean;
}

export interface BandScore {
	from: number;
	to: number;
	asked: number;
	yes: number;
	/** The hit rate corrected for false alarms, 0 to 1. */
	known: number;
}

export interface WordScore {
	bands: BandScore[];
	/** Made-up words asked, and how many had a yes. */
	pseudo: { asked: number; yes: number };
	/** Words estimated known among the commonest 5,000, rounded to tens. */
	size: number;
	/** The place new common words should start from: 1 to MAX_START; 1 when not reliable. */
	start: number;
	/** False when too many made-up words had a yes, or too few were answered to tell. */
	reliable: boolean;
}

/**
 * Score part 1. `placeOf` gives a real word's place among the commonest
 * spellings; `isPseudo` says a word is made up. An answer for a word that is
 * neither, or for a word answered already, is left out.
 *
 * With h the share of yes in a band and f the share of yes to made-up words,
 * the band's known share is max(0, (h − f) / (1 − f)); the size is the sum of
 * each band's share times its width, and the start is the first place of the
 * first band under KNOWN_SHARE.
 */
export function scoreWords(
	answers: readonly WordAnswer[], placeOf: (word: string) => number | undefined, isPseudo: (word: string) => boolean
): WordScore {
	const counts = BANDS.map(() => ({ asked: 0, yes: 0 }));
	const pseudo = { asked: 0, yes: 0 };
	const seen = new Set<string>();
	for (const { word, yes } of answers) {
		if (seen.has(word)) continue;
		seen.add(word);
		if (isPseudo(word)) {
			pseudo.asked += 1;
			if (yes) pseudo.yes += 1;
			continue;
		}
		const band = bandOf(placeOf(word) ?? 0);
		if (band < 0) continue;
		counts[band].asked += 1;
		if (yes) counts[band].yes += 1;
	}
	const f = pseudo.asked ? pseudo.yes / pseudo.asked : 0;
	const reliable = pseudo.asked >= MIN_PSEUDO_ANSWERS && f <= MAX_FALSE_ALARMS;
	const bands = BANDS.map(({ from, to }, i) => {
		const { asked, yes } = counts[i];
		const h = asked ? yes / asked : 0;
		return { from, to, asked, yes, known: f < 1 ? Math.max(0, (h - f) / (1 - f)) : 0 };
	});
	const size = Math.round(bands.reduce((sum, band) => sum + band.known * (band.to - band.from + 1), 0) / 10) * 10;
	const short = bands.find((band) => band.known < KNOWN_SHARE);
	const start = reliable ? Math.min(short ? short.from : TEST_WORDS + 1, MAX_START) : 1;
	return { bands, pseudo, size: reliable ? size : 0, start, reliable };
}

/** A size as the range of the band it falls in, for the result: 1,240 is 1,001–2,000. Below 1, null. */
export function sizeRange(size: number): { from: number; to: number } | null {
	if (size < 1) return null;
	const band = BANDS.find((b) => size <= b.to) ?? BANDS[BANDS.length - 1];
	return { from: band.from, to: band.to };
}

// --- Part 2 ---

/** One lesson of part 2: the rules to ask, one sentence each. */
export interface GrammarAsk {
	lesson: string;
	points: string[];
}

/**
 * The rules part 2 asks, two for each placement lesson that has sentences
 * (`offered`, the rules that do), in the lessons' order: two of its rules drawn
 * at random, or its one rule twice. 18 in all, within one /api/practice call.
 */
export function grammarAsks(offered: readonly string[], random: Random): GrammarAsk[] {
	return PLACEMENT_LESSONS.flatMap((lesson) => {
		const points = lesson.points.filter((id) => offered.includes(id));
		if (!points.length) return [];
		const drawn = points.length === 1 ? [points[0], points[0]] : sample(points, ITEMS_PER_LESSON, random);
		return [{ lesson: lesson.id, points: drawn }];
	});
}

/** A lesson of part 2 as answered: one entry per item, true when right. */
export interface GrammarResult {
	lesson: string;
	right: readonly boolean[];
}

/** Two failed lessons in a row end part 2. */
export const STOP_AFTER_FAILS = 2;

/**
 * Part 2 so far: the lessons placed out (every item right, and at least
 * ITEMS_PER_LESSON of them), and whether to stop asking. Lessons are taken
 * in the order given, which is the order asked.
 */
export function placeLessons(results: readonly GrammarResult[]): { placed: string[]; stop: boolean } {
	const placed: string[] = [];
	let fails = 0;
	for (const { lesson, right } of results) {
		if (right.length >= ITEMS_PER_LESSON && right.every(Boolean)) {
			placed.push(lesson);
			fails = 0;
		} else if (right.length >= ITEMS_PER_LESSON || right.some((r) => !r)) {
			fails += 1;
			if (fails >= STOP_AFTER_FAILS) return { placed, stop: true };
		}
	}
	return { placed, stop: false };
}
