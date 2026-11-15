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
	sources: 'Sources',
	form: 'Form',
	case: 'Case',
	grammar: 'Grammar',
	save: 'Save word',
	unsave: 'Remove from saved',
	saved: 'Saved.',
	addTo: 'Add to:',
	signIn: 'Sign in to save',
	full: 'Saved holds 5,000 words at most, and yours is full.',
	failed: 'The word could not be saved. Try again in a moment.',
	options: {
		hoverKey: 'Show the card when the pointer is on a word and this key is held:',
		doubleClick: 'Show the card on a double-click',
		keys: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', off: 'Never' } as Record<string, string>,
		theme: 'Theme of the card:',
		themes: { system: 'System', light: 'Light', sepia: 'Sepia', dark: 'Dark' } as Record<string, string>,
		font: 'Font of Ukrainian words:',
		fonts: { serif: 'Serif', sans: 'Sans-serif' } as Record<string, string>
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
	sources: 'Джерела',
	form: 'Форма',
	case: 'Відмінок',
	grammar: 'Граматика',
	save: 'Зберегти слово',
	unsave: 'Прибрати зі збереженого',
	saved: 'Збережено.',
	addTo: 'Додати до:',
	signIn: 'Увійдіть, щоб зберігати',
	full: 'До збереженого вміщається щонайбільше 5000 слів, і місця вже немає.',
	failed: 'Не вдалося зберегти слово. Спробуйте за хвилину.',
	options: {
		hoverKey: 'Показувати картку, коли вказівник на слові й натиснуто клавішу:',
		doubleClick: 'Показувати картку після подвійного клацання',
		keys: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', off: 'Ніколи' },
		theme: 'Тема картки:',
		themes: { system: 'Як у системі', light: 'Світлий', sepia: 'Сепія', dark: 'Темний' },
		font: 'Шрифт українських слів:',
		fonts: { serif: 'З засічками', sans: 'Без засічок' }
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
