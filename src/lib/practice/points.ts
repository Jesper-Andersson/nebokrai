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

export interface Point {
	id: string;
	/** What is followed by the case, as it is printed: every spelling of the preposition, or the numbers. */
	cue: string;
	case: PointCase;
	/** For a number: whether it counts the noun as one or as many. A preposition takes either. */
	number?: 'singular' | 'plural';
}

/**
 * In the order they are best met: where something is and where it goes
 * first, as courses for beginners begin with them, the numbers early (an
 * age and a price are among the first things said), then the commonest of
 * the rest.
 */
export const POINTS: readonly Point[] = [
	{ id: 'u-loc', cue: 'у / в', case: 'locative' },
	{ id: 'na-loc', cue: 'на', case: 'locative' },
	{ id: 'u-acc', cue: 'у / в', case: 'accusative' },
	{ id: 'na-acc', cue: 'на', case: 'accusative' },
	{ id: 'z-ins', cue: 'з / із / зі', case: 'instrumental' },
	{ id: 'do-gen', cue: 'до', case: 'genitive' },
	{ id: 'one-nom', cue: '1, 21, 31…', case: 'nominative', number: 'singular' },
	{ id: 'few-nom', cue: '2, 3, 4, 22…', case: 'nominative', number: 'plural' },
	{ id: 'many-gen', cue: '5–20, 25…', case: 'genitive', number: 'plural' },
	{ id: 'z-gen', cue: 'з / із / зі', case: 'genitive' },
	{ id: 'dlia-gen', cue: 'для', case: 'genitive' },
	{ id: 'bez-gen', cue: 'без', case: 'genitive' },
	{ id: 'pro-acc', cue: 'про', case: 'accusative' },
	{ id: 'vid-gen', cue: 'від', case: 'genitive' },
	{ id: 'za-acc', cue: 'за', case: 'accusative' },
	{ id: 'za-ins', cue: 'за', case: 'instrumental' },
	{ id: 'pislia-gen', cue: 'після', case: 'genitive' },
	{ id: 'pered-ins', cue: 'перед', case: 'instrumental' },
	{ id: 'bilia-gen', cue: 'біля', case: 'genitive' },
	{ id: 'cherez-acc', cue: 'через', case: 'accusative' },
	{ id: 'po-loc', cue: 'по', case: 'locative' },
	{ id: 'pid-ins', cue: 'під', case: 'instrumental' },
	{ id: 'pid-acc', cue: 'під', case: 'accusative' },
	{ id: 'nad-ins', cue: 'над', case: 'instrumental' },
	{ id: 'mizh-ins', cue: 'між', case: 'instrumental' },
	{ id: 'proty-gen', cue: 'проти', case: 'genitive' },
	{ id: 'sered-gen', cue: 'серед', case: 'genitive' }
];

const BY_ID = new Map(POINTS.map((point) => [point.id, point]));

export const pointOf = (id: string): Point | undefined => BY_ID.get(id);

/** The cases, in the order the page lists their prepositions. */
export const POINT_CASES: readonly PointCase[] = ['locative', 'accusative', 'genitive', 'instrumental'];

/** Whether a point is a number's and not a preposition's. */
export const isNumber = (point: Point): boolean => point.number !== undefined;

// A point's schedule is kept with the flashcards' (review.svelte.ts), under a
// name no word has, so the account holds it and the streak counts it with no
// table of its own. The flashcards leave alone a card whose word is in no deck.
const KEY_PREFIX = 'grammar:';

/** The name a point's schedule is kept under among the review cards. */
export const cardKey = (id: string): string => KEY_PREFIX + id;

/** Whether a review card is a grammar point's and not a word's: what POST /api/review/sync keeps beside dictionary words. */
export const isPointKey = (key: string): boolean => key.startsWith(KEY_PREFIX) && BY_ID.has(key.slice(KEY_PREFIX.length));
