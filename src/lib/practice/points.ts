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
	/** A short phrase that shows the rule at work, as /learn's table of a lesson prints it: без цукру. */
	example: string;
}

const preposition = (id: string, cue: string, kase: PointCase, example: string): Point =>
	({ id, kind: 'preposition', cue, case: kase, source: 'cloze', example });
const number = (id: string, cue: string, kase: PointCase, counts: 'singular' | 'plural', example: string): Point =>
	({ id, kind: 'number', cue, case: kase, number: counts, source: 'frames', example });

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
	preposition('u-loc', 'у / в', 'locative', 'у місті'),
	preposition('na-loc', 'на', 'locative', 'на столі'),
	preposition('u-acc', 'у / в', 'accusative', 'у місто'),
	preposition('na-acc', 'на', 'accusative', 'на стіл'),
	preposition('do-gen', 'до', 'genitive', 'до школи'),
	preposition('z-ins', 'з / із / зі', 'instrumental', 'з другом'),
	preposition('z-gen', 'з / із / зі', 'genitive', 'з міста'),
	preposition('vid-gen', 'від', 'genitive', 'від мами'),
	number('one-nom', '1, 21, 31…', 'nominative', 'singular', '1 книга'),
	number('few-nom', '2, 3, 4, 22…', 'nominative', 'plural', '2 книги'),
	number('many-gen', '5–20, 25…', 'genitive', 'plural', '5 книг'),
	preposition('dlia-gen', 'для', 'genitive', 'для тебе'),
	preposition('bez-gen', 'без', 'genitive', 'без цукру'),
	preposition('pro-acc', 'про', 'accusative', 'про книгу'),
	preposition('za-acc', 'за', 'accusative', 'за каву'),
	preposition('pislia-gen', 'після', 'genitive', 'після роботи'),
	preposition('pered-ins', 'перед', 'instrumental', 'перед домом'),
	preposition('cherez-acc', 'через', 'accusative', 'через міст'),
	preposition('bilia-gen', 'біля', 'genitive', 'біля дому'),
	preposition('za-ins', 'за', 'instrumental', 'за містом'),
	preposition('mizh-ins', 'між', 'instrumental', 'між нами'),
	preposition('sered-gen', 'серед', 'genitive', 'серед друзів'),
	preposition('po-loc', 'по', 'locative', 'по місту'),
	preposition('nad-ins', 'над', 'instrumental', 'над столом'),
	preposition('pid-ins', 'під', 'instrumental', 'під столом'),
	preposition('pid-acc', 'під', 'accusative', 'під стіл'),
	preposition('proty-gen', 'проти', 'genitive', 'проти вітру')
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
