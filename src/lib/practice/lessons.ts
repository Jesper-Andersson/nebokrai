// The lessons of the practice page (/practice): the grammar points
// (points.ts) in the order they are best met, a few to a lesson, each lesson
// about one thing to say: where something is (у місті, на столі), where it
// goes (у місто, на стіл, до школи).
//
// A lesson's number is its place in its group's list and is kept nowhere, so a
// lesson can be put between two others. Its short name is interface text, in
// i18n.ts (`learn.short`).
//
// The Learn page's Grammar card and the practice page lay the lessons out the
// same way (lessonRows), and open the same one: the lesson last opened on
// either, remembered in this browser, or else the first not yet known.
//
// Nothing here imports from Svelte, so `npm test` can run it.

import { GOVERNMENT_LESSONS } from './government.ts';
import { isNumber, pointOf, type Point } from './points.ts';
import type { PointState } from './round.ts';

/**
 * Which list a lesson is in: the cases after prepositions (with the numbers
 * and who-whom), or the verbs' patterns (government.ts), which /learn and
 * /practice list under a heading of their own.
 */
export type LessonGroup = 'preposition' | 'government';

export interface Lesson {
	id: string;
	group: LessonGroup;
	/** Ids of its points, in the order they are met. */
	points: readonly string[];
}

const cases = (id: string, points: readonly string[]): Lesson => ({ id, group: 'preposition', points });

export const LESSONS: readonly Lesson[] = [
	cases('where', ['u-loc', 'na-loc']),
	cases('where-to', ['u-acc', 'na-acc', 'do-gen']),
	cases('who-whom', ['who-acc']),
	cases('with-from', ['z-ins', 'z-gen', 'vid-gen']),
	cases('numbers', ['one-nom', 'few-nom', 'many-gen']),
	cases('for-about', ['dlia-gen', 'bez-gen', 'pro-acc', 'za-acc']),
	cases('before-after', ['pislia-gen', 'pered-ins', 'cherez-acc']),
	cases('around', ['bilia-gen', 'za-ins', 'mizh-ins', 'sered-gen', 'po-loc']),
	cases('above-below', ['nad-ins', 'pid-ins', 'pid-acc', 'proty-gen']),
	// The verbs' patterns, a lesson to a question, the commonest verbs first
	...GOVERNMENT_LESSONS.map(({ id, points }): Lesson => ({ id, group: 'government', points }))
];

/** A lesson as the pages show it: its rules that have sentences, how well each is held, and the words it teaches. */
export interface LessonRow {
	id: string;
	group: LessonGroup;
	/** Its place in its group's list, from 1: the verbs' patterns start again at 1. */
	n: number;
	points: { point: Point; state: PointState }[];
	/** The words it teaches, each once: у · на, з · від. */
	cues: string[];
	/** How many of its rules are known. */
	known: number;
	/** Passed in the placement test (placement.ts): counted as done, though it has no cards. */
	placed: boolean;
}

// A number's rule is shown by its example (1 книга · 2 книги · 5 книг): the
// change in the noun is what the lesson teaches, and the bare numbers
// (1 · 2–4 · 5+) said nothing of it. A preposition by its first spelling
// (у of у / в).
export const cueOf = (point: Point): string => (isNumber(point) ? point.example : point.cue.split(' / ')[0]);

/**
 * The lessons with a rule in `offered` (ids of the rules that have sentences),
 * in order. `placed` are the lessons the placement test placed out.
 */
export function lessonRows(
	offered: readonly string[], held: (point: Point) => PointState, placed: ReadonlySet<string> = new Set()
): LessonRow[] {
	// Counted over every lesson of the group, not only those shown, so a
	// lesson keeps its number when one before it has no sentences
	const counted = new Map<LessonGroup, number>();
	return LESSONS.map((lesson) => {
		const n = (counted.get(lesson.group) ?? 0) + 1;
		counted.set(lesson.group, n);
		const points = lesson.points
			.filter((id) => offered.includes(id))
			.map(pointOf)
			.filter((point): point is Point => point !== undefined)
			.map((point) => ({ point, state: held(point) }));
		const cues = [...new Set(points.map(({ point }) => cueOf(point)))];
		const known = points.filter(({ state }) => state === 'known').length;
		return { id: lesson.id, group: lesson.group, n, points, cues, known, placed: placed.has(lesson.id) };
	}).filter((lesson) => lesson.points.length);
}

/**
 * The lesson to show open: the one chosen, or else the first not fully known
 * and not placed out by the placement test, or else the first.
 */
export const openLesson = (rows: readonly LessonRow[], chosen: string | null): LessonRow | undefined =>
	rows.find((lesson) => lesson.id === chosen)
	?? rows.find((lesson) => !lesson.placed && lesson.known < lesson.points.length)
	?? rows[0];

/**
 * The rules a round may bring in as new: those of `offered` outside the
 * lessons placed out. A placed rule that already has a card stays, for its
 * reviews; one with none is not started unasked, though it can still be
 * practised by name (/practice?lesson=where).
 */
export function newPicks(
	offered: readonly string[], placed: ReadonlySet<string>, hasCard: (id: string) => boolean
): string[] {
	if (!placed.size) return [...offered];
	const placedPoints = new Set(LESSONS.filter((lesson) => placed.has(lesson.id)).flatMap((lesson) => lesson.points));
	return offered.filter((id) => !placedPoints.has(id) || hasCard(id));
}

// The lesson last opened, on /learn or /practice: this browser's to remember,
// as the practice page's way of answering is
const OPEN_KEY = 'grammar-lesson';

export function readOpenLesson(): string | null {
	try {
		return localStorage.getItem(OPEN_KEY);
	} catch {
		// Storage blocked: the first lesson not yet known opens
		return null;
	}
}

export function rememberOpenLesson(id: string): void {
	try {
		localStorage.setItem(OPEN_KEY, id);
	} catch {
		// Storage blocked: the choice lasts until the page is closed
	}
}
