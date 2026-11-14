// The lessons of the practice page (/practice): the grammar points
// (points.ts) in the order they are best met, a few to a lesson, each lesson
// about one thing to say: where something is (у місті, на столі), where it
// goes (у місто, на стіл, до школи).
//
// A lesson's number is its place in the list and is kept nowhere, so a
// lesson can be put between two others. Its short name is interface text, in
// i18n.ts (`learn.short`).
//
// The Learn page's Grammar card and the practice page lay the lessons out the
// same way (lessonRows), and open the same one: the lesson last opened on
// either, remembered in this browser, or else the first not yet known.
//
// Nothing here imports from Svelte, so `npm test` can run it.

import { isNumber, pointOf, type Point } from './points.ts';
import type { PointState } from './round.ts';

export interface Lesson {
	id: string;
	/** Ids of its points, in the order they are met. */
	points: readonly string[];
}

export const LESSONS: readonly Lesson[] = [
	{ id: 'where', points: ['u-loc', 'na-loc'] },
	{ id: 'where-to', points: ['u-acc', 'na-acc', 'do-gen'] },
	{ id: 'with-from', points: ['z-ins', 'z-gen', 'vid-gen'] },
	{ id: 'numbers', points: ['one-nom', 'few-nom', 'many-gen'] },
	{ id: 'for-about', points: ['dlia-gen', 'bez-gen', 'pro-acc', 'za-acc'] },
	{ id: 'before-after', points: ['pislia-gen', 'pered-ins', 'cherez-acc'] },
	{ id: 'around', points: ['bilia-gen', 'za-ins', 'mizh-ins', 'sered-gen', 'po-loc'] },
	{ id: 'above-below', points: ['nad-ins', 'pid-ins', 'pid-acc', 'proty-gen'] }
];

/** A lesson as the pages show it: its rules that have sentences, how well each is held, and the words it teaches. */
export interface LessonRow {
	id: string;
	/** Its place in the list, from 1. */
	n: number;
	points: { point: Point; state: PointState }[];
	/** The words it teaches, each once: у · на, з · від. */
	cues: string[];
	/** How many of its rules are known. */
	known: number;
}

// A number's rule is shown by its example (1 книга · 2 книги · 5 книг): the
// change in the noun is what the lesson teaches, and the bare numbers
// (1 · 2–4 · 5+) said nothing of it. A preposition by its first spelling
// (у of у / в).
export const cueOf = (point: Point): string => (isNumber(point) ? point.example : point.cue.split(' / ')[0]);

/** The lessons with a rule in `offered` (ids of the rules that have sentences), in order. */
export function lessonRows(offered: readonly string[], held: (point: Point) => PointState): LessonRow[] {
	return LESSONS.map((lesson, i) => {
		const points = lesson.points
			.filter((id) => offered.includes(id))
			.map(pointOf)
			.filter((point): point is Point => point !== undefined)
			.map((point) => ({ point, state: held(point) }));
		const cues = [...new Set(points.map(({ point }) => cueOf(point)))];
		const known = points.filter(({ state }) => state === 'known').length;
		return { id: lesson.id, n: i + 1, points, cues, known };
	}).filter((lesson) => lesson.points.length);
}

/** The lesson to show open: the one chosen, or else the first not fully known, or else the first. */
export const openLesson = (rows: readonly LessonRow[], chosen: string | null): LessonRow | undefined =>
	rows.find((lesson) => lesson.id === chosen)
	?? rows.find((lesson) => lesson.known < lesson.points.length)
	?? rows[0];

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
