// The grammar words the site shows, and what stands beside each to help a
// learner who has not met it: a Ukrainian hint (feminine: вона), an example,
// and the plainer name of a form (a stored "adjective, relational" is shown as
// "related adjective"). The names and explanations themselves are interface
// text, in i18n.ts (`grammar`); Term.svelte and the /grammar page show them.
//
// Nothing here imports from Svelte, so `npm test` can run it.
import { orderedTags } from './labels.ts';

/** Every term, in the order the guide page lists them. */
export const GROUPS = {
	pos: [
		'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'numeral', 'preposition', 'conjunction',
		'particle', 'interjection', 'determiner'
	],
	gender: ['masculine', 'feminine', 'neuter'],
	animacy: ['inanimate', 'animate', 'person', 'animal', 'common-gender'],
	number: ['singular', 'plural', 'plural-only', 'countable', 'uncountable', 'collective', 'indeclinable'],
	cases: ['declension', 'nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'locative', 'vocative'],
	verbs: [
		'conjugation', 'imperfective', 'perfective', 'infinitive', 'first-person', 'second-person',
		'third-person', 'imperative', 'transitive', 'intransitive', 'impersonal', 'participle',
		'adverbial-participle'
	],
	words: [
		'comparative', 'superlative', 'relational', 'predicative', 'diminutive', 'augmentative', 'derived', 'same-root'
	],
	usage: ['colloquial', 'dialectal', 'dated', 'archaic', 'figurative', 'slang']
} as const;

export type Group = keyof typeof GROUPS;
export type TermId = (typeof GROUPS)[Group][number];

export const TERMS: TermId[] = Object.values(GROUPS).flat();
const IS_TERM = new Set<string>(TERMS);

/** The seven, in the order of a declension table. */
export const CASES: TermId[] = GROUPS.cases.slice(1);

// A tag or a part of speech as the database spells it, where that is not the
// term's own name.
const TERM_OF: Record<string, TermId> = {
	adj: 'adjective', adv: 'adverb', pron: 'pronoun', num: 'numeral', prep: 'preposition',
	conj: 'conjunction', intj: 'interjection', det: 'determiner',
	personal: 'person', 'animal-not-person': 'animal', 'by-personal-gender': 'common-gender',
	figuratively: 'figurative'
};

/** The term that explains a grammar tag or a part of speech, if there is one. */
export function termOf(tag: string): TermId | undefined {
	return TERM_OF[tag] ?? (IS_TERM.has(tag) ? (tag as TermId) : undefined);
}

// A hint in Ukrainian, the same in both interface languages. A gender is
// known by its pronoun (кава is "вона"), and a case by the question it
// answers, which is how Ukrainian schools teach them. The vocative answers
// no question.
export const HINTS: Partial<Record<TermId, string>> = {
	masculine: 'він', feminine: 'вона', neuter: 'воно', plural: 'вони',
	nominative: 'хто? що?', genitive: 'кого? чого?', dative: 'кому? чому?', accusative: 'кого? що?',
	instrumental: 'ким? чим?', locative: 'на кому? на чому?'
};

// One example for each term that can be shown and not only described. Every
// word is in the dictionary (tests/grammar.test.ts checks), written without
// stress marks.
export const EXAMPLES: Partial<Record<TermId, { uk: string; en: string }>> = {
	noun: { uk: 'кава, брат, місто', en: 'coffee, brother, city' },
	verb: { uk: 'читати: я читаю, ти читаєш', en: 'to read: I read, you read' },
	adjective: { uk: 'новий дім, нова книга, нове місто', en: 'a new house, a new book, a new city' },
	adverb: { uk: 'добре, завтра, тут', en: 'well, tomorrow, here' },
	pronoun: { uk: 'я, ти, він, вона, цей', en: 'I, you, he, she, this' },
	numeral: { uk: 'один стіл, два столи, шість столів', en: 'one table, two tables, six tables' },
	preposition: { uk: 'у місті, з братом, для брата', en: 'in the city, with a brother, for a brother' },
	conjunction: { uk: 'і, але, бо, що', en: 'and, but, because, that' },
	particle: { uk: 'не, чи, би', en: 'not, whether, would' },
	interjection: { uk: 'привіт, ну, гей', en: 'hi, well, hey' },
	determiner: { uk: 'цей день, такий брат, кілька книг', en: 'this day, such a brother, a few books' },
	masculine: { uk: 'новий стіл, мій брат', en: 'a new table, my brother' },
	feminine: { uk: 'нова книга, моя сестра', en: 'a new book, my sister' },
	neuter: { uk: 'нове місто, синє море', en: 'a new city, a blue sea' },
	inanimate: { uk: 'бачу стіл, бачу столи', en: 'I see a table, I see tables' },
	animate: { uk: 'бачу брата, бачу братів', en: 'I see a brother, I see brothers' },
	person: { uk: 'бачу брата, бачу сестер', en: 'I see a brother, I see sisters' },
	animal: { uk: 'бачу кота, бачу котів', en: 'I see a cat, I see cats' },
	'common-gender': { uk: 'сирота, листоноша', en: 'orphan, letter carrier' },
	singular: { uk: 'книга', en: 'a book' },
	plural: { uk: 'книги, двері', en: 'books, a door' },
	'plural-only': { uk: 'двері, гроші', en: 'a door, money' },
	countable: { uk: 'одна книга, дві книги', en: 'one book, two books' },
	uncountable: { uk: 'вода, молоко', en: 'water, milk' },
	collective: { uk: 'листя, молодь', en: 'leaves, young people' },
	indeclinable: { uk: 'кіно, метро, таксі', en: 'cinema, metro, taxi' },
	declension: { uk: 'книга, книги, книзі, книгу', en: 'book: nominative, genitive, dative, accusative' },
	nominative: { uk: 'Брат читає.', en: 'The brother is reading.' },
	genitive: { uk: 'немає брата, чашка кави', en: 'there is no brother, a cup of coffee' },
	dative: {
		uk: 'Я даю книгу братові. Братові десять років.',
		en: 'I give the book to my brother. My brother is ten years old.'
	},
	accusative: { uk: 'Я читаю книгу.', en: 'I am reading a book.' },
	instrumental: { uk: 'пишу ручкою, з братом', en: 'I write with a pen, with my brother' },
	locative: { uk: 'у місті, на столі', en: 'in the city, on the table' },
	vocative: { uk: 'Брате! Мамо!', en: 'Brother! Mum!' },
	conjugation: { uk: 'я читаю, ти читаєш, вони читають', en: 'I read, you read, they read' },
	imperfective: { uk: 'Я читав книгу.', en: 'I was reading a book.' },
	perfective: { uk: 'Я прочитав книгу. Я прочитаю книгу.', en: 'I read the book to the end. I will read the book.' },
	infinitive: { uk: 'читати, писати', en: 'to read, to write' },
	'first-person': { uk: 'я читаю, ми читаємо', en: 'I read, we read' },
	'second-person': { uk: 'ти читаєш, ви читаєте', en: 'you read (one person, several people)' },
	'third-person': { uk: 'вона читає, вони читають', en: 'she reads, they read' },
	imperative: { uk: 'Читай! Читайте! Читаймо!', en: 'Read! Read! (several people, or politely) Let’s read!' },
	transitive: { uk: 'читати книгу', en: 'to read a book' },
	intransitive: { uk: 'спати, іти', en: 'to sleep, to go' },
	impersonal: { uk: 'Темніє. Книгу прочитано.', en: 'It is getting dark. The book has been read.' },
	participle: { uk: 'відчинене вікно', en: 'an opened window' },
	'adverbial-participle': { uk: 'читаючи, прочитавши', en: 'while reading, having read' },
	comparative: { uk: 'новий, новіший', en: 'new, newer' },
	superlative: { uk: 'найновіший', en: 'the newest' },
	relational: { uk: 'кава, кавовий', en: 'coffee, of coffee' },
	predicative: { uk: 'Мені холодно. Треба йти.', en: 'I am cold. It is time to go.' },
	diminutive: { uk: 'кіт, котик', en: 'cat, kitty' },
	augmentative: { uk: 'великий, величезний', en: 'big, huge' },
	derived: { uk: 'читати, читач, читанка', en: 'to read, reader, reading book' },
	'same-root': { uk: 'вода, підводний', en: 'water, underwater' }
};

/** One part of the line under a headword: a tag, and the term that explains it. */
export interface Part {
	tag: string;
	term?: TermId;
	/** Shown after the name, in brackets: feminine (вона) */
	hint?: string;
}

// What a noun is (a thing, a person, an animal) matters for one case only, so
// a search result leaves it out.
const ANIMACY = new Set(['inanimate', 'animate', 'person', 'personal', 'animal-not-person']);

/** An entry's grammar tags in reading order: gender, then animacy, then number. */
export function entryParts(tags: string[], brief = false): Part[] {
	const parts: Part[] = [];
	for (const tag of orderedTags(tags)) {
		if (brief && ANIMACY.has(tag)) continue;
		const term = termOf(tag);
		// "person" and "personal" are one word to a reader
		if (term && parts.some((part) => part.term === term)) continue;
		parts.push({ tag, term, hint: term && HINTS[term] });
	}
	return parts;
}

/** The names a form beside the headword can go under (i18n.ts `grammar.headForms`). */
export type HeadFormKey =
	| 'genitive' | 'plural' | 'genitivePlural'
	| 'relatedAdjective' | 'relatedAdverb' | 'relatedNoun'
	| 'perfectivePartner' | 'imperfectivePartner' | 'feminineForm' | 'masculineForm'
	| 'also' | 'diminutive' | 'augmentative' | 'comparative' | 'superlative' | 'uppercase' | 'lowercase';

/** The names of the verb forms that stand outside the tables (`grammar.otherForms`). */
export type OtherFormKey =
	| 'infinitive' | 'presentAdverbial' | 'pastAdverbial' | 'impersonalPast'
	| 'presentActive' | 'pastActive' | 'presentPassive' | 'pastPassive';

export interface FormLabel<Key> {
	/** The name to show; null when no name fits and the tags are shown as they are. */
	key: Key | null;
	term?: TermId;
	/** Tags the name does not cover, shown after it in brackets: also (dialectal) */
	extra: string[];
}

// [the tags a name stands for, the name, the term behind it]. The first row
// whose tags are all present wins, so a longer row stands before a shorter one
// it contains.
const HEAD_FORMS: [tags: string[], key: HeadFormKey, term?: TermId][] = [
	// The headword again with another stress (за́гадка, зага́дка) or spelling.
	// Wiktionary repeats the gender and animacy on these; the line already has them.
	[['canonical'], 'also'],
	[['alternative'], 'also'],
	[['variant'], 'also'],
	[['adjective', 'relational'], 'relatedAdjective', 'relational'],
	[['adjective'], 'relatedAdjective', 'adjective'],
	[['abstract-noun'], 'relatedNoun', 'noun'],
	[['adverb'], 'relatedAdverb', 'adverb'],
	[['genitive', 'plural'], 'genitivePlural', 'genitive'],
	[['nominative', 'plural'], 'plural', 'plural'],
	[['genitive'], 'genitive', 'genitive'],
	[['perfective'], 'perfectivePartner', 'perfective'],
	[['imperfective'], 'imperfectivePartner', 'imperfective'],
	[['diminutive'], 'diminutive', 'diminutive'],
	[['augmentative'], 'augmentative', 'augmentative'],
	[['comparative'], 'comparative', 'comparative'],
	[['superlative'], 'superlative', 'superlative'],
	// жук, жучи́ха: the word for the female, or for the male
	[['feminine'], 'feminineForm', 'feminine'],
	[['masculine'], 'masculineForm', 'masculine'],
	[['uppercase'], 'uppercase'],
	[['lowercase'], 'lowercase']
];

/**
 * Where a word's page puts a form named beside the headword. A case form
 * (води́, вод) is in the table already, when there is one; a word made from
 * the headword (водяни́й, води́ця) goes with the related words; the rest (the
 * aspect partner, another spelling) stays on the grammar line.
 */
export function headFormPlace(tags: string[], hasTables: boolean): 'line' | 'table' | 'related' {
	const { key } = headFormLabel(tags);
	if (key && RELATED_HEAD_FORMS.includes(key)) return 'related';
	if (hasTables && (key === 'genitive' || key === 'plural' || key === 'genitivePlural')) return 'table';
	return 'line';
}

/** The head forms listed with the related words, in the order of their rows there. */
export const RELATED_HEAD_FORMS: HeadFormKey[] = [
	'relatedAdjective', 'diminutive', 'relatedNoun', 'relatedAdverb', 'augmentative'
];

/** The note behind the name of each of those rows (Adjectives opens "Relational adjective"). */
export const RELATED_ROW_TERMS: Partial<Record<HeadFormKey, TermId>> = {
	relatedAdjective: 'relational', diminutive: 'diminutive', relatedNoun: 'noun', relatedAdverb: 'adverb',
	augmentative: 'augmentative'
};

const REPEATED_ON_CANONICAL = new Set([
	'masculine', 'feminine', 'neuter', 'singular', 'plural', 'perfective', 'imperfective', ...ANIMACY
]);

/**
 * What to call a form that stands beside the headword. The database keeps
 * Wiktionary's tags ("adjective, relational"); a learner reads "related
 * adjective".
 */
export function headFormLabel(tags: string[]): FormLabel<HeadFormKey> {
	// A form with no tags is the headword in Latin letters (два́дцять оди́н,
	// dvádcjatʹ odýn): it stands beside the headword with no name, as it always has
	if (!tags.length) return { key: null, extra: [] };
	for (const [need, key, term] of HEAD_FORMS) {
		if (!need.every((tag) => tags.includes(tag))) continue;
		let extra = tags.filter((tag) => !need.includes(tag) && tag !== 'singular');
		if (key === 'also') extra = extra.filter((tag) => !REPEATED_ON_CANONICAL.has(tag) && tag !== 'alternative');
		return { key, term, extra };
	}
	return { key: null, extra: tags };
}

const OTHER_FORMS: [tags: string[], key: OtherFormKey, term: TermId][] = [
	[['infinitive'], 'infinitive', 'infinitive'],
	[['adverbial', 'present'], 'presentAdverbial', 'adverbial-participle'],
	[['adverbial', 'past'], 'pastAdverbial', 'adverbial-participle'],
	// прочи́тано: before the participles, because it is tagged "passive, past" too
	[['impersonal', 'past'], 'impersonalPast', 'impersonal'],
	[['active', 'present'], 'presentActive', 'participle'],
	[['active', 'past'], 'pastActive', 'participle'],
	[['passive', 'present'], 'presentPassive', 'participle'],
	[['passive', 'past'], 'pastPassive', 'participle']
];

// Said elsewhere on the page (the aspect is beside the headword), or noise.
const HIDDEN_TAGS = new Set(['imperfective', 'perfective', 'pronoun', 'personal']);

/** The tags that tell a form outside the tables from the others. */
export function shownTags(tags: string[]): string[] {
	const shown = tags.filter((tag) => !HIDDEN_TAGS.has(tag));
	return shown.length ? shown : tags;
}

/** What to call a form that fits no table cell: "adverbial, past" is the past adverbial participle. */
export function otherFormLabel(tags: string[]): FormLabel<OtherFormKey> {
	const shown = shownTags(tags);
	for (const [need, key, term] of OTHER_FORMS) {
		if (!need.every((tag) => shown.includes(tag))) continue;
		const covered = new Set([...need, 'participle', 'passive']);
		return { key, term, extra: shown.filter((tag) => !covered.has(tag)) };
	}
	return { key: null, extra: shown };
}

// The labels of the form tables (forms.ts), which are English text, to the
// terms that explain them.
const TERM_OF_LABEL: Record<string, TermId> = {
	Declension: 'declension', Imperative: 'imperative',
	Nominative: 'nominative', Genitive: 'genitive', Dative: 'dative', Accusative: 'accusative',
	Instrumental: 'instrumental', Locative: 'locative', Vocative: 'vocative',
	Singular: 'singular', Plural: 'plural',
	Masculine: 'masculine', Feminine: 'feminine', Neuter: 'neuter',
	'1st person': 'first-person', '2nd person': 'second-person', '3rd person': 'third-person',
	'2nd person singular': 'second-person', '1st person plural': 'first-person',
	'2nd person plural': 'second-person'
};

export function termOfLabel(label: string): TermId | undefined {
	return TERM_OF_LABEL[label];
}

const PERSON_PRONOUNS: Record<string, [singular: string, plural: string]> = {
	'first-person': ['я', 'ми'],
	'second-person': ['ти', 'ви'],
	'third-person': ['він/вона', 'вони']
};

/**
 * The pronoun that goes with a verb form, from the tags of its table cell:
 * я with the first person singular, вона with the feminine past. A learner
 * who does not know "1st person" knows "я".
 */
export function pronounFor(tags: string[]): string | undefined {
	const plural = tags.includes('plural');
	for (const [person, [one, many]] of Object.entries(PERSON_PRONOUNS)) {
		if (!tags.includes(person)) continue;
		const pronoun = plural ? many : one;
		// A command is said without its pronoun: (ти) чита́й
		return tags.includes('imperative') ? `(${pronoun})` : pronoun;
	}
	if (!tags.includes('past')) return undefined;
	if (plural) return 'вони';
	return HINTS[tags.find((tag) => tag === 'masculine' || tag === 'feminine' || tag === 'neuter') as TermId];
}
