// Numbers with nouns, for the practice page (/practice): which form a noun
// takes after a number.
//
//   1, 21, 31     the nominative singular       21 рік, 1 книга
//   2, 3, 4, 22   the nominative plural         22 роки, 3 книги
//   5 to 20, 25   the genitive plural           25 років, 12 книг
//
// What decides is how the number ends when it is said: 21 ends in "один", so
// the noun is singular, and 12 is "дванадцять", not a number ending in "два".
//
// There are no sentences to find for these: a short one is made here from a
// noun that can be counted and a frame it fits, with the number in figures
// (У мене 5 ___, Мені 21 ___). Every frame keeps the counted noun the
// subject, so nothing but the number decides its form: after a verb like
// коштувати the noun of 1 would be accusative (одну гривню), which is another
// rule. The nouns' forms come from the dictionary (gaps.ts).
//
// Nothing here imports from Svelte or reads the database, so `npm test` runs
// it.
import { plain } from '../search/normalize.ts';
import type { Gap, Random } from './round.ts';

const STRESS = '́';
const VOWELS = 'аеєиіїоуюяАЕЄИІЇОУЮЯ';
const CHOICES = 4;

/** What a number point asks for, and numbers that ask for it. */
interface NumberPoint {
	case: 'nominative' | 'genitive';
	number: 'singular' | 'plural';
	numbers: readonly number[];
}

const NUMBER_POINTS: Record<string, NumberPoint> = {
	'one-nom': { case: 'nominative', number: 'singular', numbers: [1, 21, 31, 41, 51, 61, 81, 101] },
	'few-nom': { case: 'nominative', number: 'plural', numbers: [2, 3, 4, 22, 23, 24, 32, 33, 34, 42, 53, 64] },
	'many-gen': {
		case: 'genitive', number: 'plural',
		numbers: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 26, 27, 30, 38, 40, 50, 100]
	}
};

export const isNumberPoint = (point: string): boolean => point in NUMBER_POINTS;

/** A sentence with `{n}` for the number and `___` for the noun, and its English with `{n}` and `{noun}`. */
interface Frame {
	uk: string;
	en: string;
}

const FRAMES = {
	have: { uk: 'У мене {n} ___.', en: 'I have {n} {noun}.' },
	age: { uk: 'Мені {n} ___.', en: 'I am {n} {noun} old.' },
	child: { uk: 'Дитині {n} ___.', en: 'The child is {n} {noun} old.' },
	train: { uk: 'До поїзда {n} ___.', en: '{n} {noun} until the train.' },
	holiday: { uk: 'До відпустки {n} ___.', en: '{n} {noun} until the holiday.' },
	price: { uk: 'Ціна — {n} ___.', en: 'The price is {n} {noun}.' },
	flat: { uk: 'У квартирі {n} ___.', en: 'The flat has {n} {noun}.' },
	group: { uk: 'У групі {n} ___.', en: 'The group has {n} {noun}.' },
	text: { uk: 'У тексті {n} ___.', en: 'The text has {n} {noun}.' }
} satisfies Record<string, Frame>;

/** A noun that can be counted: its frame, the numbers that make sense in it, and its English, one and many. */
interface Counted {
	word: string;
	frame: keyof typeof FRAMES;
	min: number;
	max: number;
	en: readonly [string, string];
	/** Asked only after five and more: питання is the same word after 1 and after 2, so there is nothing to choose. */
	manyOnly?: boolean;
}

const counted = (
	frame: Counted['frame'], min: number, max: number, nouns: Record<string, string>, manyOnly = false
): Counted[] =>
	Object.entries(nouns).map(([word, en]) => {
		const [one, many = one + 's'] = en.split('/');
		return { word, frame, min, max, en: [one, many], manyOnly };
	});

/**
 * Left out on purpose: дівчина (дві дівчини, but п'ять дівчат), людина and
 * дитина (their plurals are other words), nouns in -ин (два громадянина) and
 * nouns with a plural only (двері, штани: they take двоє, троє).
 */
export const COUNTED: readonly Counted[] = [
	...counted('age', 18, 101, { рік: 'year' }),
	...counted('child', 1, 12, { місяць: 'month', тиждень: 'week', рік: 'year' }),
	...counted('train', 1, 55, { хвилина: 'minute' }),
	...counted('train', 1, 12, { година: 'hour' }),
	...counted('holiday', 1, 40, { день: 'day' }),
	...counted('holiday', 1, 10, { тиждень: 'week', місяць: 'month' }),
	...counted('price', 1, 101, { гривня: 'hryvnia', долар: 'dollar', копійка: 'kopiyka/kopiyky' }),
	...counted('flat', 1, 6, { кімната: 'room', ліжко: 'bed', стіл: 'table' }),
	...counted('flat', 1, 12, { вікно: 'window', стілець: 'chair' }),
	...counted('group', 1, 34, { учень: 'pupil', учениця: 'schoolgirl', студент: 'student', хлопець: 'boy' }),
	...counted('have', 1, 5, {
		брат: 'brother', сестра: 'sister', син: 'son', дочка: 'daughter', кіт: 'cat', собака: 'dog',
		друг: 'friend', подруга: 'friend'
	}),
	...counted('have', 1, 40, {
		книга: 'book', квиток: 'ticket', яблуко: 'apple', ідея: 'idea', лист: 'letter', ключ: 'key',
		зошит: 'notebook', олівець: 'pencil', ручка: 'pen', квітка: 'flower', чашка: 'cup', тарілка: 'plate',
		пляшка: 'bottle'
	}),
	...counted('have', 5, 40, { питання: 'question', завдання: 'task' }, true),
	...counted('text', 1, 101, { слово: 'word', сторінка: 'page', помилка: 'mistake' }),
	...counted('text', 5, 101, { речення: 'sentence' }, true)
];

/** The numbers of `point` that `noun` is asked with. */
function fitting(point: string, noun: Counted): number[] {
	if (noun.manyOnly && point !== 'many-gen') return [];
	return (NUMBER_POINTS[point]?.numbers ?? []).filter((n) => n >= noun.min && n <= noun.max);
}

/** How many different questions a point has: each noun with each number that fits it. */
export function numberCount(point: string): number {
	return COUNTED.reduce((sum, noun) => sum + fitting(point, noun).length, 0);
}

/** A question drawn for a point, before the noun's forms are known. */
export interface NumberDraw {
	point: string;
	noun: Counted;
	n: number;
}

/**
 * A noun and a number for `point`. A noun in `taken` (by its place in
 * COUNTED) is passed over while others are left, so a round does not count
 * the same thing twice.
 */
export function drawNumber(point: string, random: Random, taken: Set<number>): NumberDraw | null {
	if (!isNumberPoint(point)) return null;
	const fits = (noun: Counted) => fitting(point, noun);
	const all = COUNTED.map((_, i) => i).filter((i) => fits(COUNTED[i]).length);
	const free = all.filter((i) => !taken.has(i));
	const from = free.length ? free : all;
	const at = from[Math.floor(random() * from.length)];
	taken.add(at);
	const among = fits(COUNTED[at]);
	return { point, noun: COUNTED[at], n: among[Math.floor(random() * among.length)] };
}

/** Which vowel of a word is stressed, counted from 0; the only one where there is one and no mark. */
function stressedVowel(word: string): number {
	let vowel = -1;
	for (const letter of word) {
		if (letter === STRESS) return vowel;
		if (VOWELS.includes(letter)) vowel += 1;
	}
	return vowel === 0 ? 0 : -1;
}

/**
 * `form` stressed on the vowel `model` is stressed on. After два, три and
 * чотири a noun has the letters of its nominative plural and the stress of
 * its genitive singular: брати́ and бра́та give два бра́ти, се́стри and сестри́
 * give дві сестри́. Left as it is where the two do not have as many vowels.
 */
export function stressLike(form: string, model: string): string {
	const bare = form.replaceAll(STRESS, '');
	const vowels = (word: string) => [...word].filter((letter) => VOWELS.includes(letter)).length;
	const at = stressedVowel(model);
	if (at < 0 || vowels(bare) !== vowels(model) || vowels(bare) < 2) return form;
	let vowel = -1;
	let out = '';
	for (const letter of bare) {
		out += letter;
		if (VOWELS.includes(letter) && ++vowel === at) out += STRESS;
	}
	return out;
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** One form of a noun, as the `forms` table has it. */
export interface NounForm {
	form: string;
	plain: string;
	tags: string;
}

/**
 * The question as a round asks it, or null where the dictionary's noun lacks
 * the form wanted. The wrong choices are the forms a learner hesitates
 * among: the dictionary form, the plural, the genitive of one (2 брата, as
 * Russian has it) and of many.
 */
export function numberGap(
	draw: NumberDraw, entry: { word: string; headword: string }, forms: readonly NounForm[], random: Random
): Gap | null {
	const { case: wanted, number } = NUMBER_POINTS[draw.point];
	const tagged = forms.map((form) => ({ ...form, tags: JSON.parse(form.tags) as string[] }));
	const of = (kase: string, num: string) =>
		tagged.filter((form) => form.tags.includes(kase) && form.tags.includes(num)).map((form) => form.form);

	const right = of(wanted, number);
	if (!right.length) return null;
	const genitiveOfOne = of('genitive', 'singular')[0];
	const answer = draw.point === 'few-nom' && genitiveOfOne ? stressLike(right[0], genitiveOfOne) : right[0];
	const rightSpellings = new Set(right.map(plain));

	// The four forms that tempt, then any other, each spelling once
	const others = shuffled(tagged.filter((form) => !form.tags.includes('vocative')).map((form) => form.form), random);
	const tempting = [
		of('nominative', 'singular')[0], of('nominative', 'plural')[0], of('genitive', 'plural')[0], genitiveOfOne
	];
	const wrong = new Map<string, string>();
	for (const form of [...tempting, ...others]) {
		if (form && !rightSpellings.has(plain(form)) && !wrong.has(plain(form))) wrong.set(plain(form), form);
	}

	const frame: Frame = FRAMES[draw.noun.frame];
	const shown = answer.replaceAll(STRESS, '');
	const uk = frame.uk.replace('{n}', String(draw.n));
	return {
		point: draw.point,
		uk: uk.replace('___', shown),
		en: frame.en.replace('{n}', String(draw.n)).replace('{noun}', draw.noun.en[draw.n === 1 ? 0 : 1]),
		start: uk.indexOf('___'),
		length: shown.length,
		answer,
		also: [...rightSpellings].filter((spelling) => spelling !== plain(answer)),
		number,
		word: entry.word,
		headword: entry.headword,
		choices: shuffled([answer, ...[...wrong.values()].slice(0, CHOICES - 1)], random),
		forms: [...new Set(tagged.map((form) => form.plain))],
		tatoeba_id: 0
	};
}
