// The grammar points of the practice page (/practice). Most are a preposition
// with the case it asks for: без takes the genitive (без цукру); на takes the
// accusative for where to (на стіл) and the locative for where (на столі).
// Three are numbers with the form of the noun counted: 1 книга, 2 книги,
// 5 книг.
//
// The sentences of a preposition's point are found by
// data/import_wiktionary.py (PREPOSITIONS, add_cloze), which names the points
// the same way; a point listed here and not there has no sentences and is
// not offered. A number's sentences are made as they are asked for
// (numbers.ts). What each point says is interface text, in i18n.ts
// (`practice.meaning`).
//
// Nothing here imports from Svelte, so `npm test` can run it.

export type PointCase = 'nominative' | 'genitive' | 'accusative' | 'instrumental' | 'locative';

/** What a point is about: the case after a preposition, or the form a number asks of its noun. */
export type PointKind = 'preposition' | 'number';

export interface Point {
	id: string;
	kind: PointKind;
	/** What is followed by the case, as it is printed: every spelling of the preposition, or the numbers. */
	cue: string;
	case: PointCase;
	/** For a number: whether it counts the noun as one or as many. A preposition takes either. */
	number?: 'singular' | 'plural';
	/** Where its sentences come from: found in Tatoeba (the cloze table), or made from frames (numbers.ts). */
	source: 'cloze' | 'frames';
}

const preposition = (id: string, cue: string, kase: PointCase): Point =>
	({ id, kind: 'preposition', cue, case: kase, source: 'cloze' });
const number = (id: string, cue: string, kase: PointCase, counts: 'singular' | 'plural'): Point =>
	({ id, kind: 'number', cue, case: kase, number: counts, source: 'frames' });

/**
 * In the order they are best met, which is the order of the lessons
 * (lessons.ts; a test holds the two together): where something is and where
 * it goes first, as courses for beginners begin with them, the numbers early
 * (an age and a price are among the first things said), then the rest by
 * what they are used to say.
 *
 * An id is the name a learner's progress is kept under (cardKey): a point
 * may be moved, and its id is never changed.
 */
export const POINTS: readonly Point[] = [
	preposition('u-loc', 'у / в', 'locative'),
	preposition('na-loc', 'на', 'locative'),
	preposition('u-acc', 'у / в', 'accusative'),
	preposition('na-acc', 'на', 'accusative'),
	preposition('do-gen', 'до', 'genitive'),
	preposition('z-ins', 'з / із / зі', 'instrumental'),
	preposition('z-gen', 'з / із / зі', 'genitive'),
	preposition('vid-gen', 'від', 'genitive'),
	number('one-nom', '1, 21, 31…', 'nominative', 'singular'),
	number('few-nom', '2, 3, 4, 22…', 'nominative', 'plural'),
	number('many-gen', '5–20, 25…', 'genitive', 'plural'),
	preposition('dlia-gen', 'для', 'genitive'),
	preposition('bez-gen', 'без', 'genitive'),
	preposition('pro-acc', 'про', 'accusative'),
	preposition('za-acc', 'за', 'accusative'),
	preposition('pislia-gen', 'після', 'genitive'),
	preposition('pered-ins', 'перед', 'instrumental'),
	preposition('cherez-acc', 'через', 'accusative'),
	preposition('bilia-gen', 'біля', 'genitive'),
	preposition('za-ins', 'за', 'instrumental'),
	preposition('mizh-ins', 'між', 'instrumental'),
	preposition('sered-gen', 'серед', 'genitive'),
	preposition('po-loc', 'по', 'locative'),
	preposition('nad-ins', 'над', 'instrumental'),
	preposition('pid-ins', 'під', 'instrumental'),
	preposition('pid-acc', 'під', 'accusative'),
	preposition('proty-gen', 'проти', 'genitive')
];

const BY_ID = new Map(POINTS.map((point) => [point.id, point]));

export const pointOf = (id: string): Point | undefined => BY_ID.get(id);

/** The cases, in the order the page lists their prepositions. */
export const POINT_CASES: readonly PointCase[] = ['locative', 'accusative', 'genitive', 'instrumental'];

/** Whether a point is a number's and not a preposition's. */
export const isNumber = (point: Point): boolean => point.kind === 'number';

// A point's schedule is kept with the flashcards' (review.svelte.ts), under a
// name no word has, so the account holds it and the streak counts it with no
// table of its own. The flashcards leave alone a card whose word is in no deck.
const KEY_PREFIX = 'grammar:';

/** The name a point's schedule is kept under among the review cards. */
export const cardKey = (id: string): string => KEY_PREFIX + id;

/** Whether a review card is a grammar point's and not a word's: what POST /api/review/sync keeps beside dictionary words. */
export const isPointKey = (key: string): boolean => key.startsWith(KEY_PREFIX) && BY_ID.has(key.slice(KEY_PREFIX.length));
