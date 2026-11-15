// "Who does what to whom?" for the practice page (/practice): a sentence
// with two nouns and a verb, and the question which of them does it.
//
//   Собаку бачить кіт.     the cat sees the dog: кіт is the nominative,
//                          собаку the accusative, whatever the order
//
// Ukrainian puts its words in almost any order, so the order says nothing;
// the endings say it all. English readers take the first noun for the doer,
// which is exactly the habit to unlearn (what the processing-instruction
// study of Russian learners tested).
//
// There are no sentences to find for this: one is made here, as numbers.ts
// makes the numbers', from a verb and two nouns, half the time with the doer
// first and half the time last. Every verb is in the present tense, third
// person (бачить), which has one form for every gender, so the verb gives
// nothing away. Every noun is a living being whose accusative differs from
// its dictionary form (кіт, кота; мама, маму): with a thing or a neuter noun
// (стіл, вікно) the two are the same and nothing tells them apart. The
// nouns' forms come from the dictionary (gaps.ts).
//
// Nothing here imports from Svelte or reads the database, so `npm test` runs
// it.
import type { Gap, Random } from './round.ts';
import type { NounForm } from './numbers.ts';

/** The point whose sentences these are. */
export const ROLES_POINT = 'who-acc';

export const isRolesPoint = (point: string): boolean => point === ROLES_POINT;

/** A verb that takes its object in the accusative, as it is printed, and in English. */
interface Verb {
	/** Names the verb's question in i18n.ts (`practice.who.ask`). */
	key: string;
	uk: string;
	en: string;
	/** Done only by people: a dog does not feed anyone. */
	people?: boolean;
}

/**
 * Left out: чекати, which takes the genitive as often as the accusative
 * (чекаю відповіді), and слухати and дивитися, which want на or the
 * genitive in much of what is said.
 */
export const VERBS: readonly Verb[] = [
	{ key: 'see', uk: 'бачить', en: 'sees' },
	{ key: 'hear', uk: 'чує', en: 'hears' },
	{ key: 'call', uk: 'кличе', en: 'is calling' },
	{ key: 'look', uk: 'шукає', en: 'is looking for' },
	{ key: 'love', uk: 'любить', en: 'loves' },
	{ key: 'feed', uk: 'годує', en: 'is feeding', people: true }
];

/** A living being, and its English. */
interface Being {
	word: string;
	en: string;
	person: boolean;
}

const beings = (person: boolean, words: Record<string, string>): Being[] =>
	Object.entries(words).map(([word, en]) => ({ word, en, person }));

export const BEINGS: readonly Being[] = [
	...beings(true, {
		мама: 'mother', тато: 'father', брат: 'brother', сестра: 'sister', син: 'son', дочка: 'daughter',
		бабуся: 'grandmother', дід: 'grandfather', лікар: 'doctor', учитель: 'teacher', сусід: 'neighbour',
		сусідка: 'neighbour', хлопець: 'boy', дівчина: 'girl'
	}),
	...beings(false, { кіт: 'cat', собака: 'dog', кінь: 'horse', вовк: 'wolf', лисиця: 'fox', корова: 'cow' })
];

/** A sentence drawn, before the nouns' forms are known. */
export interface RolesDraw {
	point: string;
	verb: Verb;
	doer: Being;
	done: Being;
	/** The doer comes last: Собаку бачить кіт. */
	doerLast: boolean;
}

/** How many different sentences there are: each verb with each pair of beings that fits it, in either order. */
export function rolesCount(): number {
	return VERBS.reduce(
		(sum, verb) => sum + BEINGS.filter((doer) => !verb.people || doer.person).length * (BEINGS.length - 1) * 2,
		0
	);
}

/**
 * A verb and two beings. A being already in `taken` is passed over while
 * others are left, so a round does not keep asking about the cat.
 */
export function drawRoles(random: Random, taken: Set<string>): RolesDraw {
	const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
	const fresh = (list: readonly Being[]) => {
		const free = list.filter((being) => !taken.has(being.word));
		return free.length ? free : list;
	};
	const verb = pick(VERBS);
	const doer = pick(fresh(BEINGS.filter((being) => !verb.people || being.person)));
	const done = pick(fresh(BEINGS.filter((being) => being !== doer)));
	taken.add(doer.word);
	taken.add(done.word);
	return { point: ROLES_POINT, verb, doer, done, doerLast: random() < 0.5 };
}

const STRESS = '́';

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The singular form of `kase` with stress, or undefined where the dictionary has none. */
function formOf(forms: readonly NounForm[], kase: string): NounForm | undefined {
	return forms.find((form) => {
		const tags: string[] = JSON.parse(form.tags);
		return tags.includes(kase) && tags.includes('singular');
	});
}

/** A noun as the sentence has it: where it stands, and its dictionary form. */
export interface Role {
	word: string;
	headword: string;
	start: number;
	length: number;
}

/**
 * The sentence as a round asks it, or null where the dictionary lacks a
 * form wanted or has the accusative the same as the nominative. The gap's
 * own noun (`start`, `answer`, `word`) is the one done to, as that is the
 * one whose ending changed; `roles.doer` is the other.
 */
export function rolesGap(
	draw: RolesDraw,
	doer: { word: string; headword: string; forms: readonly NounForm[] },
	done: { word: string; headword: string; forms: readonly NounForm[] }
): Gap | null {
	const subject = formOf(doer.forms, 'nominative');
	const object = formOf(done.forms, 'accusative');
	const objectAsSubject = formOf(done.forms, 'nominative');
	if (!subject || !object || !objectAsSubject || object.plain === objectAsSubject.plain) return null;

	const first = (draw.doerLast ? object : subject).form.replaceAll(STRESS, '');
	const last = (draw.doerLast ? subject : object).form.replaceAll(STRESS, '');
	const uk = `${capital(first)} ${draw.verb.uk} ${last}.`;
	const lastAt = uk.length - 1 - last.length;
	const at = (role: 'doer' | 'done') => ((role === 'doer') === draw.doerLast ? lastAt : 0);

	return {
		point: draw.point,
		uk,
		en: `The ${draw.doer.en} ${draw.verb.en} the ${draw.done.en}.`,
		start: at('done'),
		length: (draw.doerLast ? first : last).length,
		answer: object.form,
		also: [],
		number: 'singular',
		word: done.word,
		headword: done.headword,
		choices: [],
		forms: [...new Set(done.forms.map((form) => form.plain))],
		tatoeba_id: 0,
		kind: 'who',
		roles: {
			verb: draw.verb.key,
			doer: { word: doer.word, headword: doer.headword, start: at('doer'), length: subject.form.replaceAll(STRESS, '').length }
		}
	};
}
