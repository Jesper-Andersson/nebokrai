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
// The last group is case government (government.ts): a verb with the case
// it asks of its noun, дякувати + кому? (дякую мамі). Its sentences are in
// the same table, found and made by add_government.
//
// Nothing here imports from Svelte, so `npm test` can run it.

import { GOVERNMENT_LESSONS, askOf, meaningOf, patternOf, type GovernmentCase } from './government.ts';

export type PointCase = 'nominative' | 'genitive' | 'dative' | 'accusative' | 'instrumental' | 'locative';

/**
 * What a point is about: the case after a preposition, the form a number
 * asks of its noun, or which of two nouns does what (roles.ts).
 */
export type PointKind = 'preposition' | 'number' | 'roles' | 'government';

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
	/** For a verb's pattern: the question its noun answers, with the preposition (кому?, на кого? на що?). */
	ask?: string;
	/** For a verb's pattern: what it says in English (to thank someone); i18n.ts has no line for it. */
	en?: string;
}

const preposition = (id: string, cue: string, kase: PointCase, example: string): Point =>
	({ id, kind: 'preposition', cue, case: kase, source: 'cloze', example });
const number = (id: string, cue: string, kase: PointCase, counts: 'singular' | 'plural', example: string): Point =>
	({ id, kind: 'number', cue, case: kase, number: counts, source: 'frames', example });
const roles = (id: string, cue: string, kase: PointCase, example: string): Point =>
	({ id, kind: 'roles', cue, case: kase, source: 'frames', example });

const CASE_NAMES: Record<GovernmentCase, PointCase> = {
	gen: 'genitive', dat: 'dative', acc: 'accusative', ins: 'instrumental', loc: 'locative'
};

/** The practised patterns of government.ts as points, in the order of their lessons. */
const government = (): Point[] =>
	GOVERNMENT_LESSONS.flatMap((lesson) => lesson.points).map((id) => {
		const pattern = patternOf(id)!;
		return {
			id,
			kind: 'government',
			cue: pattern.lemmas[0],
			case: CASE_NAMES[pattern.case],
			source: 'cloze',
			example: pattern.example,
			ask: askOf(pattern),
			en: meaningOf(pattern)
		};
	});

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
	roles('who-acc', 'хто кого', 'accusative', 'собаку бачить кіт'),
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
	preposition('proty-gen', 'проти', 'genitive', 'проти вітру'),
	...government()
];

const BY_ID = new Map(POINTS.map((point) => [point.id, point]));

export const pointOf = (id: string): Point | undefined => BY_ID.get(id);

/** The cases, in the order the page lists their prepositions. */
export const POINT_CASES: readonly PointCase[] = ['locative', 'accusative', 'genitive', 'instrumental', 'dative'];

/** Whether a point is a number's and not a preposition's. */
export const isNumber = (point: Point): boolean => point.kind === 'number';

/** Whether a point is a verb's pattern (government.ts) and not a preposition's. */
export const isGovernment = (point: Point): boolean => point.kind === 'government';

/** A rule as a lesson's table and the rule card print it: без; дякувати + кому? */
export const ruleOf = (point: Point): string => (point.ask ? `${point.cue} + ${point.ask}` : point.cue);

/**
 * What a point says, in the interface's language: i18n.ts's line, or for a
 * verb's pattern its English, which the Ukrainian interface leaves out
 * (the pattern is Ukrainian already).
 */
export const meaningOfPoint = (meanings: Record<string, string>, point: Point, lang: string): string =>
	meanings[point.id] ?? (lang === 'en' ? (point.en ?? '') : '');

// A point's schedule is kept with the flashcards' (review.svelte.ts), under a
// name no word has, so the account holds it and the weekly goal counts it with no
// table of its own. The flashcards leave alone a card whose word is in no deck.
const KEY_PREFIX = 'grammar:';

/** The name a point's schedule is kept under among the review cards. */
export const cardKey = (id: string): string => KEY_PREFIX + id;

/** Whether a review card is a grammar point's and not a word's: what POST /api/review/sync keeps beside dictionary words. */
export const isPointKey = (key: string): boolean => key.startsWith(KEY_PREFIX) && BY_ID.has(key.slice(KEY_PREFIX.length));
