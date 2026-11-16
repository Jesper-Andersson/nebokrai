// What is new on the site, as listed on /updates: written by hand, newest
// first. A change a visitor can notice adds its entry here in the same pull
// request; tests/updates.test.ts holds the rules below.
//
// How to word an entry:
// - The title says what the visitor can now do, in sentence case, without
//   "we" and without developer words: "Bring your Anki decks with you", not
//   "Add Anki and CSV import".
// - The body is one sentence: where to find it, or what is different.
// - Small fixes share one `fixes` entry per month; it has no title of its own.
// - Refactoring, CI, dependencies and anything a visitor cannot notice stay out.
// - English and Ukrainian are written together, never one now and one later.

/** `fixes` is the month's round-up of small things. */
export const KINDS = ['new', 'changed', 'fixes'] as const;
export type Kind = (typeof KINDS)[number];

export const TITLE_MAX = 60;
export const BODY_MAX = 200;

interface Text {
	en: string;
	uk: string;
}

export interface Update {
	/**
	 * The date and a short name: `2026-11-15-anki-import`. A browser remembers
	 * the last id it saw, so an id is never changed or reused once it is merged.
	 */
	id: string;
	/** The day (ISO) it reached the site. There are no version numbers; the date stands in. */
	date: string;
	kind: Kind;
	/** Left out for `fixes`, whose heading comes from the interface strings */
	title?: Text;
	body: Text;
	/** A path on this site where the change can be seen */
	href?: string;
}

// Newest first (the test holds this). Entries of one day are ordered by hand,
// the one most worth reading on top.
export const UPDATES: Update[] = [
	{
		id: '2026-11-16-english-capital-meanings',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Searching “English” finds англійський first', uk: 'Пошук «English» спершу знаходить англійський' },
		body: {
			en: 'Words whose meaning starts with a capital letter, such as англійський for English or понеділок for Monday, now come first when you search for that meaning.',
			uk: 'Слова, значення яких пишеться з великої літери, як-от англійський (English) чи понеділок (Monday), тепер ідуть першими, коли шукаєте це значення.'
		}
	},
	{
		id: '2026-11-16-quick-search-ukrainian-layout',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Ctrl+K opens search on a Ukrainian keyboard too', uk: 'Ctrl+K відкриває пошук і з українською розкладкою' },
		body: {
			en: 'Ctrl+K (⌘K on a Mac) opens the quick search whichever keyboard layout is on, and on a phone each meaning sits on its own line under the word.',
			uk: 'Ctrl+K (⌘K на Mac) відкриває швидкий пошук за будь-якої розкладки, а на телефоні кожне значення стоїть окремим рядком під словом.'
		}
	},
	{
		id: '2026-11-16-one-log-in-button',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Log in from the top of the settings', uk: 'Вхід угорі налаштувань' },
		body: {
			en: 'One Log in button offers Google or GitHub, at the top of the settings menu, on the Saved page and on Learn.',
			uk: 'Одна кнопка «Увійти» пропонує Google або GitHub: угорі меню налаштувань, на сторінці «Збережене» і в «Навчанні».'
		}
	},
	{
		id: '2026-11-16-section-names',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Read section names without the small capitals', uk: 'Читайте назви розділів без дрібних великих літер' },
		body: {
			en: 'Names such as Word of the day and Meanings, and the tabs at the top, are no longer set in small capital letters: they are larger and written as ordinary words.',
			uk: 'Назви на кшталт «Слово дня» й «Значення», а також вкладки вгорі більше не набрано дрібними великими літерами: вони більші й написані звичайними словами.'
		}
	},
	{
		id: '2026-11-16-learn-on-a-phone',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'A shorter Learn page on a phone', uk: 'Коротша сторінка «Навчання» на телефоні' },
		body: {
			en: 'Flashcards and Grammar sit side by side, the weekly goal comes right after them, and the lessons scroll sideways with the open one just below.',
			uk: 'Картки й Граматика стоять поруч, одразу за ними мета на тиждень, а уроки гортаються вбік, і відкритий урок видно просто під ними.'
		},
		href: '/learn'
	},
	{
		id: '2026-11-16-due-on-learn-tab',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'See what is due on the Learn tab', uk: 'Бачте на вкладці «Навчання», що час повторити' },
		body: {
			en: 'The count of flashcards to review moved from its own icon onto the Learn tab, and the weekly goal stands beside the settings.',
			uk: 'Кількість карток на повторення перейшла з окремої піктограми на вкладку «Навчання», а мета на тиждень стоїть біля налаштувань.'
		}
	},
	{
		id: '2026-11-16-back-to-results',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Get back to your search results from a word', uk: 'Повертайтеся від слова до результатів пошуку' },
		body: {
			en: '“Back to search” on a word’s page now returns to the results you came from, and signing in brings you back to the page you were on.',
			uk: '«До пошуку» на сторінці слова тепер повертає до результатів, з яких ви прийшли, а після входу ви опиняєтеся на сторінці, де були.'
		}
	},
	{
		id: '2026-11-16-flashcards-phone',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Review flashcards on a phone without scrolling', uk: 'Повторюйте картки на телефоні без прокручування' },
		body: {
			en: 'A card and its answers now fit one phone screen, a tap that turns a card no longer opens the link under it, and the help behind the question mark is much shorter.',
			uk: 'Картка й відповіді тепер уміщаються на одному екрані телефона, дотик, що перевертає картку, більше не відкриває посилання під нею, а довідка за знаком питання стала значно коротшою.'
		},
		href: '/review'
	},
	{
		id: '2026-11-16-pick-up',
		date: '2026-11-16',
		kind: 'new',
		title: { en: 'Pick up where you left off', uk: 'Продовжуйте з того місця, де зупинилися' },
		body: {
			en: 'Under the word of the day, the search page now leads back to your flashcards, grammar and saved words once you have begun them.',
			uk: 'Під словом дня сторінка пошуку тепер веде назад до ваших карток, граматики й збережених слів, щойно ви їх почали.'
		}
	},
	{
		id: '2026-11-16-head-line-words',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Find words listed under another word', uk: 'Знаходьте слова, подані в статті іншого слова' },
		body: {
			en: 'Searching історично or уперше now shows the word whose entry lists it, and says how the two are related.',
			uk: 'Пошук слів історично чи уперше тепер показує слово, у статті якого їх подано, і пояснює, як вони пов’язані.'
		}
	},
	{
		id: '2026-11-16-wide-screens',
		date: '2026-11-16',
		kind: 'changed',
		title: { en: 'Read more comfortably on a wide screen', uk: 'Зручніше читати на широкому екрані' },
		body: {
			en: 'Common words stand in two columns, longer pages list their sections at the side, and Grammar keeps its groups beside the rules.',
			uk: 'Уживані слова стоять у двох колонках, довші сторінки показують свої розділи збоку, а Граматика тримає групи поруч із правилами.'
		},
		href: '/grammar'
	},
	{
		id: '2026-11-15-updates-page',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'See what is new on the site', uk: 'Дивіться, що нового на сайті' },
		body: {
			en: 'This page lists what was added and what changed, newest first.',
			uk: 'На цій сторінці зібрано все, що додано і що змінилося, від найновішого.'
		}
	},
	{
		id: '2026-11-15-anki-import',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'Bring your Anki decks with you', uk: 'Перенесіть свої колоди з Anki' },
		body: {
			en: 'Import Anki decks together with their progress, or a list of words from text or a CSV file.',
			uk: 'Імпортуйте колоди Anki разом із поступом або список слів із тексту чи файлу CSV.'
		},
		href: '/import'
	},
	{
		id: '2026-11-15-new-word-sources',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'Choose where new words come from', uk: 'Обирайте, звідки беруться нові слова' },
		body: {
			en: 'Pick the decks that feed your new flashcards, and see how far each one has got.',
			uk: 'Обирайте колоди, з яких надходять нові картки, і дивіться, скільки з кожної вже пройдено.'
		},
		href: '/review'
	},
	{
		id: '2026-11-15-typed-answers',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'Type the answer for words you know well', uk: 'Вводьте відповідь для слів, які добре знаєте' },
		body: {
			en: 'Once you know a word well, its flashcard asks you to type the answer.',
			uk: 'Коли слово вже добре знайоме, картка просить ввести відповідь з клавіатури.'
		},
		href: '/review'
	},
	{
		id: '2026-11-15-weekly-goal',
		date: '2026-11-15',
		kind: 'changed',
		title: { en: 'A weekly goal replaces the streak', uk: 'Тижнева мета замість серії днів' },
		body: {
			en: 'Flashcards now count towards a goal for the week, and show what each new card a day costs later.',
			uk: 'Картки тепер зараховуються до мети на тиждень, і видно, скільки повторень згодом дасть кожна нова картка на день.'
		},
		href: '/review'
	},
	{
		id: '2026-11-15-hint-ladder',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'Hints in three steps in grammar practice', uk: 'Підказки у три кроки в граматичних вправах' },
		body: {
			en: 'Grammar practice now gives its hints in three steps, each telling a little more than the last.',
			uk: 'Граматичні вправи тепер підказують у три кроки: кожен каже трохи більше за попередній.'
		},
		href: '/practice'
	},
	{
		id: '2026-11-15-sentence-word-cards',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'Look up any word in an example sentence', uk: 'Будь-яке слово з прикладу — під рукою' },
		body: {
			en: 'Any word in an example sentence now opens a small card with its meaning.',
			uk: 'Будь-яке слово в реченні-прикладі тепер відкриває невелику картку зі значенням.'
		}
	},
	{
		id: '2026-11-15-zakon-typeface',
		date: '2026-11-15',
		kind: 'changed',
		title: { en: 'Set in Zakon, Ukraine’s national typeface', uk: 'Сайт набрано «Законом», національним шрифтом України' },
		body: {
			en: 'The site is now set in Zakon; to go back, choose Sans-serif under Font in the settings menu.',
			uk: 'Сайт тепер набрано шрифтом «Закон»; щоб повернути попередній, оберіть шрифт без засічок у налаштуваннях.'
		}
	},
	{
		id: '2026-11-15-more-resources',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'Fifteen more free resources', uk: 'Ще п’ятнадцять безкоштовних ресурсів' },
		body: {
			en: 'The Resources page has fifteen new free places to learn Ukrainian.',
			uk: 'На сторінці «Ресурси» з’явилося п’ятнадцять нових безкоштовних місць, де можна вчити українську.'
		},
		href: '/resources'
	},
	{
		id: '2026-11-15-support-menu',
		date: '2026-11-15',
		kind: 'new',
		title: { en: 'More ways to support the site', uk: 'Більше способів підтримати сайт' },
		body: {
			en: 'The About page now offers Ko-fi, Liberapay and GitHub Sponsors from one menu.',
			uk: 'На сторінці «Про проєкт» тепер є одне меню з Ko-fi, Liberapay і GitHub Sponsors.'
		},
		href: '/about'
	},
	{
		id: '2026-11-15-fixes',
		date: '2026-11-15',
		kind: 'fixes',
		body: {
			en: 'Text and list pages use the whole width of a phone, the settings menu is shorter on phones, and the accessibility problems an audit found are fixed.',
			uk: 'Сторінки з текстом і списками займають усю ширину телефона, меню налаштувань на телефоні стало коротшим, а знайдені перевіркою вади доступності виправлено.'
		}
	},
	{
		id: '2026-11-14-word-page-columns',
		date: '2026-11-14',
		kind: 'changed',
		title: { en: 'The word page puts first meanings up front', uk: 'Перші значення — на початку сторінки слова' },
		body: {
			en: 'A word’s page is now laid out in two columns on wide screens, with its first meanings at the top.',
			uk: 'Сторінка слова на широких екранах тепер має дві колонки, а перші значення стоять угорі.'
		}
	},
	{
		id: '2026-11-14-learn-dashboard',
		date: '2026-11-14',
		kind: 'changed',
		title: { en: 'Learn shows your decks and lessons together', uk: '«Навчання» показує колоди й уроки разом' },
		body: {
			en: 'The Learn page is now a dashboard of your decks and lessons.',
			uk: 'Сторінка «Навчання» тепер зводить ваші колоди й уроки в один огляд.'
		},
		href: '/learn'
	}
];

/** The id of the newest entry, which a browser stores once its visitor has seen the page. */
export function latestId(list: Update[] = UPDATES): string {
	return list[0]?.id ?? '';
}

/**
 * Whether anything is newer than the entry a browser last saw. Nothing stored
 * means a first visit, and a newcomer has nothing to catch up on, so no marker.
 * Position decides, not the text of the id: two entries of one day sort by
 * hand. An id that is no longer in the list falls back to its date.
 */
export function hasUnseen(seenId: string, list: Update[] = UPDATES): boolean {
	if (!seenId || !list.length) return false;
	const at = list.findIndex((u) => u.id === seenId);
	if (at >= 0) return at > 0;
	return list[0].date > seenId.slice(0, 10);
}

/** Entries grouped under their month (`2026-11`), in the order of the list. */
export function byMonth(list: Update[] = UPDATES): { month: string; items: Update[] }[] {
	const groups: { month: string; items: Update[] }[] = [];
	for (const u of list) {
		const month = u.date.slice(0, 7);
		const last = groups.at(-1);
		if (last?.month === month) last.items.push(u);
		else groups.push({ month, items: [u] });
	}
	return groups;
}
