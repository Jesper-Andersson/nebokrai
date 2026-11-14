// The learning resources listed on /resources: other places to learn Ukrainian,
// chosen by hand. To add one, add an object to RESOURCES and its icon to
// src/lib/assets/resources/; the page and tests/resources.test.ts pick it up.
// Nebokrai lists itself last in Dictionaries and Community, on purpose.
//
// What goes in: something we have opened and tried, that is useful without
// paying or is plainly marked as paid. No Russian-made resources, no paid
// placements and no affiliate links.

/** In the order the list shows them. */
export const KINDS = ['course', 'podcast', 'reading', 'dictionary', 'tool', 'tutor', 'community', 'book'] as const;
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
	/**
	 * Its own icon, a path under src/lib/assets/: a 64 px PNG in resources/,
	 * saved from the site once rather than loaded from it, so a visitor's
	 * browser asks no one else for anything. Two resources from one publisher
	 * share a file; Nebokrai's own entries use the site's logo-icon.svg.
	 */
	logo: string;
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
		logo: 'resources/ukrainian-lessons.png',
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
		logo: 'resources/podorozhi-ua.png',
		en: 'A free online textbook of beginner’s Ukrainian for English speakers.',
		uk: 'Безкоштовний онлайн-підручник української для початківців, що знають англійську.',
		kind: 'course',
		levels: ['beginner'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Speak Ukrainian',
		url: 'https://speakua.com/',
		logo: 'resources/speak-ukrainian.png',
		en: 'An online school with free video lessons, a level test and a mini course; full courses are paid.',
		uk: 'Онлайн-школа з безкоштовними відеоуроками, тестом рівня й мінікурсом; повні курси платні.',
		kind: 'course',
		levels: ['beginner', 'intermediate'],
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Podcasts and video
	{
		name: 'Ukrainian Lessons Podcast',
		url: 'https://www.ukrainianlessons.com/thepodcast/',
		logo: 'resources/ukrainian-lessons.png',
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
		logo: 'resources/5-minute-ukrainian.png',
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
		logo: 'resources/ukrainer.png',
		en: 'Stories about Ukraine’s regions and the war, in Ukrainian with an English edition to compare.',
		uk: 'Історії про регіони України й війну українською, з англійською версією для порівняння.',
		kind: 'reading',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Суспільне Новини',
		url: 'https://suspilne.media/',
		logo: 'resources/suspilne.png',
		en: 'News from Ukraine’s public broadcaster.',
		uk: 'Новини від українського суспільного мовника.',
		kind: 'reading',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},

	// Dictionaries and reference
	{
		name: 'Wiktionary',
		url: 'https://en.wiktionary.org/wiki/Category:Ukrainian_language',
		logo: 'resources/wiktionary.png',
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
		logo: 'resources/goroh.png',
		en: 'Ukrainian-language dictionaries: meanings, synonyms, stress and inflection.',
		uk: 'Тлумачення, синоніми, наголоси й словозміна українською.',
		kind: 'dictionary',
		levels: UPPER,
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'ГРАК',
		url: 'https://uacorpus.org/',
		logo: 'resources/grac.png',
		en: 'A searchable corpus of over 150,000 Ukrainian texts from 1816 to today.',
		uk: 'Корпус із понад 150 000 українських текстів від 1816 року до сьогодні, з пошуком.',
		kind: 'dictionary',
		levels: ['advanced'],
		cost: 'free',
		explainedIn: 'uk',
		checked: '2026-11-12'
	},
	{
		name: 'Nebokrai',
		url: 'https://nebokrai.app/',
		logo: 'logo-icon.svg',
		en: 'This very dictionary: stress, every form of a word, and examples. We could hardly leave it out.',
		uk: 'Цей самий словник: наголоси, усі форми слова й приклади. Не могли ж ми себе не згадати.',
		kind: 'dictionary',
		levels: ['beginner', 'intermediate', 'advanced'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-14'
	},

	// Practice and tools
	{
		name: 'Tatoeba',
		url: 'https://tatoeba.org/',
		logo: 'resources/tatoeba.png',
		en: 'Example sentences with translations, many with audio.',
		uk: 'Речення з перекладами, багато з аудіо.',
		kind: 'tool',
		levels: ALL,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Anki',
		url: 'https://apps.ankiweb.net/',
		logo: 'resources/anki.png',
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
		logo: 'resources/clozemaster.png',
		en: 'Thousands of fill-in-the-blank sentences for learning words in context.',
		uk: 'Тисячі речень із пропусками, щоб учити слова в контексті.',
		kind: 'tool',
		levels: ALL,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Readlang',
		url: 'https://readlang.com/',
		logo: 'resources/readlang.png',
		en: 'A reader for web pages and texts: click a word to translate it, then review it as a flashcard.',
		uk: 'Читання вебсторінок і текстів: клацніть слово, щоб перекласти, а потім повторюйте його на картках.',
		kind: 'tool',
		levels: ALL,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Language Reactor',
		url: 'https://www.languagereactor.com/',
		logo: 'resources/language-reactor.png',
		en: 'A browser extension that adds dual subtitles and a pop-up dictionary to Netflix and YouTube.',
		uk: 'Розширення для браузера, що додає подвійні субтитри й спливний словник до Netflix і YouTube.',
		kind: 'tool',
		levels: UPPER,
		cost: 'freemium',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'LanguageTool',
		url: 'https://languagetool.org/',
		logo: 'resources/languagetool.png',
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
		logo: 'resources/preply.png',
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
		logo: 'resources/italki.png',
		en: 'One-to-one lessons with Ukrainian teachers, with cheaper trial lessons.',
		uk: 'Індивідуальні уроки з викладачами української, з дешевшими пробними уроками.',
		kind: 'tutor',
		levels: ALL,
		cost: 'paid',
		explainedIn: 'en',
		checked: '2026-11-12'
	},

	// Community
	{
		name: 'r/Ukrainian',
		url: 'https://www.reddit.com/r/Ukrainian/',
		logo: 'resources/r-ukrainian.png',
		en: 'A Reddit community for people learning Ukrainian, a place to ask questions.',
		uk: 'Спільнота на Reddit для тих, хто вчить українську: тут можна поставити запитання.',
		kind: 'community',
		levels: ALL,
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-12'
	},
	{
		name: 'Nebokrai on Discord',
		url: 'https://discord.gg/KFankcC5Tc',
		logo: 'logo-icon.svg',
		en: 'Our own server, for questions about Ukrainian or about this site. Yes, we are plugging ourselves.',
		uk: 'Наш власний сервер для питань про українську чи про цей сайт. Так, ми рекламуємо себе.',
		kind: 'community',
		levels: ['beginner', 'intermediate', 'advanced'],
		cost: 'free',
		explainedIn: 'en',
		checked: '2026-11-14'
	}
];

/** `['beginner', 'intermediate']` -> `'beginner-intermediate'`, the key of its label in i18n.ts. */
export function levelSpan(levels: Level[]): LevelSpan {
	return LEVELS.filter((level) => levels.includes(level)).join('-') as LevelSpan;
}

/** The kinds that have at least one resource, in list order: the page shows no empty group. */
export function kindsIn(list: Resource[]): Kind[] {
	return KINDS.filter((kind) => list.some((r) => r.kind === kind));
}

/** What the price filter offers. */
export const PRICES = ['any', 'free', 'paid'] as const;
export type Price = (typeof PRICES)[number];

/**
 * The resources a price choice keeps. A free-plus-paid resource is under both:
 * it can be used without paying (Free), and it sells something (Paid).
 */
export function byPrice(list: Resource[], price: Price): Resource[] {
	if (price === 'free') return list.filter((r) => r.cost !== 'paid');
	if (price === 'paid') return list.filter((r) => r.cost !== 'free');
	return list;
}

export const ORDERS = ['easiest', 'hardest'] as const;
export type Order = (typeof ORDERS)[number];

/**
 * The list sorted by level, keeping the hand-made order between equals.
 * Easiest first goes by the lowest level a resource suits, then the highest:
 * Подорожі.UA (beginner only) before Speak Ukrainian (beginner to
 * intermediate) before Ukrainian Lessons (every level). Hardest first goes by
 * the highest level, then the lowest, so ГРАК (advanced only) leads.
 */
export function byLevel(list: Resource[], order: Order): Resource[] {
	const rank = (r: Resource) => r.levels.map((level) => LEVELS.indexOf(level));
	return list.toSorted((a, b) => {
		const [x, y] = [rank(a), rank(b)];
		return order === 'easiest'
			? Math.min(...x) - Math.min(...y) || Math.max(...x) - Math.max(...y)
			: Math.max(...y) - Math.max(...x) || Math.min(...y) - Math.min(...x);
	});
}

/** The list cut into one group per kind, in the order of KINDS, leaving out empty kinds. */
export function byKind(list: Resource[]): { kind: Kind; items: Resource[] }[] {
	return kindsIn(list).map((kind) => ({ kind, items: list.filter((r) => r.kind === kind) }));
}

/** The newest `checked` day in the list: when the page was last reviewed. */
export function lastChecked(list: Resource[]): string {
	return list.reduce((latest, r) => (r.checked > latest ? r.checked : latest), '');
}
