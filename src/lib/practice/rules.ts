// What a rule's card (RuleCard.svelte) shows besides the rule itself: the
// endings of the case it asks for, by gender, each with words that have it.
//
//   без + genitive
//   -а, -я        хлі́ба, учи́теля      Masculine
//   -у, -ю        цу́кру, ча́ю          Masculine
//   -и, -і, -ї    води́, землі́, ста́нції  Feminine
//
// The endings belong to the case, not to the preposition: без and до show
// the same genitive table. A number asks for a case and a number together,
// so each of the three number rules has a table of its own: 2 кни́ги, 5 книг.
//
// The words are Ukrainian and are not translated; what labels each row (a
// gender, a plural, whether it is a living being) is a grammar term, named
// in both languages by i18n.ts (`grammar.terms`). An ending of '' means the
// word keeps its dictionary form: у мі́сто.
//
// Nothing here imports from Svelte, so `npm test` can run it.

import type { Point } from './points.ts';

/** The grammar terms (i18n.ts `grammar.terms`) a row of endings is labelled with. */
export type EndingKind = 'masculine' | 'feminine' | 'neuter' | 'plural' | 'animate' | 'inanimate';

export interface EndingRow {
	/** The ending, or '' where the word keeps its dictionary form. */
	ending: string;
	/** Words with that ending, with their stress: хлі́ба, учи́теля. */
	words: string;
	/** What the row is for, named one after the other: Masculine · Animate. */
	kinds: readonly EndingKind[];
}

const row = (ending: string, words: string, ...kinds: EndingKind[]): EndingRow => ({ ending, words, kinds });

/** By the case a preposition asks for. */
const CASES: Record<string, readonly EndingRow[]> = {
	genitive: [
		row('-а, -я', 'хлі́ба, учи́теля', 'masculine'),
		row('-у, -ю', 'цу́кру, ча́ю', 'masculine'),
		row('-и, -і, -ї', 'води́, землі́, ста́нції', 'feminine'),
		row('-а, -я', 'молока́, мо́ря', 'neuter'),
		row('-ів, -ей, —', 'дру́зів, люде́й, слів', 'plural')
	],
	locative: [
		row('-і, -у', 'столі́, лі́сі, ри́нку', 'masculine'),
		row('-і, -ї', 'шко́лі, землі́, ста́нції', 'feminine'),
		row('-і, -у', 'мі́сті, мо́рі, лі́жку', 'neuter'),
		row('-ах, -ях', 'міста́х, поля́х', 'plural')
	],
	accusative: [
		row('', 'стіл, ліс', 'masculine', 'inanimate'),
		row('-а, -я', 'бра́та, лі́каря', 'masculine', 'animate'),
		row('-у, -ю', 'шко́лу, зе́млю', 'feminine'),
		row('', 'мі́сто, мо́ре', 'neuter'),
		row('', 'міста́, го́ри', 'plural', 'inanimate'),
		row('-ів, -ей', 'дру́зів, люде́й', 'plural', 'animate')
	],
	instrumental: [
		row('-ом, -ем, -єм', 'дру́гом, ноже́м, кра́єм', 'masculine'),
		row('-ою, -ею, -єю', 'ма́мою, земле́ю, ста́нцією', 'feminine'),
		row('-ю', 'ні́ччю, сі́ллю', 'feminine'),
		row('-ом, -ем, -ям', 'мі́стом, мо́рем, життя́м', 'neuter'),
		row('-ами, -ями', 'міста́ми, поля́ми', 'plural')
	]
};

/** The number rules, by id: what they ask of the noun counted. */
const NUMBERS: Record<string, readonly EndingRow[]> = {
	'one-nom': [
		row('', '1 стіл, 21 рік', 'masculine'),
		row('', '1 кни́га, 31 пі́сня', 'feminine'),
		row('', '1 мі́сто, 41 мо́ре', 'neuter')
	],
	'few-nom': [
		row('-и, -і', '2 столи́, 3 студе́нти', 'masculine'),
		row('-и, -і', '2 кни́ги, 4 ма́ми', 'feminine'),
		row('-а, -я', '2 я́блука, 3 ву́ха', 'neuter')
	],
	'many-gen': [
		row('-ів', '5 столі́в, 10 студе́нтів', 'masculine'),
		row('—, -ей', '5 книг, 6 пісе́нь', 'feminine'),
		row('—', '5 міст, 7 слів', 'neuter')
	]
};

/** The endings a rule's card shows: by the number rule's id, or by the case its preposition asks for. */
export function endingsOf(point: Point): readonly EndingRow[] {
	return (point.kind === 'number' ? NUMBERS[point.id] : CASES[point.case]) ?? [];
}

/** How many real sentences a rule's card shows. */
export const EXAMPLES = 3;

/**
 * The sentences a rule's card shows, from those drawn for its rule: none
 * with the noun being asked for, which would give the answer away (Кава без
 * цукру over Кава без [цукор]), and no sentence twice.
 */
export function examplesFor<T extends { uk: string; word: string }>(drawn: readonly T[], asked: { word: string }): T[] {
	const seen = new Set<string>();
	return drawn
		.filter((gap) => gap.word !== asked.word && !seen.has(gap.uk) && seen.add(gap.uk))
		.slice(0, EXAMPLES);
}

/**
 * Whether the sentence at `at` is where a rule is met for the first time:
 * the first of its rule's sentences in the round, for a rule that had no
 * flashcard when the round began. Its card opens over it unasked.
 */
export function introduces(points: readonly string[], at: number, known: (point: string) => boolean): boolean {
	const point = points[at];
	return point !== undefined && points.indexOf(point) === at && !known(point);
}
