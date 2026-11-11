// Interface text in English and Ukrainian. Dictionary data (meanings, grammar
// tags such as "feminine") stays in English: it comes from English Wiktionary.
import type { Lang } from './settings.ts';

/** What a word's page has to show, for its title and description (see seo.ts). */
export interface WordFacts {
	/** The headword carries a stress mark */
	stress: boolean;
	/** A recording, not the browser's synthetic voice */
	audio: boolean;
	table: 'declension' | 'conjugation' | null;
	examples: boolean;
}

/** "a, b and c" from the items that are there. */
function listOf(items: (string | false | null)[], and: string): string {
	const have = items.filter((item): item is string => Boolean(item));
	return have.length > 1 ? `${have.slice(0, -1).join(', ')} ${and} ${have.at(-1)}` : (have[0] ?? '');
}

const en = {
	nav: { label: 'Main', dictionary: 'Dictionary', resources: 'Resources', saved: 'Saved', about: 'About' },
	/** The header's link out to United24, the state's own fundraising platform. */
	support: { label: 'Support Ukraine', hint: 'Donate through United24, Ukraine’s official fundraising platform' },
	/** The search that opens from the header, or with Ctrl+K. */
	quick: {
		open: 'Search',
		title: 'Quick search',
		hint: 'Type a word in Ukrainian or English.',
		navigate: 'to move',
		select: 'to open',
		close: 'to close'
	},
	/** The short messages in the corner of the page. */
	toast: {
		saved: 'Saved',
		removed: 'Removed from saved',
		undo: 'Undo',
		dismiss: 'Dismiss'
	},
	/** Downloading the saved words as a file (the Saved page). */
	export: {
		button: 'Export',
		working: 'Exporting…',
		anki: 'Anki (text file)',
		csv: 'CSV (spreadsheet)',
		json: 'JSON',
		failed: 'The export didn’t work. Please try again.',
		ankiHint: 'In Anki, choose File › Import and pick the downloaded file.',
		which: 'Which words',
		scope: { all: 'All words', selected: 'Selected', fresh: 'Not exported yet' },
		as: 'File',
		exported: 'Exported',
		exportedOn: (date: string) => `Exported ${date}`,
		select: (word: string) => `Select ${word}`,
		selectAll: 'Select all',
		selectedCount: (n: number) => `${n} selected`
	},
	settings: {
		open: 'Settings',
		appearance: 'Appearance',
		system: 'System',
		light: 'Light',
		dark: 'Dark',
		language: 'Interface language',
		layout: 'Keyboard layout',
		standard: 'ЙЦУКЕН',
		phonetic: 'Phonetic',
		layoutHint: 'Phonetic puts each letter on the Latin key that sounds alike: п on P, г on H.',
		background: 'Background',
		backgrounds: { plain: 'Plain', field: 'Field', hills: 'Hills' }
	},
	account: {
		legend: 'Account',
		signInWith: (provider: string) => `Sign in with ${provider}`,
		signInHint: 'Sign in to have your saved words on every device.',
		signedIn: 'Signed in',
		signedInAs: (name: string) => `Signed in as ${name}`,
		signOut: 'Sign out',
		delete: 'Delete account',
		deleteConfirm: 'Delete your account and the words saved in it? This cannot be undone.',
		deleteFailed: 'Your account couldn’t be deleted. Please try again.'
	},
	footer: {
		label: 'Footer',
		/** The site's name, set as a dictionary entry of its own. */
		nameGloss: 'horizon, literally “the sky’s edge”',
		report: 'Report an issue',
		data: 'Dictionary data from Wiktionary and Tatoeba',
		sources: 'Sources and licences'
	},
	home: {
		titleAccent: 'Ukrainian',
		titleRest: ' ↔ English Dictionary',
		tryLabel: 'Try',
		placeholder: 'Search a word…',
		clear: 'Clear search',
		failed: 'Search isn’t working right now. Try again in a moment.',
		didYouMean: 'Did you mean:',
		orDidYouMean: 'Or did you mean:',
		noMatches: (q: string) => `No matches for “${q}”.`,
		reportMissing: 'Tell us this word is missing'
	},
	card: {
		play: 'Play pronunciation',
		save: 'Save word',
		unsave: 'Remove from saved',
		details: 'Details',
		genitive: 'gen.',
		noEntry: 'A Ukrainian word with no dictionary entry yet.'
	},
	word: {
		back: 'Back to search',
		entries: 'Entries on this page',
		playRecording: 'Play recording',
		playVoice: 'Play computer voice',
		meanings: 'Meanings',
		examples: 'Example sentences',
		forms: 'Forms',
		conjugation: 'Conjugation',
		etymology: 'Etymology',
		from: 'From',
		wiktionary: 'Wiktionary',
		recording: 'Recording on Wikimedia Commons',
		rankTitle: (rank: string) => `Number ${rank} among the most frequent Ukrainian words`,
		unranked: 'Too rare to rank',
		report: 'Report a mistake'
	},
	tiers: { 'very-common': 'Very common', common: 'Common', uncommon: 'Uncommon', rare: 'Rare' },
	pos: {
		noun: 'Noun', verb: 'Verb', adj: 'Adjective', adv: 'Adverb', name: 'Name',
		pron: 'Pronoun', num: 'Numeral', prep: 'Preposition', conj: 'Conjunction',
		particle: 'Particle', intj: 'Interjection', phrase: 'Phrase'
	} as Record<string, string>,
	/** Table titles and labels from forms.ts, keyed by their English text. */
	forms: {} as Record<string, string>,
	pageTitle: { resources: 'Resources', saved: 'Saved words', about: 'About' },
	/**
	 * What search results and link previews show for each page: its title and
	 * a description of about 150 characters (PageMeta.svelte, seo.ts). Search
	 * engines send no cookies, so they read the English ones.
	 */
	meta: {
		homeTitle: 'Nebokrai: Ukrainian–English dictionary with stress and declension',
		home: 'A free Ukrainian–English dictionary for learners. Search in Ukrainian, Latin letters or English and see the stress, full inflection tables, audio and examples.',
		about: 'What Nebokrai is, what you can do with it, where its words come from and who makes it.',
		resources: 'Courses, dictionaries and practice sites for learning Ukrainian, chosen by hand.',
		saved: 'The words you saved, kept in this browser or in your account.',
		report: 'Tell us about a mistake in the dictionary or a problem with the site.',
		/** книга: meaning in English, stress and declension */
		wordTitle: (word: string, has: WordFacts) =>
			`${word}: ${listOf(['meaning in English', has.stress && 'stress', has.table], 'and')}`,
		/** The last sentence of a word's description: what its page shows besides the meanings. */
		wordShows: (has: WordFacts) => {
			const shown = listOf([
				has.stress && 'the stress marked', has.audio && 'audio',
				has.table && `a full ${has.table} table`, has.examples && 'example sentences'
			], 'and');
			return shown && `With ${shown}.`;
		}
	},
	keyboard: {
		toggle: 'Ukrainian keyboard',
		label: 'Ukrainian keyboard',
		shift: 'Capital letter',
		backspace: 'Delete',
		space: 'space',
		holdFor: (key: string, alt: string) => `${key} (hold for ${alt})`,
		stress: 'Stress mark: adds or removes it on the vowel before the cursor',
		physical: 'Type Ukrainian on your own keyboard'
	},
	report: {
		title: 'Report an issue',
		intro: 'Tell us what looks wrong. Most words come from Wiktionary and Tatoeba, so many fixes also help everyone who uses them.',
		kindLegend: 'What’s wrong?',
		kinds: {
			meaning: 'Wrong or missing meaning',
			stress: 'Wrong stress',
			forms: 'Wrong word form',
			missing: 'Missing word',
			example: 'Bad example sentence',
			site: 'Something on the site doesn’t work',
			other: 'Something else'
		},
		messageLabel: 'What should it be?',
		placeholders: {
			meaning: 'The meaning that’s wrong or missing, and what it should be',
			stress: 'The correct stress, for example кни́га',
			forms: 'Which form is wrong, and what it should be',
			missing: 'The word, and what it means if you know',
			example: 'Which sentence, and what’s wrong with it',
			site: 'What you did, what you expected, and what happened instead',
			other: 'Your message'
		},
		emailLabel: 'Email (optional)',
		emailHint: 'Only if you’d like a reply. We delete it once the report is closed.',
		contextLabel: 'We’ll include:',
		contextEntry: (word: string, pos: string) => `${word} (${pos})`,
		contextQuery: (q: string) => `your search “${q}”`,
		contextPage: 'the page you came from',
		send: 'Send report',
		required: 'Please describe the problem.',
		sending: 'Sending…',
		failed: 'Your report couldn’t be sent. Please try again, or email contact@nebokrai.app.',
		tooMany: 'You’ve sent several reports in a short time. Please wait a few minutes and try again.',
		thanks: 'Thank you!',
		thanksBody: 'We read every report.',
		fixUpstream: 'You can also fix it at the source, so everyone gets the fix:',
		onWiktionary: (word: string) => `“${word}” on Wiktionary`,
		addToWiktionary: (word: string) => `Add “${word}” to Wiktionary`,
		preview: 'What was sent',
		another: 'Report something else'
	}
};

export type Messages = typeof en;

const uk: Messages = {
	nav: { label: 'Головне меню', dictionary: 'Словник', resources: 'Ресурси', saved: 'Збережене', about: 'Про проєкт' },
	support: { label: 'Підтримати Україну', hint: 'Задонатити через United24, офіційну фандрейзингову платформу України' },
	quick: {
		open: 'Пошук',
		title: 'Швидкий пошук',
		hint: 'Введіть слово українською чи англійською.',
		navigate: 'вибрати',
		select: 'відкрити',
		close: 'закрити'
	},
	toast: {
		saved: 'Збережено',
		removed: 'Прибрано зі збереженого',
		undo: 'Скасувати',
		dismiss: 'Закрити'
	},
	export: {
		button: 'Експортувати',
		working: 'Експортуємо…',
		anki: 'Anki (текстовий файл)',
		csv: 'CSV (таблиця)',
		json: 'JSON',
		failed: 'Не вдалося експортувати. Спробуйте ще раз.',
		ankiHint: 'В Anki виберіть «Файл» › «Імпортувати» й укажіть завантажений файл.',
		which: 'Які слова',
		scope: { all: 'Усі слова', selected: 'Вибрані', fresh: 'Ще не експортовані' },
		as: 'Файл',
		exported: 'Експортовано',
		exportedOn: (date: string) => `Експортовано ${date}`,
		select: (word: string) => `Вибрати ${word}`,
		selectAll: 'Вибрати всі',
		// "Вибрано: 5" needs no plural form of its own
		selectedCount: (n: number) => `Вибрано: ${n}`
	},
	settings: {
		open: 'Налаштування',
		appearance: 'Вигляд',
		system: 'Як у системі',
		light: 'Світлий',
		dark: 'Темний',
		language: 'Мова інтерфейсу',
		layout: 'Розкладка клавіатури',
		standard: 'ЙЦУКЕН',
		phonetic: 'Фонетична',
		layoutHint: 'Фонетична ставить кожну літеру на латинську клавішу з подібним звуком: п на P, г на H.',
		background: 'Тло',
		backgrounds: { plain: 'Однотонне', field: 'Поле', hills: 'Пагорби' }
	},
	account: {
		legend: 'Обліковий запис',
		signInWith: (provider: string) => `Увійти через ${provider}`,
		signInHint: 'Увійдіть, щоб збережені слова були на всіх ваших пристроях.',
		signedIn: 'Ви увійшли',
		signedInAs: (name: string) => `Ви увійшли як ${name}`,
		signOut: 'Вийти',
		delete: 'Видалити обліковий запис',
		deleteConfirm: 'Видалити обліковий запис і збережені в ньому слова? Це не можна скасувати.',
		deleteFailed: 'Не вдалося видалити обліковий запис. Спробуйте ще раз.'
	},
	footer: {
		label: 'Нижнє меню',
		nameGloss: 'горизонт, дослівно — «край неба»',
		report: 'Повідомити про помилку',
		data: 'Дані словника з Вікісловника й Tatoeba',
		sources: 'Джерела й ліцензії'
	},
	home: {
		titleAccent: 'Українсько',
		titleRest: '-англійський словник',
		tryLabel: 'Спробуйте',
		placeholder: 'Шукати слово…',
		clear: 'Очистити пошук',
		failed: 'Пошук зараз не працює. Спробуйте ще раз за хвилину.',
		didYouMean: 'Можливо, ви мали на увазі:',
		orDidYouMean: 'Або, можливо:',
		noMatches: (q: string) => `Нічого не знайдено за запитом «${q}».`,
		reportMissing: 'Повідомте, що цього слова бракує'
	},
	card: {
		play: 'Прослухати вимову',
		save: 'Зберегти слово',
		unsave: 'Прибрати зі збереженого',
		details: 'Докладніше',
		genitive: 'р. в.',
		noEntry: 'Українське слово, якого ще немає в словнику.'
	},
	word: {
		back: 'До пошуку',
		entries: 'Статті на цій сторінці',
		playRecording: 'Прослухати запис',
		playVoice: 'Прослухати синтезовану вимову',
		meanings: 'Значення',
		examples: 'Приклади речень',
		forms: 'Форми',
		conjugation: 'Дієвідмінювання',
		etymology: 'Етимологія',
		from: 'Джерело:',
		wiktionary: 'Вікісловник',
		recording: 'Запис на Вікісховищі',
		rankTitle: (rank: string) => `${rank}-е місце серед найуживаніших українських слів`,
		unranked: 'Надто рідкісне для рейтингу',
		report: 'Повідомити про помилку'
	},
	tiers: { 'very-common': 'Дуже вживане', common: 'Вживане', uncommon: 'Рідковживане', rare: 'Рідкісне' },
	pos: {
		noun: 'Іменник', verb: 'Дієслово', adj: 'Прикметник', adv: 'Прислівник', name: 'Власна назва',
		pron: 'Займенник', num: 'Числівник', prep: 'Прийменник', conj: 'Сполучник',
		particle: 'Частка', intj: 'Вигук', phrase: 'Фраза'
	},
	forms: {
		Declension: 'Відмінювання', Present: 'Теперішній час', Future: 'Майбутній час',
		Past: 'Минулий час', Imperative: 'Наказовий спосіб',
		Nominative: 'Називний', Genitive: 'Родовий', Dative: 'Давальний', Accusative: 'Знахідний',
		Instrumental: 'Орудний', Locative: 'Місцевий', Vocative: 'Кличний',
		Singular: 'Однина', Plural: 'Множина',
		Masculine: 'Чоловічий рід', Neuter: 'Середній рід', Feminine: 'Жіночий рід',
		'1st person': '1-ша особа', '2nd person': '2-га особа', '3rd person': '3-тя особа',
		'2nd person singular': '2-га особа однини', '1st person plural': '1-ша особа множини',
		'2nd person plural': '2-га особа множини'
	},
	pageTitle: { resources: 'Ресурси', saved: 'Збережені слова', about: 'Про проєкт' },
	meta: {
		homeTitle: 'Nebokrai: українсько-англійський словник з наголосами та відмінюванням',
		home: 'Безкоштовний українсько-англійський словник для тих, хто вивчає мову. Пошук українською, латинкою чи англійською; наголоси, таблиці відмінювання, аудіо та приклади.',
		about: 'Що таке Nebokrai, що тут можна робити, звідки взято слова й хто його створює.',
		resources: 'Курси, словники та сайти для практики української мови, дібрані вручну.',
		saved: 'Слова, які ви зберегли: у цьому браузері або у вашому обліковому записі.',
		report: 'Повідомте про помилку в словнику або про проблему на сайті.',
		wordTitle: (word, has) =>
			`${word}: ${listOf([
				'значення англійською', has.stress && 'наголос',
				has.table && (has.table === 'conjugation' ? 'дієвідмінювання' : 'відмінювання')
			], 'і')}`,
		wordShows: (has) => {
			const shown = listOf([
				has.stress && 'наголос', has.audio && 'аудіо',
				has.table && `повна таблиця ${has.table === 'conjugation' ? 'дієвідмінювання' : 'відмінювання'}`,
				has.examples && 'приклади речень'
			], 'та');
			return shown && `На сторінці: ${shown}.`;
		}
	},
	keyboard: {
		toggle: 'Українська клавіатура',
		label: 'Українська клавіатура',
		shift: 'Велика літера',
		backspace: 'Видалити',
		space: 'пробіл',
		holdFor: (key: string, alt: string) => `${key} (утримуйте для ${alt})`,
		stress: 'Наголос: ставить або знімає його на голосній перед курсором',
		physical: 'Друкувати українською на своїй клавіатурі'
	},
	report: {
		title: 'Повідомити про помилку',
		intro: 'Розкажіть, що виглядає неправильно. Більшість слів узято з Вікісловника й Tatoeba, тож чимало виправлень допоможе всім, хто ними користується.',
		kindLegend: 'Що не так?',
		kinds: {
			meaning: 'Неправильне чи відсутнє значення',
			stress: 'Неправильний наголос',
			forms: 'Неправильна форма слова',
			missing: 'Бракує слова',
			example: 'Невдалий приклад речення',
			site: 'Щось на сайті не працює',
			other: 'Інше'
		},
		messageLabel: 'Як має бути?',
		placeholders: {
			meaning: 'Яке значення неправильне чи відсутнє і яким воно має бути',
			stress: 'Правильний наголос, наприклад кни́га',
			forms: 'Яка форма неправильна і якою вона має бути',
			missing: 'Слово і, якщо знаєте, що воно означає',
			example: 'Яке речення і що з ним не так',
			site: 'Що ви робили, чого очікували і що сталося натомість',
			other: 'Ваше повідомлення'
		},
		emailLabel: 'Електронна пошта (необов’язково)',
		emailHint: 'Лише якщо хочете отримати відповідь. Ми видалимо її, коли закриємо звернення.',
		contextLabel: 'Ми додамо:',
		contextEntry: (word: string, pos: string) => `${word} (${pos})`,
		contextQuery: (q: string) => `ваш пошуковий запит «${q}»`,
		contextPage: 'сторінку, з якої ви прийшли',
		send: 'Надіслати',
		required: 'Будь ласка, опишіть проблему.',
		sending: 'Надсилаємо…',
		failed: 'Не вдалося надіслати звернення. Спробуйте ще раз або напишіть на contact@nebokrai.app.',
		tooMany: 'Ви надіслали кілька звернень за короткий час. Зачекайте кілька хвилин і спробуйте ще раз.',
		thanks: 'Дякуємо!',
		thanksBody: 'Ми читаємо кожне звернення.',
		fixUpstream: 'Ви також можете виправити це в джерелі, щоб виправлення отримали всі:',
		onWiktionary: (word: string) => `«${word}» у Вікісловнику`,
		addToWiktionary: (word: string) => `Додати «${word}» до Вікісловника`,
		preview: 'Що надіслано',
		another: 'Повідомити про інше'
	}
};

const messages: Record<Lang, Messages> = { en, uk };

export function messagesFor(lang: Lang): Messages {
	return messages[lang];
}

/** A label from forms.ts in the interface language (English if untranslated). */
export function formLabel(m: Messages, label: string): string {
	return m.forms[label] ?? label;
}

/** Part-of-speech display name. */
export function posLabel(m: Messages, pos: string): string {
	return m.pos[pos] ?? pos.charAt(0).toUpperCase() + pos.slice(1);
}
