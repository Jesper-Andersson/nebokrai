// The grammar-point pages (/grammar/<lesson>): what each lesson of the
// practice page (lessons.ts) explains before its first round, and the page on
// the present tense that comes before the verbs' lessons. They follow the
// shape of a grammar wiki's page: a short lead, the pattern with its endings,
// examples with the part that changes marked, then what trips learners up.
//
// Why a page before the practice: explaining a rule outright helps adults
// more than leaving them to find it (Norris & Ortega 2000; Spada & Tomita
// 2010), but the practice does most of the work (VanPatten & Oikkenon 1996),
// so each page is kept short and ends in its round. A learner who has started
// a lesson goes straight to the round (lessonHref in lessons.ts).
//
// The text is English only, in either interface language (user,
// 2026-11-18): the Ukrainian a learner needs is in the examples. Ukrainian
// inside it is written in braces, and the part that changes in square brackets inside
// them: {у міст[і]} prints у місті in the reading face with і marked.
//
// Nothing here imports from Svelte, so `npm test` can run it.

import { LESSONS, type LessonGroup } from './lessons.ts';
import { POINTS, type PointCase } from './points.ts';
import type { PointState } from './round.ts';

/** The CEFR levels the grammar points reach: the first three of six. */
export const LEVELS = ['A1', 'A2', 'B1'] as const;
export type Level = (typeof LEVELS)[number];

/**
 * Where the levels come from: the National Commission for the Standards of
 * the State Language's standard of 2024, which lists for A1 to C2 what each
 * case means with and without each preposition, with examples.
 */
export const LEVEL_SOURCE = {
	title: 'Standard of the State Language: Ukrainian as a Foreign Language, A1–C2 (2024)',
	url: 'https://mova.gov.ua/diyalnist-i-proyekti/termini/standart-derzhavnoi-movy-ukrainska-mova-iak-inozemna-rivni-zahalnoho-volodinnia-a1-s2'
};

export interface Source {
	/** The site and the page: Wiktionary: на. */
	title: string;
	url: string;
}

export interface Note {
	/** Empty where the note goes on from the one before it. */
	title: string;
	body: string;
}

export interface Intro {
	/** The lesson's id (lessons.ts), or `present-tense`. */
	id: string;
	/** The page's heading: what the lesson lets you say. */
	title: string;
	/** The pattern in a line, as the index of grammar points lists it. */
	pattern: string;
	/** A short example for the index, marked as the text is. */
	example: string;
	lead: string;
	notes: readonly Note[];
	/**
	 * The CEFR level of the point's core rule, from the 2024 State Standard of
	 * Ukrainian as a foreign language (LEVEL_SOURCE), where its case and
	 * preposition lists name it. A later part of the point is named in
	 * `levelNote`: до + genitive is A2 in a point that starts at A1.
	 */
	level: Level;
	/** The Standard does not list it (it has no list of verbs and their cases): a judgement from the levels around it. */
	levelEstimated?: boolean;
	levelNote?: string;
	/** One or two public pages that state the rule, for checking it and reading on. */
	sources: readonly Source[];
	/** How many notes come before the examples; the rest come after. None by default. */
	notesFirst?: number;
}

/** The page before the verbs' lessons, which is not a lesson of its own. */
export const PRESENT_TENSE = 'present-tense';

const note = (title: string, body: string): Note => ({ title, body });

const PRESENT_NOTE = note(
	'The verb changes too',
	'The verb comes in the я form, as {дивл[ю]ся} or {чека[ю]}. The page on the present tense shows how it changes for each person.'
);

/**
 * The references each page cites: public grammar pages a learner can read on
 * (Read Ukrainian!, Ukrainian Lessons, Wiktionary, Wikipedia). Each was opened
 * and checked against the page that cites it on 2026-11-18. Nothing is copied
 * from them; they are named so a rule can be checked.
 */
const SOURCES = {
	'euphony': { title: 'Ukrainian Lessons: у and в, з, із and зі', url: 'https://www.ukrainianlessons.com/euphony-in-ukrainian/' },
	'wikt-u': { title: 'Wiktionary: у', url: 'https://en.wiktionary.org/wiki/у' },
	'ru16-6': { title: 'Read Ukrainian! 16.6: Places and cases', url: 'https://ukrainianlanguage.org.uk/read/unit16/page16-6.htm' },
	'ul-acc': { title: 'Ukrainian Lessons: The accusative case', url: 'https://www.ukrainianlessons.com/accusativecase/' },
	'ru7-4': { title: 'Read Ukrainian! 7.4: The accusative', url: 'https://ukrainianlanguage.org.uk/read/unit07/page7-4.htm' },
	'ul-prep': { title: 'Ukrainian Lessons: Prepositions and cases', url: 'https://www.ukrainianlessons.com/prepositions-cases/' },
	'wp-grammar': { title: 'Wikipedia: Ukrainian grammar', url: 'https://en.wikipedia.org/wiki/Ukrainian_grammar' },
	'ul-money': { title: 'Ukrainian Lessons: гривня, гривні, гривень', url: 'https://www.ukrainianlessons.com/ukrainian-currency/' },
	'ru16-4': { title: 'Read Ukrainian! 16.4: Cases with prepositions (1)', url: 'https://ukrainianlanguage.org.uk/read/unit16/page16-4.htm' },
	'wp-loc': { title: 'Вікіпедія: Місцевий відмінок', url: 'https://uk.wikipedia.org/wiki/Місцевий_відмінок' },
	'ru16-5': { title: 'Read Ukrainian! 16.5: Cases with prepositions (2)', url: 'https://ukrainianlanguage.org.uk/read/unit16/page16-5.htm' },
	'wikt-chekaty': { title: 'Wiktionary: чекати', url: 'https://en.wiktionary.org/wiki/чекати' },
	'wikt-na': { title: 'Wiktionary: на', url: 'https://en.wiktionary.org/wiki/на' },
	'ru14-7': { title: 'Read Ukrainian! 14.7: Verbs and cases', url: 'https://ukrainianlanguage.org.uk/read/unit14/page14-7.htm' },
	'wikt-korystuvatysia': { title: 'Wiktionary: користуватися', url: 'https://en.wiktionary.org/wiki/користуватися' },
	'wikt-diakuvaty': { title: 'Wiktionary: дякувати', url: 'https://en.wiktionary.org/wiki/дякувати' },
	'ru7-5': { title: 'Read Ukrainian! 7.5: The dative', url: 'https://ukrainianlanguage.org.uk/read/unit07/page7-5.htm' },
	'wikt-hraty': { title: 'Wiktionary: грати', url: 'https://en.wiktionary.org/wiki/грати' },
	'wikt-zustrichatysia': { title: 'Wiktionary: зустрічатися', url: 'https://en.wiktionary.org/wiki/зустрічатися' },
	'wikt-sumuvaty': { title: 'Wiktionary: сумувати', url: 'https://en.wiktionary.org/wiki/сумувати' },
	'wikt-stezhyty': { title: 'Wiktionary: стежити', url: 'https://en.wiktionary.org/wiki/стежити' },
	'ru10-3': { title: 'Read Ukrainian! 10.3: The first conjugation', url: 'https://ukrainianlanguage.org.uk/read/unit10/page10-3.htm' },
	'ru10-4': { title: 'Read Ukrainian! 10.4: The second conjugation', url: 'https://ukrainianlanguage.org.uk/read/unit10/page10-4.htm' },
} satisfies Record<string, Source>;

export const INTROS: readonly Intro[] = [
	{
		id: 'where',
		level: 'A1',
		sources: [SOURCES['euphony'], SOURCES['wikt-u']],
		title: 'Where something is: у and на',
		pattern: 'у / на + locative',
		example: '{у міст[і]}, {на стол[і]}',
		lead: 'To say where something is, use у (в) or на with the locative case: {у міст[і]}, {на стол[і]}. Use у for inside something, and на for on a surface, and for open places and events.',
		notes: [
			note(
				'у or в?',
				'They mean the same, and the choice is for sound. в usually comes after a vowel: {Вона в місті}. у comes after a consonant, and at the start of a sentence before a consonant: {Він у місті}. Before в or ф, and before clusters such as льв, св and тв, у is used either way: {Вона у Франції}, {Вона у Львові}.'
			),
			note(
				'на for places you go to do something',
				'Many places and events take на where English says at or in: {на робот[і]}, {на пошт[і]}, {на концерт[і]}.'
			)
		]
	},
	{
		id: 'where-to',
		level: 'A1',
		levelNote: 'до + genitive: A2.',
		sources: [SOURCES['ru16-6'], SOURCES['ul-acc']],
		title: 'Where something goes: у, на and до',
		pattern: 'у / на + accusative; до + genitive',
		example: '{у школ[у]}, {до школ[и]}',
		lead: 'To say where something goes, use у (в) or на with the accusative case: {у школ[у]}, {на робот[у]}. до takes the genitive and means to, as far as, or to a person: {до школ[и]}, {до Києв[а]}, {до лікар[я]}.',
		notes: [
			note(
				'де? or куди?',
				'The same у and на answer two questions. де? (where?) takes the locative: {у міст[і]}. куди? (where to?) takes the accusative: {у місто}.'
			),
			note(
				'Many words do not change',
				'Masculine and neuter things keep their dictionary form in the accusative: {у місто}, {на стіл}. Feminine words in -а or -я change: {на робот[у]}.'
			)
		]
	},
	{
		id: 'who-whom',
		level: 'A1',
		sources: [SOURCES['ru7-4'], SOURCES['ul-acc']],
		title: 'Who does what to whom',
		pattern: 'the one acted on takes the accusative',
		example: '{собак[у] бачить кіт}',
		lead: 'Ukrainian word order is free, so the ending shows who does what, not the order. The one the action is done to takes the accusative: {Собак[у] бачить кіт} means the cat sees the dog.',
		notes: [
			note(
				'Which words change',
				'Feminine words in -а or -я change: {мама → мам[у]}. Masculine living beings take -а or -я: {кіт → кот[а]}. Masculine things keep their form: {стіл}.'
			)
		]
	},
	{
		id: 'with-from',
		level: 'A2',
		levelNote: 'від + genitive: B1.',
		sources: [SOURCES['ul-prep'], SOURCES['euphony']],
		title: 'With and from: з and від',
		pattern: 'з + instrumental or genitive; від + genitive',
		example: '{з друг[ом]}, {від мам[и]}',
		lead: 'з (із, зі) with the instrumental means together with: {з друг[ом]}. With the genitive it means out of or down from: {з міст[а]}. від takes the genitive for from a person or a starting point: {від мам[и]}.',
		notes: [
			note(
				'з, із or зі?',
				'з is the usual one. із comes between two consonants, and зі before з, с, ш or щ followed by another consonant: {зі школ[и]}, and in {зі мною}.'
			)
		]
	},
	{
		id: 'numbers',
		level: 'A2',
		sources: [SOURCES['wp-grammar'], SOURCES['ul-money']],
		title: 'Counting things',
		pattern: '1 · 2–4 · 5 and up decide the noun’s form',
		example: '{2 книг[и]}, {5 книг}',
		lead: 'The number decides the form of the noun. 1, 21, 31… take the dictionary form: {1 книга}. 2, 3 and 4 take the plural: {2 книг[и]}. 5 and above take the genitive plural: {5 книг}.',
		notes: [
			note(
				'11 to 14',
				'11, 12, 13 and 14 go with 5 and above, not with 1 to 4: {12 книг}, {14 студент[ів]}. It is the last number said that counts: {22 книг[и]}, {25 книг}.'
			)
		]
	},
	{
		id: 'for-about',
		level: 'A2',
		levelNote: 'про: A1; без, and за + accusative: B1.',
		sources: [SOURCES['ru16-4'], SOURCES['ul-prep']],
		title: 'For, without and about',
		pattern: 'для, без + genitive; про, за + accusative',
		example: '{без цукр[у]}, {про книг[у]}',
		lead: 'для (for) and без (without) take the genitive: {для теб[е]}, {без цукр[у]}. про (about) and за (for, in exchange for) take the accusative: {про книг[у]}, {за кав[у]}.',
		notes: [
			note(
				'за has two meanings',
				'With the accusative, за is what you pay or thank for: {дякую за кав[у]}. With the instrumental it means behind or beyond, as in the lesson on what is nearby: {за міст[ом]}.'
			)
		]
	},
	{
		id: 'before-after',
		level: 'A2',
		levelNote: 'через: B1; після is not listed.',
		sources: [SOURCES['ul-prep'], SOURCES['ru16-4']],
		title: 'Before, after and across',
		pattern: 'після + genitive; перед + instrumental; через + accusative',
		example: '{після робот[и]}',
		lead: 'після (after) takes the genitive: {після робот[и]}. перед (before, in front of) takes the instrumental: {перед дом[ом]}. через takes the accusative and means across, or in so much time: {через міст}, {через годин[у]}.',
		notes: []
	},
	{
		id: 'around',
		level: 'A2',
		levelNote: 'серед: B1.',
		sources: [SOURCES['ul-prep'], SOURCES['wp-loc']],
		title: 'What is nearby',
		pattern: 'біля, серед + genitive; за, між + instrumental; по + locative',
		example: '{біля дом[у]}',
		lead: 'біля (by) and серед (among) take the genitive: {біля дом[у]}, {серед друз[ів]}. за (behind, beyond) and між (between) take the instrumental: {за міст[ом]} (out of town), {між нам[и]}. по (around, along) takes the locative: {по вулиц[і]}.',
		notes: []
	},
	{
		id: 'above-below',
		level: 'A2',
		levelNote: 'під + accusative of motion: B2; проти is not listed.',
		sources: [SOURCES['ru16-5'], SOURCES['ul-prep']],
		title: 'Above, below and against',
		pattern: 'над, під + instrumental; проти + genitive',
		example: '{під стол[ом]}',
		lead: 'над (above) and під (under) take the instrumental for where something is: {над стол[ом]}, {під стол[ом]}. проти (against) takes the genitive: {проти вітр[у]}.',
		notes: [
			note(
				'під for where something goes',
				'Asked куди? (where to?), під takes the accusative, as у and на do: {Кіт заліз під стіл}, the cat crawled under the table.'
			)
		]
	},
	{
		id: 'gov-na-acc',
		level: 'A2',
		levelEstimated: true,
		sources: [SOURCES['wikt-chekaty'], SOURCES['wikt-na']],
		title: 'Looking, waiting, hoping: на + accusative',
		pattern: 'verb + на що? на кого?',
		example: '{дивлюся на мор[е]}',
		lead: 'Some verbs need на with the accusative where English says at, for or on: {дивлюся на мор[е]}, {чекаю на автобус}, {сподіваюся на допомог[у]}. Learn each verb together with its question, на що? or на кого?',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-ins',
		level: 'A2',
		sources: [SOURCES['ru14-7'], SOURCES['wikt-korystuvatysia']],
		title: 'Jobs, transport, hobbies: the instrumental',
		pattern: 'verb + чим? ким?',
		example: '{працюю лікар[ем]}',
		lead: 'These verbs take a noun in the instrumental with no preposition: {працюю лікар[ем]}, {їду автобус[ом]}, {користуюся телефон[ом]}. English needs as or by here, or nothing at all (use a phone); Ukrainian says it with the ending alone.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-gen',
		level: 'B1',
		levelNote: 'боятися, уникати and досягати are not listed.',
		sources: [SOURCES['ru14-7']],
		title: 'Fear, need, avoiding: the genitive',
		pattern: 'verb + чого? кого?',
		example: '{боюся темряв[и]}',
		lead: 'These verbs take the genitive: {боюся темряв[и]}, {потребую допомог[и]}, {уникаю конфлікт[у]}. English mostly puts the noun straight after the verb (need help, avoid conflict), so the case is easy to miss.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-dat',
		level: 'A2',
		sources: [SOURCES['wikt-diakuvaty'], SOURCES['ru7-5']],
		title: 'Thanking, helping, liking: the dative',
		pattern: 'verb + кому?',
		example: '{дякую мам[і]}',
		lead: 'These verbs take the dative, the case for the person something is given or said to: {дякую мам[і]}, {допомагаю сусід[ові]}, {пишу брат[ові]}.',
		notes: [
			note(
				'подобатися: “it pleases me”',
				'Ukrainian says that something pleases you. The one who likes it is in the dative and usually comes first: {Мен[і] подобається музика}, I like music.'
			),
			PRESENT_NOTE
		]
	},
	{
		id: 'gov-za-acc',
		level: 'B1',
		sources: [SOURCES['ru16-5']],
		title: 'Thanking and paying for: за + accusative',
		pattern: 'verb + за що? за кого?',
		example: '{дякую за допомог[у]}',
		lead: 'за with the accusative follows verbs of thanking, paying, voting and worrying: {дякую за допомог[у]}, {плачу за квиток}, {хвилююся за син[а]}.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-u-na',
		level: 'A2',
		levelEstimated: true,
		sources: [SOURCES['wikt-hraty'], SOURCES['ru16-5']],
		title: 'Believing and playing: у and на',
		pattern: 'вірити у + accusative; грати у + accusative, на + locative',
		example: '{граю на гітар[і]}',
		lead: 'To believe in something, use вірити у (в) and the accusative: {вірю в перемог[у]}. To play a game, use грати у and the accusative: {граю у футбол}. To play an instrument, use грати на and the locative: {граю на гітар[і]}.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-na-who',
		level: 'B1',
		levelEstimated: true,
		sources: [SOURCES['ru16-5'], SOURCES['ru7-4']],
		title: 'Feelings towards someone: на + accusative',
		pattern: 'verb + на кого?',
		example: '{серджуся на брат[а]}',
		lead: 'на with the accusative also follows verbs of feeling towards someone: {серджуся на брат[а]}, {ображаюся на друг[а]}, {скаржуся на шум}. Masculine people take -а or -я here.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-z-ins',
		level: 'A2',
		levelNote: 'погоджуватися з: B1.',
		sources: [SOURCES['wikt-zustrichatysia'], SOURCES['ul-prep']],
		title: 'Doing things with someone: з + instrumental',
		pattern: 'verb + з ким?',
		example: '{розмовляю з мам[ою]}',
		lead: 'Some verbs say what you do with someone. They take з and the instrumental: {розмовляю з мам[ою]}, {зустрічаюся з друг[ом]}, {погоджуюся з брат[ом]}.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-dat-more',
		level: 'B1',
		levelEstimated: true,
		sources: [SOURCES['ru14-7'], SOURCES['ru7-5']],
		title: 'Trusting, phoning, envying: more of the dative',
		pattern: 'verb + кому?',
		example: '{телефоную мам[і]}',
		lead: 'More verbs that take the dative: {довіряю лікар[еві]}, {телефоную мам[і]}, {заважаю сусід[ові]}. English says phone someone; Ukrainian phones to someone.',
		notes: [PRESENT_NOTE]
	},
	{
		id: 'gov-za-ins',
		level: 'B1',
		levelEstimated: true,
		sources: [SOURCES['wikt-sumuvaty'], SOURCES['wikt-stezhyty']],
		title: 'Missing and watching: за + instrumental',
		pattern: 'verb + за ким? за чим?',
		example: '{сумую за дом[ом]}',
		lead: 'за with the instrumental follows verbs of missing and watching over: {сумую за дом[ом]}, {стежу за погод[ою]}, {наглядаю за дитин[ою]}.',
		notes: [PRESENT_NOTE]
	},
	{
		id: PRESENT_TENSE,
		level: 'A1',
		levelNote: 'Consonant changes such as ходжу: A2.',
		sources: [SOURCES['ru10-3'], SOURCES['ru10-4']],
		notesFirst: 2,
		title: 'The present tense',
		pattern: 'stem + -ю, -єш / -иш…',
		example: '{я чита[ю]}, {ти говор[иш]}',
		lead: 'A Ukrainian verb changes its ending to say who does it: {я чита[ю]}, {ти чита[єш]}. There are two sets of endings. Most verbs ending in -ати take the first set, and most verbs ending in -ити take the second.',
		notes: [
			note(
				'Verbs ending in -увати and -ся',
				'In most verbs ending in -увати or -ювати, the -ва- disappears. The rest takes the first set: {працювати → я працю[ю], ти працю[єш]}; {дякувати → я дяку[ю]}. A few keep it: {бувати → я бува[ю]}.'
			),
			note(
				'',
				'In verbs ending in -ся, the -ся moves to after the ending: {дивитися → я дивл[ю]ся, ти див[иш]ся, ми див[имо]ся}. After -ть it is spelt -ться: {він див[ить]ся}. After a vowel you will also meet the short -сь: {я дивлюсь}.'
			),
			note(
				'Consonant changes',
				'Some verbs change their last consonant in the я form only: {ходити → ход[жу]}, {просити → про[шу]}, but {ти ход[иш]}. After б, в, м, п or ф an л is added, in the вони form too: {дивитися → я див[лю]ся, вони див[лять]ся}.'
			),
			note(
				'',
				'A few verbs ending in -ати or -яти take the second set: {спати → сп[лю], сп[иш]}; {стояти → сто[ю], сто[їш]}. A word’s page shows all its forms.'
			)
		]
	}
];

const BY_ID = new Map(INTROS.map((intro) => [intro.id, intro]));

export const introOf = (id: string): Intro | undefined => BY_ID.get(id);

/**
 * A lesson's name where there is room for only a few words: its page's title
 * up to the colon, which says what it lets you say ("Looking, waiting,
 * hoping"); the form after the colon is shown beside it as the lesson's
 * words (на що? на кого?). One name for a lesson everywhere (user,
 * 2026-11-18), in English as the pages are.
 */
export const lessonName = (id: string): string => introOf(id)?.title.split(':')[0] ?? id;

/** The address of a grammar-point page. */
export const introPath = (id: string): string => `/grammar/${id}`;

/** The lesson a rule is taught in, and so the page that explains it. */
export const lessonOfPoint = (id: string): string | undefined =>
	LESSONS.find((lesson) => lesson.points.includes(id))?.id;

/**
 * What a preposition asks for, as its word page says it: each case it takes
 * in the practice, with the lesson that explains it, in the order of the
 * rules. у gives the locative (where) and the accusative (where-to); з gives
 * two cases taught in one lesson. Any spelling counts: в as у, зі as з.
 */
export function prepositionCases(word: string): { case: PointCase; lesson: string }[] {
	const spelling = word.toLocaleLowerCase('uk');
	const out: { case: PointCase; lesson: string }[] = [];
	for (const point of POINTS) {
		if (point.kind !== 'preposition' || !point.cue.split(' / ').includes(spelling)) continue;
		const lesson = lessonOfPoint(point.id);
		if (lesson && !out.some((each) => each.case === point.case)) out.push({ case: point.case, lesson });
	}
	return out;
}

/**
 * The prepositions the points teach, each with the lessons that teach it, in
 * the order of the rules: the index's "by word" row. Learners come with a
 * word (у, до), not a case's name; у / в are one entry, as the rules print it.
 */
export function prepositionIndex(): { word: string; lessons: string[] }[] {
	const out: { word: string; lessons: string[] }[] = [];
	for (const point of POINTS) {
		if (point.kind !== 'preposition') continue;
		const lesson = lessonOfPoint(point.id);
		if (!lesson) continue;
		const entry = out.find((each) => each.word === point.cue);
		if (!entry) out.push({ word: point.cue, lessons: [lesson] });
		else if (!entry.lessons.includes(lesson)) entry.lessons.push(lesson);
	}
	return out;
}

/** The lessons with a rule that asks for this case, in the order of the lessons: the glossary's "Used in". */
export const lessonsWithCase = (kase: string): string[] =>
	LESSONS.filter((lesson) => lesson.points.some((id) => POINTS.find((point) => point.id === id)?.case === kase))
		.map((lesson) => lesson.id);

/** The index of every grammar point, for reading in any order. */
export const POINTS_PATH = '/grammar/points';

export type TopicId = 'verbs' | 'verb-cases' | 'prepositions' | 'sentences' | 'numbers';

/**
 * The grammar points as the index groups them, by what they are about, as a
 * grammar wiki groups by part of speech: the verbs' own forms, the cases verbs
 * ask for, the prepositions, how a sentence shows who does what, and the
 * numbers. Each point is in one group (a test holds this).
 */
const RAW_TOPICS: readonly { id: TopicId; points: readonly string[] }[] = [
	{ id: 'verbs', points: [PRESENT_TENSE] },
	{ id: 'verb-cases', points: LESSONS.filter((lesson) => lesson.group === 'government').map((lesson) => lesson.id) },
	{
		id: 'prepositions',
		points: LESSONS.filter((lesson) => lesson.group === 'preposition' && !['who-whom', 'numbers'].includes(lesson.id))
			.map((lesson) => lesson.id)
	},
	{ id: 'sentences', points: ['who-whom'] },
	{ id: 'numbers', points: ['numbers'] }
];

const rank = (id: string): number => LEVELS.indexOf(introOf(id)?.level ?? 'B1');

/** Each group's points from the easiest level up, the lessons' order kept within a level (sort is stable). */
export const TOPICS: readonly { id: TopicId; points: readonly string[] }[] = RAW_TOPICS.map((topic) => ({
	id: topic.id,
	points: [...topic.points].sort((a, b) => rank(a) - rank(b))
}));

/** A lesson as the path and the lesson lists know it. */
export interface LinkedLesson {
	id: string;
	group: LessonGroup;
	points: readonly { state: PointState }[];
	placed?: boolean;
}

/** Whether a lesson has been begun: a rule of it met, or the placement test passed it. */
export const begun = (lesson: LinkedLesson): boolean =>
	!!lesson.placed || lesson.points.some(({ state }) => state !== 'new');

/**
 * Where a lesson's button leads. A lesson not yet begun opens its page first;
 * a verb's lesson, while none of them is begun, opens the present tense,
 * which then leads on to it (?next=). Once begun, the round starts at once:
 * an explanation helps a learner meeting the rule and slows one who knows it.
 */
export function lessonHref(lesson: LinkedLesson, lessons: readonly LinkedLesson[]): string {
	if (begun(lesson)) return `/practice?lesson=${lesson.id}`;
	const firstVerbs = lesson.group === 'government'
		&& !lessons.some((other) => other.group === 'government' && begun(other));
	return firstVerbs ? `${introPath(PRESENT_TENSE)}?next=${lesson.id}` : introPath(lesson.id);
}

// --- The present tense's table ---

export interface Conjugation {
	/** The infinitive, and its stem with the part taken off: чита|ти. */
	infinitive: string;
	stem: string;
	cut: string;
	endings: readonly string[];
}

/** Who each row of the table is for, in the order of the endings. */
export const PERSONS = ['я', 'ти', 'він, вона', 'ми', 'ви', 'вони'] as const;

export const FIRST_SET: Conjugation = {
	infinitive: 'читати', stem: 'чита', cut: 'ти', endings: ['ю', 'єш', 'є', 'ємо', 'єте', 'ють']
};

export const SECOND_SET: Conjugation = {
	infinitive: 'говорити', stem: 'говор', cut: 'ити', endings: ['ю', 'иш', 'ить', 'имо', 'ите', 'ять']
};

/** The present tense's examples, in reading order. */
export const PRESENT_EXAMPLES: readonly { uk: string; en: string }[] = [
	{ uk: 'Я чита[ю] книжку.', en: 'I’m reading a book.' },
	{ uk: 'Ти говор[иш] українською?', en: 'Do you speak Ukrainian?' },
	{ uk: 'Вона працю[є] в школі.', en: 'She works at a school. (працювати: -ва- dropped)' },
	{ uk: 'Ми див[имо]ся фільм.', en: 'We’re watching a film. (дивитися: -ся on the end)' }
];

// --- Text with Ukrainian in it ---

export interface Part {
	text: string;
	/** Ukrainian, set in the reading face. */
	uk?: boolean;
	/** The part that changes, inside Ukrainian. */
	mark?: boolean;
	/** A case's name in English, by its glossary id (grammar.ts): shown as a term to open. */
	term?: string;
}

/**
 * A text cut into its parts: {у міст[і]} is Ukrainian, with і marked.
 * Brackets outside braces are kept as they are.
 */
export function parts(text: string): Part[] {
	const out: Part[] = [];
	const push = (part: Part) => part.text && out.push(part);
	for (const [i, piece] of text.split(/[{}]/).entries()) {
		if (i % 2 === 0) {
			push({ text: piece });
			continue;
		}
		for (const [j, bit] of piece.split(/[[\]]/).entries()) push(j % 2 ? { text: bit, uk: true, mark: true } : { text: bit, uk: true });
	}
	return out;
}

const CASE_NAMES = /\b(nominative|genitive|dative|accusative|instrumental|locative)\b/i;

/**
 * The English parts with each case's name cut out as a glossary term (its id
 * in grammar.ts), so the page can explain "locative" where it is read, as the
 * dictionary does (GOV.UK: explain a term where it is first met).
 */
export function withTerms(list: readonly Part[]): Part[] {
	const out: Part[] = [];
	for (const part of list) {
		if (part.uk || part.mark) {
			out.push(part);
			continue;
		}
		for (const [i, bit] of part.text.split(CASE_NAMES).entries()) {
			if (bit) out.push(i % 2 ? { text: bit, term: bit.toLowerCase() } : { text: bit });
		}
	}
	return out;
}

/** Ukrainian marked with [ ] alone, as an example sentence is written: Я чита[ю] книжку. */
export const markedParts = (text: string): Part[] => parts(`{${text}}`);

// --- The examples from real sentences ---

/** How the present tense's panel says to find the stem. */
export const PRESENT_HOW =
	'For an -ати verb take off -ти; for an -ити verb take off -ити. Then add the ending for the person: {читати → чита + [ю]}, {говорити → говор + [ю]}.';

/**
 * An example on a lesson's page: a sentence of the practice, the noun in it
 * marked. A sentence from Tatoeba (an id above 0) is credited and linked, as
 * its licence asks; one made from a frame has the id 0 and no credit.
 */
export interface Example {
	point: string;
	uk: string;
	en: string;
	start: number;
	length: number;
	/** The noun's dictionary form, to find the ending that changed: дім in біля дому. */
	word: string;
	tatoeba_id: number;
	/** Corrected here (data/tatoeba-corrections.tsv): its credit says so. */
	adapted?: boolean;
}

/** How many sentences a page shows for each rule, and in all. */
export const PER_RULE = 2;
export const MOST_EXAMPLES = 8;

/**
 * The examples of a page from the sentences drawn for its rules: up to
 * PER_RULE for each, Tatoeba's before the made-up ones, no sentence twice.
 */
export function examplesOf(drawn: readonly Example[]): Example[] {
	const made = (gap: Example) => (gap.tatoeba_id === 0 ? 1 : 0);
	const seen = new Set<string>();
	const counted = new Map<string, number>();
	const out: Example[] = [];
	for (const gap of [...drawn].sort((a, b) => made(a) - made(b))) {
		if (seen.has(gap.uk) || (counted.get(gap.point) ?? 0) >= PER_RULE) continue;
		seen.add(gap.uk);
		counted.set(gap.point, (counted.get(gap.point) ?? 0) + 1);
		const { point, uk, en, start, length, word, tatoeba_id, adapted } = gap;
		out.push({ point, uk, en, start, length, word, tatoeba_id, ...(adapted ? { adapted } : {}) });
	}
	return out.slice(0, MOST_EXAMPLES);
}

/**
 * The same numbers from the same text, so a page shows the same sentences
 * each time it is drawn and can be cached (mulberry32 over the text's hash).
 */
export function seededRandom(text: string): () => number {
	let seed = 0;
	for (const char of text) seed = (Math.imul(seed, 31) + char.codePointAt(0)!) | 0;
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/** The stress mark, U+0301 after the stressed vowel: left out when forms are compared. */
const STRESS = String.fromCharCode(0x301);

/**
 * Where the changed ending starts in a noun as a sentence has it: after the
 * letters it shares with its dictionary form, so дому (дім) marks ому and
 * школи (школа) marks и, as the rest of the page marks endings. A form the
 * same as the dictionary's (у місто) has no ending to mark: its length.
 */
export function endingStart(form: string, word: string): number {
	const a = form.toLocaleLowerCase('uk').replaceAll(STRESS, '');
	const b = word.toLocaleLowerCase('uk').replaceAll(STRESS, '');
	if (a === b) return form.length;
	let n = 0;
	while (n < a.length && n < b.length && a[n] === b[n]) n++;
	return n;
}

/** The lessons that have a page, which is every lesson: a test holds the two lists together. */
export const LESSON_INTROS = LESSONS.map((lesson) => lesson.id);
