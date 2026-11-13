// The lessons of the practice page (/practice): the grammar points
// (points.ts) in the order they are best met, a few to a lesson, each lesson
// about one thing to say: where something is (у місті, на столі), where it
// goes (у місто, на стіл, до школи).
//
// A lesson's number is its place in the list and is kept nowhere, so a
// lesson can be put between two others. Its title is interface text, in
// i18n.ts (`practice.lessons`).
//
// Nothing here imports from Svelte, so `npm test` can run it.

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
