// The card's few strings, in the site's two languages. They are the site's
// own (`word.gloss`, `card.noEntry` and `pos` in src/lib/i18n.ts), copied
// because that file is far too large to send into every page.
const en = {
	open: 'Open word',
	also: 'Also',
	missing: 'This word is not in the dictionary yet.',
	search: 'Search for it',
	loading: 'Looking it up…',
	noEntry: 'A Ukrainian word with no dictionary entry yet.',
	/** The credit the two licences ask for, linked to the site's Sources page */
	credit: 'Data: Wiktionary, VESUM',
	form: 'Form',
	case: 'Case',
	grammar: 'Grammar',
	/** How common the word is, as the site says it (`tiers`, `word.rankTitle`, `word.unranked` there) */
	tiers: { 'very-common': 'Very common', common: 'Common', uncommon: 'Uncommon', rare: 'Rare' },
	rankTitle: (rank: string) => `Number ${rank} among the most frequent Ukrainian words`,
	unranked: 'Too rare to rank',
	save: 'Save word',
	unsave: 'Remove from saved',
	saved: 'Saved.',
	addTo: 'Add to:',
	signIn: 'Sign in to save',
	full: 'Saved holds 5,000 words at most, and yours is full.',
	failed: 'The word could not be saved. Try again in a moment.',
	options: {
		/** After the name at the top of the page: "Nebokrai extension settings" */
		title: 'extension settings',
		opening: 'Opening the card',
		hoverKey: 'Hold a key and point',
		hoverKeyHint: 'The card opens for the word under the pointer',
		doubleClick: 'Double-click a word',
		keys: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', off: 'Off' } as Record<string, string>,
		looks: 'How it looks',
		theme: 'Theme',
		themes: { system: 'System', light: 'Light', sepia: 'Sepia', dark: 'Dark' } as Record<string, string>,
		font: 'Ukrainian words',
		fonts: { serif: 'Serif', sans: 'Sans-serif' } as Record<string, string>,
		size: 'Size',
		sizes: { small: 'Small', medium: 'Medium', large: 'Large', larger: 'Larger' } as Record<string, string>,
		/** Over the sentence beside the settings, whose words open the card as a page's would */
		tryIt: 'Try it on this sentence',
		tryItOff: 'Both ways of opening the card are switched off.',
		/** What leaves the page, said where the reader sets the extension up; the site's privacy page says the same at length */
		sent: 'A word is sent to nebokrai.app only when you ask about it, with the word on each side of it. Saving uses your sign-in there.',
		privacy: 'Privacy'
	},
	pos: {
		noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', name: 'name',
		pron: 'pronoun', num: 'numeral', prep: 'preposition', conj: 'conjunction',
		particle: 'particle', intj: 'interjection', phrase: 'phrase',
		det: 'determiner', postp: 'postposition', prep_phrase: 'prepositional phrase', proverb: 'proverb'
	} as Record<string, string>,
	/** The tags worth a word on a small card: what a learner needs to use the word. */
	tags: {
		masculine: 'masculine', feminine: 'feminine', neuter: 'neuter',
		perfective: 'perfective', imperfective: 'imperfective'
	} as Record<string, string>
};

const uk: typeof en = {
	open: 'Відкрити слово',
	also: 'Також',
	missing: 'Цього слова в словнику ще немає.',
	search: 'Пошукати його',
	loading: 'Шукаю…',
	noEntry: 'Українське слово, якого ще немає в словнику.',
	credit: 'Дані: Вікісловник, ВЕСУМ',
	form: 'Форма',
	case: 'Відмінок',
	grammar: 'Граматика',
	tiers: { 'very-common': 'Дуже вживане', common: 'Вживане', uncommon: 'Рідковживане', rare: 'Рідкісне' },
	rankTitle: (rank: string) => `${rank}-е місце серед найуживаніших українських слів`,
	unranked: 'Надто рідкісне для рейтингу',
	save: 'Зберегти слово',
	unsave: 'Прибрати зі збереженого',
	saved: 'Збережено.',
	addTo: 'Додати до:',
	signIn: 'Увійдіть, щоб зберігати',
	full: 'До збереженого вміщається щонайбільше 5000 слів, і місця вже немає.',
	failed: 'Не вдалося зберегти слово. Спробуйте за хвилину.',
	options: {
		title: 'налаштування розширення',
		opening: 'Як відкривати картку',
		hoverKey: 'Клавіша й вказівник на слові',
		hoverKeyHint: 'Картка відкривається для слова під вказівником',
		doubleClick: 'Подвійне клацання на слові',
		keys: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', off: 'Вимк.' },
		looks: 'Вигляд',
		theme: 'Тема',
		themes: { system: 'Як у системі', light: 'Світлий', sepia: 'Сепія', dark: 'Темний' },
		font: 'Українські слова',
		fonts: { serif: 'З засічками', sans: 'Без засічок' },
		size: 'Розмір',
		sizes: { small: 'Малий', medium: 'Середній', large: 'Великий', larger: 'Більший' },
		tryIt: 'Спробуйте на цьому реченні',
		tryItOff: 'Обидва способи відкривати картку вимкнено.',
		sent: 'Слово надсилається на nebokrai.app лише тоді, коли ви про нього питаєте, разом зі словом з кожного боку від нього. Для збереження використовується ваш вхід на сайті.',
		privacy: 'Приватність'
	},
	pos: {
		noun: 'іменник', verb: 'дієслово', adj: 'прикметник', adv: 'прислівник', name: 'власна назва',
		pron: 'займенник', num: 'числівник', prep: 'прийменник', conj: 'сполучник',
		particle: 'частка', intj: 'вигук', phrase: 'фраза',
		det: 'займенник', postp: 'післяйменник', prep_phrase: 'прийменникове сполучення', proverb: 'прислів’я'
	},
	tags: {
		masculine: 'чоловічий рід', feminine: 'жіночий рід', neuter: 'середній рід',
		perfective: 'доконаний вид', imperfective: 'недоконаний вид'
	}
};

export type Messages = typeof en;

/** Ukrainian for a browser set to Ukrainian, English for every other. */
export function messagesFor(language: string): Messages {
	return language.toLowerCase().startsWith('uk') ? uk : en;
}
