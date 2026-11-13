// The grammar points of the practice page (/practice): a preposition with
// the case it asks for. без takes the genitive (без цукру); на takes the
// accusative for where to (на стіл) and the locative for where (на столі).
//
// The sentences of each point are found by data/import_wiktionary.py
// (PREPOSITIONS, add_cloze), which names the points the same way; a point
// listed here and not there has no sentences and is not offered. What each
// preposition means is interface text, in i18n.ts (`practice.meaning`).
//
// Nothing here imports from Svelte, so `npm test` can run it.

export type PointCase = 'genitive' | 'accusative' | 'instrumental' | 'locative';

export interface Point {
	id: string;
	/** As it is printed: every spelling of the preposition. */
	preposition: string;
	case: PointCase;
}

/**
 * In the order they are best met: where something is and where it goes
 * first, as courses for beginners begin with them, then the commonest of
 * the rest.
 */
export const POINTS: readonly Point[] = [
	{ id: 'u-loc', preposition: 'у / в', case: 'locative' },
	{ id: 'na-loc', preposition: 'на', case: 'locative' },
	{ id: 'u-acc', preposition: 'у / в', case: 'accusative' },
	{ id: 'na-acc', preposition: 'на', case: 'accusative' },
	{ id: 'z-ins', preposition: 'з / із / зі', case: 'instrumental' },
	{ id: 'do-gen', preposition: 'до', case: 'genitive' },
	{ id: 'z-gen', preposition: 'з / із / зі', case: 'genitive' },
	{ id: 'dlia-gen', preposition: 'для', case: 'genitive' },
	{ id: 'bez-gen', preposition: 'без', case: 'genitive' },
	{ id: 'pro-acc', preposition: 'про', case: 'accusative' },
	{ id: 'vid-gen', preposition: 'від', case: 'genitive' },
	{ id: 'za-acc', preposition: 'за', case: 'accusative' },
	{ id: 'za-ins', preposition: 'за', case: 'instrumental' },
	{ id: 'pislia-gen', preposition: 'після', case: 'genitive' },
	{ id: 'pered-ins', preposition: 'перед', case: 'instrumental' },
	{ id: 'bilia-gen', preposition: 'біля', case: 'genitive' },
	{ id: 'cherez-acc', preposition: 'через', case: 'accusative' },
	{ id: 'po-loc', preposition: 'по', case: 'locative' },
	{ id: 'pid-ins', preposition: 'під', case: 'instrumental' },
	{ id: 'pid-acc', preposition: 'під', case: 'accusative' },
	{ id: 'nad-ins', preposition: 'над', case: 'instrumental' },
	{ id: 'mizh-ins', preposition: 'між', case: 'instrumental' },
	{ id: 'proty-gen', preposition: 'проти', case: 'genitive' },
	{ id: 'sered-gen', preposition: 'серед', case: 'genitive' }
];

const BY_ID = new Map(POINTS.map((point) => [point.id, point]));

export const pointOf = (id: string): Point | undefined => BY_ID.get(id);

/** The cases, in the order the page lists their points. */
export const POINT_CASES: readonly PointCase[] = ['locative', 'accusative', 'genitive', 'instrumental'];

// A point's schedule is kept with the flashcards' (review.svelte.ts), under a
// name no word has, so the account holds it and the streak counts it with no
// table of its own. The flashcards leave alone a card whose word is in no deck.
const KEY_PREFIX = 'grammar:';

/** The name a point's schedule is kept under among the review cards. */
export const cardKey = (id: string): string => KEY_PREFIX + id;

/** Whether a review card is a grammar point's and not a word's: what POST /api/review/sync keeps beside dictionary words. */
export const isPointKey = (key: string): boolean => key.startsWith(KEY_PREFIX) && BY_ID.has(key.slice(KEY_PREFIX.length));
