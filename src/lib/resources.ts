// The learning resources listed on /resources: other places to learn Ukrainian,
// chosen by hand. To add one, add an object to RESOURCES; the page, its filter
// and tests/resources.test.ts pick it up.
//
// What goes in: something we have opened and tried, that is useful without
// paying or is plainly marked as paid. No Russian-made resources, no paid
// placements and no affiliate links.
import { plain } from './search/normalize.ts';

/** In the order the list shows them. */
export const KINDS = ['course', 'podcast', 'reading', 'dictionary', 'tool', 'tutor', 'book'] as const;
export type Kind = (typeof KINDS)[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

/** The runs of levels a resource can suit: one level, or neighbours. */
export const LEVEL_SPANS = [
	'beginner', 'intermediate', 'advanced',
	'beginner-intermediate', 'intermediate-advanced', 'beginner-intermediate-advanced'
] as const;
export type LevelSpan = (typeof LEVEL_SPANS)[number];

/** `freemium`: a useful free part, with more for money. */
export type Cost = 'free' | 'freemium' | 'paid';

export interface Resource {
	name: string;
	url: string;
	/** One line on what it is, in English and in Ukrainian */
	en: string;
	uk: string;
	kind: Kind;
	levels: Level[];
	cost: Cost;
	/** The language it explains things in. Горох is all in Ukrainian, so a beginner cannot use it yet. */
	explainedIn: 'en' | 'uk';
	/** The day (ISO) the link and the description were last looked at */
	checked: string;
}

const ALL: Level[] = ['beginner', 'intermediate', 'advanced'];
const UPPER: Level[] = ['intermediate', 'advanced'];

// Ordered by kind (the test holds this), then by hand: what a newcomer can
// use first comes first.
export const RESOURCES: Resource[] = [
	// Courses and apps
	{
		name: 'Ukrainian Lessons',
		url: 'https://www.ukrainianlessons.com/',
		en: 'Podcast, lessons and grammar notes for learners at every level.',
		uk: 'Подкаст, уроки й пояснення граматики для будь-якого рівня.',
		kind: 'course',
		levels: ALL,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Подорожі.UA',
		url: 'https://podorozhiua.com/',
		en: 'A free online textbook of beginner’s Ukrainian for English speakers.',
		uk: 'Безкоштовний онлайн-підручник української для початківців, що знають англійську.',
		kind: 'course',
		levels: ['beginner'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Introduction to Ukrainian language and culture',
		url: 'https://www.open.edu/openlearn/languages/introduction-ukrainian-language-and-culture/content-section-overview',
		en: 'A free 25-hour short course from the Open University.',
		uk: 'Безкоштовний короткий курс Відкритого університету на 25 годин.',
		kind: 'course',
		levels: ['beginner'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Duolingo',
		url: 'https://www.duolingo.com/course/uk/en/Learn-Ukrainian',
		en: 'A game-like app course in short daily lessons.',
		uk: 'Курс у застосунку у формі гри, короткими щоденними уроками.',
		kind: 'course',
		levels: ['beginner'],
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Speak Ukrainian',
		url: 'https://speakua.com/',
		en: 'An online school with free video lessons, a level test and a mini course; full courses are paid.',
		uk: 'Онлайн-школа з безкоштовними відеоуроками, тестом рівня й мінікурсом; повні курси платні.',
		kind: 'course',
		levels: ['beginner', 'intermediate'],
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Pimsleur',
		url: 'https://www.pimsleur.com/learn-ukrainian/',
		en: 'An audio course for speaking and listening; one lesson is free.',
		uk: 'Аудіокурс для розмовної мови й слухання; один урок безкоштовний.',
		kind: 'course',
		levels: ['beginner'],
		cost: 'paid',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Podcasts and video
	{
		name: 'Ukrainian Lessons Podcast',
		url: 'https://www.ukrainianlessons.com/thepodcast/',
		en: 'Six seasons, 240 lessons from the first words to advanced; audio is free, extras are paid.',
		uk: 'Шість сезонів, 240 уроків від перших слів до високого рівня; аудіо безкоштовне, решта платна.',
		kind: 'podcast',
		levels: ALL,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: '5 Minute Ukrainian',
		url: 'https://www.ukrainianlessons.com/fmu/',
		en: 'Sixty short episodes built on everyday dialogues; audio is free.',
		uk: 'Шістдесят коротких випусків на основі щоденних діалогів; аудіо безкоштовне.',
		kind: 'podcast',
		levels: ['beginner'],
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Reading and listening
	{
		name: 'Ukraїner',
		url: 'https://www.ukrainer.net/',
		en: 'Stories about Ukraine’s regions and the war, in Ukrainian with an English edition to compare.',
		uk: 'Історії про регіони України й війну українською, з англійською версією для порівняння.',
		kind: 'reading',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Радіо Свобода',
		url: 'https://www.radiosvoboda.org/',
		en: 'News and reporting in Ukrainian from Radio Free Europe/Radio Liberty.',
		uk: 'Новини й репортажі українською від Радіо Вільна Європа / Радіо Свобода.',
		kind: 'reading',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'Takflix',
		url: 'https://takflix.com/en',
		en: 'A legal online cinema for Ukrainian films, with an English interface.',
		uk: 'Легальний онлайн-кінотеатр українського кіно з англомовним інтерфейсом.',
		kind: 'reading',
		levels: UPPER,
		cost: 'paid',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Dictionaries and reference
	{
		name: 'Wiktionary',
		url: 'https://en.wiktionary.org/wiki/Category:Ukrainian_language',
		en: 'The source of Nebokrai’s entries, with etymology and usage notes.',
		uk: 'Джерело статей Nebokrai, з етимологією та поясненнями вживання.',
		kind: 'dictionary',
		levels: ALL,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Горох',
		url: 'https://goroh.pp.ua/',
		en: 'Ukrainian-language dictionaries: meanings, synonyms, stress and inflection.',
		uk: 'Тлумачення, синоніми, наголоси й словозміна українською.',
		kind: 'dictionary',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'e2u.org.ua',
		url: 'https://e2u.org.ua/',
		en: 'Nineteen English–Ukrainian general and terminology dictionaries behind one search.',
		uk: 'Дев’ятнадцять англійсько-українських загальних і термінологічних словників з одним пошуком.',
		kind: 'dictionary',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'Словник української мови у 20 томах',
		url: 'https://sum20ua.com/',
		en: 'The new 20-volume academic dictionary of Ukrainian; volumes 1 to 16 are online.',
		uk: 'Новий академічний словник української мови у 20 томах; онлайн доступні томи 1–16.',
		kind: 'dictionary',
		levels: ['advanced'],
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'Український правопис',
		url: 'https://mova.gov.ua/diyalnist-i-proyekti/termini/pravopys-ukrainskoi-movy',
		en: 'The official spelling and punctuation rules, published by the state language commission.',
		uk: 'Офіційні правила правопису й пунктуації від Національної комісії зі стандартів державної мови.',
		kind: 'dictionary',
		levels: ['advanced'],
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'ГРАК',
		url: 'https://uacorpus.org/',
		en: 'A searchable corpus of over 150,000 Ukrainian texts from 1816 to today.',
		uk: 'Корпус із понад 150 000 українських текстів від 1816 року до сьогодні, з пошуком.',
		kind: 'dictionary',
		levels: ['advanced'],
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},

	// Practice and tools
	{
		name: 'Tatoeba',
		url: 'https://tatoeba.org/',
		en: 'Example sentences with translations, many with audio.',
		uk: 'Речення з перекладами, багато з аудіо.',
		kind: 'tool',
		levels: ALL,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Forvo',
		url: 'https://forvo.com/languages/uk/',
		en: 'Pronunciations recorded by native speakers.',
		uk: 'Вимова, записана носіями мови.',
		kind: 'tool',
		levels: ALL,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Anki',
		url: 'https://apps.ankiweb.net/',
		en: 'Spaced-repetition flashcards, free except on iPhone. Your saved words here can be exported to it.',
		uk: 'Картки з інтервальним повторенням, безкоштовні скрізь, крім iPhone. Приймає експорт збережених слів.',
		kind: 'tool',
		levels: ALL,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Clozemaster',
		url: 'https://www.clozemaster.com/languages/expand-ukrainian-vocabulary',
		en: 'Thousands of fill-in-the-blank sentences for learning words in context.',
		uk: 'Тисячі речень із пропусками, щоб учити слова в контексті.',
		kind: 'tool',
		levels: ALL,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'LanguageTool',
		url: 'https://languagetool.org/',
		en: 'A spelling and grammar checker that knows Ukrainian; the free tier catches the basics.',
		uk: 'Перевірка правопису й граматики, що знає українську; безкоштовна версія ловить основне.',
		kind: 'tool',
		levels: UPPER,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Tutors
	{
		name: 'Preply',
		url: 'https://preply.com/en/online/ukrainian-tutors',
		en: 'One-to-one lessons with Ukrainian tutors, paid by the hour.',
		uk: 'Індивідуальні уроки з репетиторами української, оплата погодинна.',
		kind: 'tutor',
		levels: ALL,
		cost: 'paid',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'italki',
		url: 'https://www.italki.com/en/teachers/ukrainian',
		en: 'One-to-one lessons with Ukrainian teachers, with cheaper trial lessons.',
		uk: 'Індивідуальні уроки з викладачами української, з дешевшими пробними уроками.',
		kind: 'tutor',
		levels: ALL,
		cost: 'paid',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Books
	{
		name: 'Ukrainian: A Comprehensive Grammar',
		url: 'https://www.routledge.com/Ukrainian-A-Comprehensive-Grammar/Press-Pugh/p/book/9780415150309',
		en: 'A reference grammar by Ian Press and Stefan Pugh (Routledge, 1999); older than the 2019 spelling.',
		uk: 'Довідкова граматика (Ian Press, Stefan Pugh; Routledge, 1999); старша за правопис 2019 року.',
		kind: 'book',
		levels: UPPER,
		cost: 'paid',
		explainedIn: 'en',
		checked: '2026-11-12'
	}
];

/** `['beginner', 'intermediate']` -> `'beginner-intermediate'`, the key of its label in i18n.ts. */
export function levelSpan(levels: Level[]): LevelSpan {
	return LEVELS.filter((level) => levels.includes(level)).join('-') as LevelSpan;
}

/** The kinds that have at least one resource, in list order: the filter offers no empty choice. */
export function kindsIn(list: Resource[]): Kind[] {
	return KINDS.filter((kind) => list.some((r) => r.kind === kind));
}

/**
 * The resources of one kind (or of all, for `null`) whose name or description
 * has every word typed. Compared through `plain()`, so neither case nor a
 * stress mark matters: «горох» finds Горох.
 */
export function filterResources(list: Resource[], kind: Kind | null, text: string): Resource[] {
	const words = plain(text).split(/\s+/).filter(Boolean);
	return list.filter((r) => {
		if (kind && r.kind !== kind) return false;
		const hay = plain(`${r.name} ${r.en} ${r.uk}`);
		return words.every((word) => hay.includes(word));
	});
}

/** The newest `checked` day in the list: when the page was last reviewed. */
export function lastChecked(list: Resource[]): string {
	return list.reduce((latest, r) => (r.checked > latest ? r.checked : latest), '');
}
