// Interface text in English and Ukrainian. The meanings stay in English: they
// come from English Wiktionary. Its grammar tags ("feminine", "genitive") are
// named and explained here in both languages (`grammar`); a tag with no name
// here is shown as it is stored.
import { termOf, type Group, type HeadFormKey, type OtherFormKey, type TermId } from './grammar.ts';
import type { Cost, Kind, LevelSpan, Order, Price } from './resources.ts';
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

/**
 * A counted Ukrainian noun: 1 ресурс, 2 ресурси, 5 ресурсів. The first form
 * is for a number ending in 1 but not 11, the second for one ending in 2 to 4
 * but not 12 to 14, the third for the rest.
 */
function counted(n: number, one: string, few: string, many: string): string {
	const tens = n % 100;
	const units = n % 10;
	if (units === 1 && tens !== 11) return `${n} ${one}`;
	if (units >= 2 && units <= 4 && (tens < 12 || tens > 14)) return `${n} ${few}`;
	return `${n} ${many}`;
}

const en = {
	nav: { label: 'Main', dictionary: 'Dictionary', learn: 'Learn', resources: 'Resources', saved: 'Saved' },
	/** The header's link to /support, and that page's title. */
	support: { label: 'Support Ukraine', hint: 'Where to donate: United24 and other funds, by what they do' },
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
		/** Saved straight into the default lists, whose names follow as links: "Saved to Food, Lesson 3". */
		savedTo: 'Saved to',
		removed: 'Removed from saved',
		copied: 'Link copied',
		notCopied: 'Could not copy the link',
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
		ankiHint:
			'In Anki, choose File › Import and pick the downloaded file. Each word has three fields: the word, its meaning, and details (grammar, pronunciation, an example). A note type with two fields takes the first two.',
		send: 'Send',
		ankiSend: 'Anki, straight into the app',
		ankiNeeds: 'Needs Anki open, with the AnkiConnect add-on',
		ankiGet: 'Get AnkiConnect',
		ankiRetry: 'Try again',
		/** The dialog that says where a send puts the words (AnkiSettings.svelte). */
		ankiSettings: {
			open: 'Anki settings…',
			title: 'Anki settings',
			intro: 'Where “Anki, straight into the app” puts your words. Kept in this browser.',
			deck: 'Deck',
			deckHint: 'A name Anki doesn’t have yet makes a new deck. Write :: for a deck inside another: Languages::Ukrainian.',
			noteType: 'Note type',
			own: 'Nebokrai (made for these words)',
			fields: 'What goes in each field',
			values: { none: 'Nothing', word: 'Word', meaning: 'Meaning', details: 'Details', both: 'Meaning and details' },
			problem: {
				word: 'Exactly one field must hold the word: it is how a note is found again.',
				first: 'Anki refuses a note whose first field is empty.',
				tags: 'At least one tag is needed.'
			},
			ownNote: 'In a note type of your own, only notes with the first tag below count as sent from here. Cards you wrote yourself are left alone.',
			tags: 'Tags',
			tagsHint: 'Separated by spaces. Each note also gets its part of speech as a tag (noun, verb…).',
			update: 'Keep sent notes up to date',
			updateHint:
				'When you send a word that is already in Anki and its dictionary entry has changed since, the note gets the new text. Your review progress stays. Turn this off if you edit these notes in Anki: a send would overwrite your edits.',
			offline: 'Anki isn’t answering, so its decks and note types can’t be listed.',
			loading: 'Asking Anki…',
			save: 'Save',
			cancel: 'Cancel'
		},
		ankiFile: 'One more step, in Anki',
		ankiSent: {
			title: (deck: string) => `Sent to “${deck}” in Anki`,
			body: (added: number, updated: number, unchanged: number) =>
				`Added: ${added} · updated: ${updated} · unchanged: ${unchanged}.`
		},
		ankiError: {
			unreachable: {
				title: 'Anki didn’t answer',
				steps: [
					'Open Anki on this computer.',
					'Install the AnkiConnect add-on: Tools › Add-ons › Get Add-ons, code 2055492159. Then restart Anki.',
					'If the browser asks whether this site may reach apps on your device, allow it.'
				]
			},
			denied: {
				title: 'Anki refused the connection',
				body: 'Try again and choose Yes when Anki asks whether this site may connect.'
			},
			key: {
				title: 'AnkiConnect wants an API key',
				body: 'This page can’t send one. The text file works without it.'
			},
			setup: {
				title: 'The Anki settings no longer fit',
				body: 'The chosen note type is missing from Anki, or its fields have changed. Open the settings and choose again.'
			},
			failed: { title: 'Anki couldn’t take the words' }
		},
		which: 'Which words',
		scope: { all: 'All words', selected: 'Selected', fresh: 'Not exported yet' },
		as: 'File',
		exported: 'Exported',
		exportedOn: (date: string) => `Exported ${date}`,
		select: (word: string) => `Select ${word}`,
		selectAll: 'Select all',
		selectedCount: (n: number) => `${n} selected`
	},
	/** The lists saved words are sorted into (ListPicker.svelte and the Saved page). */
	lists: {
		heading: 'Lists',
		all: 'All',
		choose: 'Add to a list',
		none: 'No lists yet. Name the first one.',
		newName: 'New list',
		create: 'Create',
		name: 'Name',
		rename: 'Rename',
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete list',
		deleted: (name: string) => `List “${name}” deleted`,
		empty: 'No words in this list yet. To add one, press the list button beside a saved word.',
		taken: 'There is already a list with this name.',
		full: (max: number) => `You can have up to ${max} lists.`,
		whichIn: (name: string) => `Which words from “${name}”`,
		/** Under the lists when the bookmark asks where a word goes: stop it asking. */
		makeDefault: 'Use as default',
		makeDefaultHint: 'The next words you save will go to the lists chosen above, without this prompt.',
		defaultIs: (names: string) =>
			names ? `New words are saved to ${names} without asking.` : 'New words are saved to no list, without asking.',
		askAgain: 'Ask each time'
	},
	settings: {
		open: 'Settings',
		appearance: 'Appearance',
		system: 'System',
		light: 'Light',
		sepia: 'Sepia',
		dark: 'Dark',
		language: 'Interface language',
		layout: 'Keyboard layout',
		standard: 'ЙЦУКЕН',
		phonetic: 'Phonetic',
		layoutHint: 'Phonetic puts each letter on the Latin key that sounds alike.',
		background: 'Background',
		backgrounds: { plain: 'Plain', field: 'Field', hills: 'Hills' },
		radio: 'Radio',
		radioHint: 'Button in the corner that plays Ukrainian radio stations.',
		roman: 'Latin spelling',
		romanHint: 'A word’s page shows the word in Latin letters too: вода́, vodá.',
		ipa: 'Phonetic spelling',
		ipaHint: 'A word’s page shows how it sounds in the International Phonetic Alphabet: [wɔˈda].',
		blur: 'Hide translations',
		blurHint: 'The English under an example sentence stays blurred until you press it.'
	},
	/** The radio in the corner of the page (RadioPlayer.svelte). Station names stay as the stations write them. */
	radio: {
		open: 'Radio',
		openPlaying: (station: string) => `Radio: ${station} is playing`,
		play: 'Play',
		stop: 'Stop',
		loading: 'Connecting…',
		playing: 'On air',
		failed: 'This station is not answering. Try again, or pick another.',
		volume: 'Volume',
		kinds: { talk: 'Talk', music: 'Music' },
		site: 'The station’s site',
		minimise: 'Minimise',
		move: 'Drag to move the radio',
		hide: 'Hide the radio',
		hidden: 'Radio hidden. The settings bring it back.'
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
		about: 'About',
		sources: 'Sources and licences',
		privacy: 'Privacy',
		words: 'All words',
		discord: 'Discord community'
	},
	/** /learn: the four pages for learning, each as a card that leads to it. */
	learn: {
		/**
		 * The three things learnt here, kept apart everywhere on the page by
		 * name and by colour: words as flashcards, grammar rules, the letters.
		 */
		kind: { cards: 'Flashcards', grammar: 'Grammar' },
		/** The two doors at the head of the page: what each has waiting, and its button. */
		action: {
			cardsDue: (n: number) => (n === 1 ? '1 card to review' : `${n} cards to review`),
			cardsNone: 'No cards to review today',
			cardsGo: 'Review',
			rulesDue: (n: number) => (n === 1 ? '1 rule to practise' : `${n} rules to practise`),
			rulesNone: 'No rules to practise today',
			/** In place of a count, on the door of a kind that has not been begun. */
			notStarted: 'Not started yet',
			rulesGo: 'Practise'
		},
		activity: 'Activity',
		/** Beside "Activity": the reviews of the fourteen days its bars show. */
		inDays: (n: number) => `${n} in 14 days`,
		/** The headings of the page's three parts, under the doors. */
		vocabulary: 'Vocabulary',
		grammar: 'Grammar',
		reference: 'Reference',
		manageDecks: 'Manage decks',
		/** After the large figure of words known: "9 of 3,051 words known". */
		wordsKnown: (total: string) => `of ${total} words known`,
		learning: (n: number) => `${n} learning`,
		/** A deck's chip: the figure on it, and a deck not among those reviewed. */
		due: (n: number) => (n === 1 ? '1 due today' : `${n} due today`),
		off: 'not switched on',
		/** Over the list of lessons: what they are about. */
		cases: 'Cases',
		/** Each lesson in a word or two, in the list beside the open one. */
		short: {
			where: 'Location',
			'where-to': 'Direction',
			'with-from': 'With & From',
			numbers: 'Counting',
			'for-about': 'For & About',
			'before-after': 'Before & After',
			around: 'Nearby',
			'above-below': 'Above & Below'
		} as Record<string, string>,
		rulesKnown: (n: number, total: number) => `${n} of ${total} rules known`,
		/** Starts a round of the open lesson; and, on a row, of that rule alone. */
		practiseThis: 'Practise this',
		practise: 'Practise',
		/** The columns of the open lesson's table. */
		column: { after: 'After', takes: 'The noun takes', means: 'Means', example: 'Example', state: 'State' },
		state: { new: 'Not started', weak: 'Needs practice', learning: 'Learning', known: 'Known' },
		/** The tiles of the pages for reading, at the foot. */
		tile: {
			alphabet: 'Alphabet (Cyrillic)',
			letters: (n: number, total: number) => `${n} of ${total} letters`,
			common: 'Common vocabulary',
			commonNote: (n: string) => `${n} words`,
			grammar: 'Grammar syllabus',
			grammarNote: 'Gender, cases, verbs…'
		},
		/**
		 * What a newcomer sees in place of the dashboard, until the first
		 * flashcard or grammar round: three steps in the order to take them.
		 */
		first: {
			title: 'Start here',
			lead: 'Three steps to begin, in this order.',
			letters: {
				name: 'Learn to read the letters',
				text: (n: number) => `${n} Cyrillic letters, with a short drill to read them.`,
				go: 'Learn the letters',
				skip: 'I can read them already',
				done: 'You can read the letters.',
				undo: 'Undo'
			},
			words: {
				name: 'Meet your first words',
				text: 'Ten new flashcards a day from the 500 commonest words.',
				go: 'Start the first words'
			},
			grammar: {
				name: 'Try a round of grammar',
				text: 'Ten real sentences, each with a gap to fill.',
				go: 'Start a round'
			}
		}
	},
	/** The pages for browsing: /common-words and /words (browse.ts). */
	browse: {
		commonTitle: 'The 1,000 most common Ukrainian words',
		commonLead: 'The words you\'ll meet most often, with the most common listed first.',
		commonSource: 'Counted from film and television subtitles, so everyday speech weighs more than books.',
		commonPages: 'Parts of the list',
		wordsTitle: 'All words',
		wordsLead: 'Every word in the dictionary under its first letter, in alphabetical order.',
		wordsCommon: 'Or start with the 1,000 most common words.',
		wordsAlphabet: 'New to the letters? Learn the alphabet first.',
		letterTitle: (letter: string) => `Words beginning with ${letter}`,
		otherTitle: 'Other entries',
		otherLead: 'Entries that begin with no Ukrainian letter.',
		other: 'Other',
		alphabet: 'Letters',
		pages: 'Pages',
		previous: 'Previous page',
		next: 'Next page',
		all: 'All letters'
	},
	home: {
		/** The title's first line; its last word is drawn (title-paths.ts). */
		titlePair: 'Ukrainian–English',
		tryLabel: 'Try',
		wordOfDay: 'Word of the day',
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
		share: 'Share this word',
		details: 'Details',
		genitive: 'gen.',
		noEntry: 'A Ukrainian word with no dictionary entry yet.',
		/** Before the form of the word that the search found: руки́ genitive singular */
		formFound: 'Form found:',
		moreForms: (n: number) => `+${n} more`,
		/** After a result's first two meanings, leading to the word's page: брати has 25 */
		moreMeanings: (n: number) => `+${n} more`,
		/** When it is known to be a form of the word, but not which */
		someForm: 'Your search is a form of this word.'
	},
	word: {
		back: 'Back to search',
		entries: 'Entries on this page',
		playRecording: 'Play recording',
		playVoice: 'Play computer voice',
		meanings: 'Meanings',
		examples: 'Example sentences',
		/** On each word of an example sentence */
		lookUp: 'Look up this word',
		/** Above the entries of за́мок and замо́к */
		sameSpelling: 'Same spelling, different stress: the meaning changes with it.',
		forms: 'Forms',
		conjugation: 'Conjugation',
		/** Covering the forms of a table to recall them (FormTables.svelte). */
		cover: 'Test yourself',
		coverHow: 'Say each form, then press its place to check.',
		coverCount: (n: number, total: number) => `${n} of ${total} shown`,
		coverAgain: 'Cover again',
		/** Said of a covered place, before the names of its row and column. */
		coverShow: 'Show the form',
		/** The switch above the tables: the table as it is, or covered to test oneself */
		mode: 'Show the forms or test yourself',
		/** On a blurred translation (Translation.svelte) */
		reveal: 'Show the English',
		table: 'Table',
		/** The closed row under the first meanings */
		moreMeanings: (n: number) => `${n} more meaning${n === 1 ? '' : 's'}`,
		/** Under the tables; the headword follows, then a full stop. */
		stressMoves: 'Underlined letters carry the stress where it moves away from',
		stressStays: 'The stress stays on the same syllable in every form.',
		synonyms: 'Synonyms',
		antonyms: 'Antonyms',
		/** The section of derived words and words of the same root */
		family: 'Related words',
		derived: 'Derived',
		sameRoot: 'Same root',
		/** Rows of Related words made from the forms beside the headword (grammar.ts RELATED_HEAD_FORMS) */
		relatedRows: {
			relatedAdjective: 'Adjectives',
			diminutive: 'Diminutives',
			relatedNoun: 'Nouns',
			relatedAdverb: 'Adverbs',
			augmentative: 'Augmentatives'
		} as Partial<Record<HeadFormKey, string>>,
		showAll: (n: number) => `show all ${n}`,
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
		particle: 'Particle', intj: 'Interjection', phrase: 'Phrase',
		suffix: 'Suffix', prefix: 'Prefix', interfix: 'Interfix', combining_form: 'Combining form',
		det: 'Determiner', postp: 'Postposition', prep_phrase: 'Prepositional phrase', proverb: 'Proverb',
		character: 'Letter', symbol: 'Symbol', punct: 'Punctuation mark'
	} as Record<string, string>,
	/** Table titles and labels from forms.ts, keyed by their English text. */
	forms: {} as Record<string, string>,
	/**
	 * The grammar words (grammar.ts lists them). `text` tells a learner what
	 * the word changes for them, in a sentence or two; it must hold for every
	 * word that carries the tag.
	 */
	grammar: {
		more: 'More in the guide',
		/** The link beside a word's tables */
		explained: 'What these words mean',
		/** A search result's grammar line on a phone, where "imperfective" has no room beside the word */
		short: { perfective: 'pf.', imperfective: 'impf.' } as Record<string, string>,
		groups: {
			pos: 'Kinds of word',
			gender: 'Gender',
			animacy: 'Things and living beings',
			number: 'Number',
			cases: 'Cases',
			verbs: 'Verbs',
			words: 'Related forms',
			usage: 'Where a word is used'
		} as Record<Group, string>,
		/** Said under a group's heading. The parts of speech go without. */
		intros: {
			gender: 'Every Ukrainian noun has one of three genders. The gender decides the endings of the words that go with the noun, and the pronoun that stands for it.',
			animacy: 'Ukrainian grammar treats a thing differently from a living being. It decides the form in one case, the accusative.',
			number: 'One or more than one, and the words that have only one of the two.',
			cases: 'A noun changes its ending with its role in the sentence. There are seven roles, called cases, and Ukrainian schools teach each by the question it answers.',
			verbs: 'A verb’s endings show who acts and when. Most verbs come in pairs, one for the action in progress and one for the action completed.',
			words: 'Forms made from a word that a dictionary lists beside it.',
			usage: 'Remarks on a meaning that say where or when it is used.'
		} as Partial<Record<Group, string>>,
		caseTable: { name: 'Case', question: 'Question', example: 'Example' },
		/** The guide's list of its sections, and the way back to it from each */
		sections: 'Sections',
		toSections: 'All sections',
		count: (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`,
		terms: {
			noun: { name: 'Noun', text: 'A word for a thing, a person, a place or an idea. A Ukrainian noun has a gender, and its ending changes with its role in the sentence.' },
			verb: { name: 'Verb', text: 'A word for an action or a state. Its ending shows who acts and when.' },
			adjective: { name: 'Adjective', text: 'A word that describes a noun. It takes the gender, number and case of the noun it describes.' },
			adverb: { name: 'Adverb', text: 'A word that describes an action or a quality: how, when or where. It never changes its form.' },
			pronoun: { name: 'Pronoun', text: 'A word that stands in for a noun.' },
			numeral: { name: 'Numeral', text: 'A number word. Numerals change by case, and the noun after one changes its form too.' },
			preposition: { name: 'Preposition', text: 'A small word before a noun, such as in, on, with or for. Each preposition asks for a particular case of the noun after it.' },
			conjunction: { name: 'Conjunction', text: 'A word that joins words or sentences.' },
			particle: { name: 'Particle', text: 'A small word that adds a shade of meaning: a question, a denial, emphasis. It never changes its form.' },
			interjection: { name: 'Interjection', text: 'A word said on its own: a greeting, a reaction, a call.' },
			determiner: { name: 'Determiner', text: 'A word before a noun that says which one or how many: this, such, a few. Ukrainian school grammar counts most of them as pronouns or numerals.' },
			masculine: { name: 'Masculine', text: 'One of the three genders. A masculine noun is spoken of as він (he), and an adjective with it ends in -ий or -ій. Most masculine nouns end in a consonant.' },
			feminine: { name: 'Feminine', text: 'One of the three genders. A feminine noun is spoken of as вона (she), and an adjective with it ends in -а or -я. Most feminine nouns end in -а or -я.' },
			neuter: { name: 'Neuter', text: 'One of the three genders. A neuter noun is spoken of as воно (it), and an adjective with it ends in -е or -є. Most neuter nouns end in -о, -е or -я.' },
			inanimate: { name: 'Inanimate', text: 'A thing, not a person or an animal. It matters in the accusative case, the form after “I see”: there a masculine noun, and any noun in the plural, keeps its dictionary form if it is a thing and takes the genitive form if it is a living being.' },
			animate: { name: 'Animate', text: 'A living being: a person or an animal. In the accusative case, the form after “I see”, a masculine animate noun and any animate noun in the plural take the genitive form.' },
			person: { name: 'Person', text: 'A word for a human being. Grammar counts it as a living being: after “I see”, a masculine noun for a person and any such noun in the plural take the genitive form.' },
			animal: { name: 'Animal', text: 'A word for an animal. Grammar counts it as a living being, like a person. In the plural, after “I see”, it usually takes the genitive form too, though some animals may keep the dictionary form.' },
			'common-gender': { name: 'Common gender', text: 'A noun for a person that is masculine or feminine according to who is meant.' },
			singular: { name: 'Singular', text: 'One of something.' },
			plural: { name: 'Plural', text: 'More than one. When a noun’s own line says plural, the word exists only in the plural, like двері (a door) or гроші (money).' },
			'plural-only': { name: 'Plural only', text: 'The word, or this meaning of it, exists only in the plural, even for a single thing.' },
			countable: { name: 'Countable', text: 'Can be counted, so it has a plural.' },
			uncountable: { name: 'Uncountable', text: 'Cannot be counted, so it is normally used only in the singular.' },
			collective: { name: 'Collective', text: 'A singular word for a group taken as a whole.' },
			indeclinable: { name: 'Indeclinable', text: 'The word has one form for every case and number. Most such words are borrowed.' },
			declension: { name: 'Declension', text: 'How a noun, adjective or pronoun changes its ending through the seven cases, in the singular and the plural.' },
			nominative: { name: 'Nominative', text: 'The dictionary form. It names who or what does the action.' },
			genitive: { name: 'Genitive', text: 'The “of” form: belonging, absence and amounts. It follows немає (there is no), many prepositions and words of quantity. Dictionaries list it because it shows how the word declines.' },
			dative: { name: 'Dative', text: 'The “to” or “for” form: the one who receives something. Ukrainian also puts a person in the dative to give their age and to say what they like.' },
			accusative: { name: 'Accusative', text: 'The direct object: the thing or person the action is done to.' },
			instrumental: { name: 'Instrumental', text: 'The “with” or “by” form. On its own it names the tool or the means; after з (with) it names the companion.' },
			locative: { name: 'Locative', text: 'The place form. It is used only after a preposition, most often в or у (in) and на (on, at).' },
			vocative: { name: 'Vocative', text: 'The form for calling or addressing someone.' },
			conjugation: { name: 'Conjugation', text: 'How a verb changes its ending for the person, the number and the tense.' },
			imperfective: { name: 'Imperfective', text: 'The verb shows the action as going on, repeated or habitual, without saying that it was finished. Most verbs come in a pair, one imperfective and one perfective.' },
			perfective: { name: 'Perfective', text: 'The verb shows the action as a completed whole, done once and finished. A perfective verb has no present tense: its forms that look like the present mean the future.' },
			infinitive: { name: 'Infinitive', text: 'The dictionary form of a verb, “to do”. It ends in -ти.' },
			'first-person': { name: '1st person', text: 'The one who speaks: я (I) and ми (we).' },
			'second-person': { name: '2nd person', text: 'The one spoken to: ти (one person you know well) and ви (several people, or one person politely).' },
			'third-person': { name: '3rd person', text: 'Someone or something else: він, вона, воно (he, she, it) and вони (they).' },
			imperative: { name: 'Imperative', text: 'The form for telling or asking someone to do something.' },
			transitive: { name: 'Transitive', text: 'The verb takes a direct object, in the accusative case: you read something.' },
			intransitive: { name: 'Intransitive', text: 'The verb takes no direct object: the action stays with the one who does it.' },
			impersonal: { name: 'Impersonal', text: 'Used with no one named as doing the action. The verb forms in -но and -то work this way: they say that something was done, not by whom.' },
			participle: { name: 'Participle', text: 'A form of a verb that works as an adjective.' },
			'adverbial-participle': { name: 'Adverbial participle', text: 'A form of a verb for a second action by the same person: “while doing” (present) or “having done” (past). It never changes its form.' },
			comparative: { name: 'Comparative', text: 'The “more” form of an adjective or adverb.' },
			superlative: { name: 'Superlative', text: 'The “most” form. It adds най- to the comparative.' },
			relational: { name: 'Relational adjective', text: 'An adjective that says what something has to do with, most often made from a noun: “of” or “relating to” it. It has no “more” or “most” forms.' },
			predicative: { name: 'Predicative', text: 'Used as the main statement of a sentence, without a verb, usually about a state or a need.' },
			diminutive: { name: 'Diminutive', text: 'A form that makes the word small or affectionate. Ukrainian uses these a great deal.' },
			augmentative: { name: 'Augmentative', text: 'A form that makes the word big, strong or rough.' },
			derived: { name: 'Derived word', text: 'A word made from this one by adding a prefix, a suffix or another word, often with a meaning of its own.' },
			'same-root': { name: 'Same root', text: 'A word that shares this one’s root, the core that carries the meaning, though neither is made from the other.' },
			colloquial: { name: 'Colloquial', text: 'Used in everyday speech, not in formal writing.' },
			dialectal: { name: 'Dialectal', text: 'Used in some regions, not everywhere in the standard language.' },
			dated: { name: 'Dated', text: 'Once common and still heard now and then, but it sounds old-fashioned.' },
			archaic: { name: 'Archaic', text: 'No longer in general use, but still understood; found in old texts and in writing made to sound old.' },
			figurative: { name: 'Figurative', text: 'Not the literal meaning: the word is used as an image.' },
			slang: { name: 'Slang', text: 'Very informal words used inside one group of people: a trade, an age, a pastime.' }
		} as Record<TermId, { name: string; text: string }>,
		/** A form beside the headword: "related adjective ка́вовий" */
		headForms: {
			genitive: 'genitive', plural: 'plural', genitivePlural: 'genitive plural',
			relatedAdjective: 'related adjective', relatedAdverb: 'related adverb', relatedNoun: 'related noun',
			perfectivePartner: 'perfective partner', imperfectivePartner: 'imperfective partner',
			feminineForm: 'feminine form', masculineForm: 'masculine form', also: 'also',
			diminutive: 'diminutive', augmentative: 'augmentative', comparative: 'comparative',
			superlative: 'superlative', uppercase: 'capital letter', lowercase: 'small letter'
		} as Record<HeadFormKey, string>,
		/** A verb form outside the tables */
		otherForms: {
			infinitive: 'infinitive', presentAdverbial: 'present adverbial participle',
			pastAdverbial: 'past adverbial participle', impersonalPast: 'impersonal past',
			presentActive: 'present active participle', pastActive: 'past active participle',
			presentPassive: 'present passive participle', pastPassive: 'past passive participle'
		} as Record<OtherFormKey, string>,
		/** Tags that are no term of their own, keyed as stored. English shows them as they are. */
		tags: {} as Record<string, string>
	},
	review: {
		open: 'Flashcards',
		help: {
			open: 'How the flashcards work',
			close: 'Close',
			title: 'How the flashcards work',
			intro: 'Each card shows a Ukrainian word. Try to recall what it means, then show the answer and say whether you knew it.',
			sections: [
				{
					heading: 'Again and Good',
					body: [
						'Good if you remembered the meaning, even slowly. Again if you did not, or got it wrong.',
						'Good puts the card off for longer each time. Again brings it back in ten minutes and makes the gaps after it shorter.'
					]
				},
				{
					heading: 'When a card comes back',
					body: [
						'The site uses FSRS (Free Spaced Repetition Scheduler), the same method Anki offers. For each word it keeps two numbers: how long you are likely to remember it, and how hard it is for you. Each answer updates both.',
						'A card is shown again on the day your chance of remembering it is expected to fall to 90%. A word you know well can wait weeks or months; a hard one comes back sooner.',
						'A new word is first seen twice within minutes, after one and then ten minutes, before its gaps are counted in days.'
					]
				},
				{
					heading: 'A day of review',
					body: [
						'A day starts at four in the morning, so a review just after midnight counts towards the evening before.',
						'New cards a day limits only words you have not seen yet. Every card that is due is shown, however many there are.'
					]
				},
				{
					heading: 'Decks',
					body: [
						'Saved words takes every word you saved, lists included. A list can also be switched on by itself. The common-word decks hold the most frequent Ukrainian words, in order of frequency.'
					]
				},
				{
					heading: 'The streak',
					body: [
						'The flame shows how many days in a row you have reviewed at least one card. It is lit once you have reviewed today; a day without reviews ends the streak only when the day is over.'
					]
				},
				{
					heading: 'Where your reviews are kept',
					body: [
						'In this browser. Signed in, they are also kept in your account and are the same on every device.',
						'The schedule uses the standard FSRS settings, not ones fitted to your own answers.'
					]
				}
			],
			more: 'How FSRS works in detail:',
			moreLink: 'the algorithm, by the Open Spaced Repetition project'
		},
		openDue: (n: number) => `Flashcards: ${n} to review`,
		/** Not built yet: shown greyed out, so the way it will go is visible. */
		planned: { note: '(planned)', deck: 'Import a deck', list: 'Import into a list' },
		streakDays: (n: number) => (n === 1 ? 'A streak of 1 day' : `A streak of ${n} days`),
		streakWaits: 'Review a card today to keep it',
		practise: 'Practise these words',
		practiseCommon: 'Practise these words with flashcards',
		lead: 'Flashcards from your saved words and from the commonest words. Each card comes back shortly before you would forget it.',
		learning: 'Learning',
		due: 'To review',
		fresh: 'New',
		start: 'Start',
		nothingToday: 'Nothing left to review today.',
		noWords: 'Save some words, or switch on a deck of common words, to begin.',
		decks: 'Decks',
		deck: {
			saved: 'Saved words',
			'common-500': 'Common words 1–500',
			'common-1000': 'Common words 501–1,000',
			'common-2000': 'Common words 1,001–2,000'
		} as Record<string, string>,
		// 1,000 as the deck's name writes it ("Common words 1,001–2,000")
		progress: (started: number, total: number) =>
			`${started.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} started`,
		inSaved: 'Included in Saved words',
		/** /review?deck= or ?list=: this visit is for one deck alone. */
		onlyList: (name: string) => `Only the deck “${name}”.`,
		allDecks: 'Practise all your decks',
		newPerDay: 'New cards a day',
		kept: 'Your reviews are kept in this browser. Sign in on the Saved page to have them on every device.',
		keptAccount: 'Your reviews are kept in your account.',
		show: 'Show answer',
		again: 'Again',
		good: 'Good',
		keys: {
			action: {
				show: 'Show answer, then Good',
				again: 'Again',
				good: 'Good',
				replay: 'Play recording',
				undo: 'Undo'
			},
			hint: 'Click a key to change it.',
			press: 'Press the new key, or Esc to keep the old one.',
			reset: 'Back to the usual keys',
			change: (action: string, key: string) => `${action}: ${key}. Change the key`
		},
		swipe: 'Tap the card for the answer, then swipe it left for Again or right for Good.',
		heatmap: {
			streak: 'Current streak',
			longest: 'Longest streak',
			average: 'Daily average',
			learned: 'Days learned',
			days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
			cards: (n: number) => (n === 1 ? '1 card' : `${n} cards`),
			reviewed: (n: number, when: string) => (n === 1 ? `1 review on ${when}` : `${n} reviews on ${when}`),
			none: (when: string) => `No reviews on ${when}`,
			due: (n: number, when: string) => (n === 1 ? `1 card due on ${when}` : `${n} cards due on ${when}`),
			noneDue: (when: string) => `Nothing due on ${when}`,
			less: 'Less',
			more: 'More',
			dueLegend: 'Due',
			label: (total: number, days: number) =>
				`Reviews by day over the past eight months, and cards due in the next two: ${total} reviews on ${days} days.`
		},
		undo: 'Undo',
		undone: 'Answer taken back',
		openWord: 'Open in the dictionary',
		left: (n: number) => `${n} left`,
		end: 'Stop',
		loading: 'Loading the cards…',
		loadFailed: 'The cards could not be loaded. Check your connection and try again.',
		retry: 'Try again',
		done: 'Done for now',
		reviewed: (n: number) => (n === 1 ? '1 card reviewed.' : `${n} cards reviewed.`),
		next: (when: string) => `The next card is due in ${when}.`,
		backToDecks: 'Back to the decks',
		span: {
			min: (n: number) => `${n} min`,
			h: (n: number) => `${n} h`,
			d: (n: number) => `${n} d`,
			mo: (n: number) => `${n} mo`,
			y: (n: number) => `${n} y`
		}
	},
	/** The alphabet trainer (/alphabet). The letters themselves are in alphabet/letters.ts. */
	alphabet: {
		lead: 'Learn to read Ukrainian Cyrillic. Choose the groups to practise.',
		chosen: (n: number) => (n === 1 ? '1 letter chosen' : `${n} letters chosen`),
		known: (n: number, total: number) => `${n} of ${total} known`,
		start: 'Start',
		kept: 'Your progress is kept in this browser.',
		/** Then the speaker's name and the licence, as links, and `commons`. */
		recordings: 'The letters are read by',
		commons: 'on Wikimedia Commons',
		/** The licence asks that changes be said. */
		recordingsCut: 'Each recording has been cut down to the letter and cleaned of noise.',
		mute: 'Mute recordings',
		forget: 'Start over',
		forgetConfirm: 'Forget what you have practised? Every letter becomes new again.',
		letters: 'The letters',
		/** The six groups, in the order they are best learnt (GROUP_IDS). */
		group: {
			same: { name: 'Old friends', note: 'They look and sound much as they do in English.' },
			'false-friends': {
				name: 'False friends',
				note: 'They look like Latin letters and sound different.'
			},
			'new-shapes': { name: 'New shapes', note: 'New to the eye, familiar to the ear.' },
			hushing: { name: 'Hushing sounds', note: 'One letter where Latin needs two or more.' },
			iotated: { name: 'Vowels with a y', note: 'A y and a vowel in one letter, and the y by itself.' },
			signs: { name: 'Signs', note: 'No sound of their own: they change how the letters beside them are read.' }
		} as Record<string, { name: string; note: string }>,
		/** Said of a letter's tile, for those who cannot see its mark. */
		state: { new: 'not practised yet', learning: 'learning', known: 'known' },
		/** What the soft sign and the apostrophe are called where another letter has its Latin. */
		sign: { ь: 'soft sign', "'": 'apostrophe' } as Record<string, string>,
		details: {
			latin: 'Latin',
			name: 'Name',
			sound: 'Sound',
			example: 'As in',
			words: (letter: string) => `Words beginning with ${letter}`,
			listen: 'Hear the letter',
			close: 'Close'
		},
		options: 'How to practise',
		answerLabel: 'Answer by',
		answer: { choice: 'Selecting', type: 'Writing' },
		directionLabel: 'You are shown',
		direction: { read: 'Cyrillic', write: 'Latin' },
		contentLabel: 'Practise',
		content: { letters: 'Letters', words: 'Words', both: 'Both' },
		sound: 'Play recording after an answer',
		/** Shown only when words were asked for and too few can be read. */
		wordsTooFew: (n: number) =>
			`${n === 1 ? 'Only 1 common word' : n ? `Only ${n} common words` : 'No common word'} can be read with these letters alone, so letters will be asked. Add a group to practise words.`,
		count: (n: number, total: number) => `${n} of ${total}`,
		right: 'Right',
		wrong: 'Wrong',
		streak: 'In a row',
		stop: 'Stop',
		ask: {
			letterChoice: 'Which Latin letters stand for it?',
			letterType: 'Type it in Latin letters',
			signChoice: 'What is this sign?',
			wordChoice: 'How is this word read?',
			wordType: 'Type the word in Latin letters',
			writeChoice: 'Which letter is it?',
			writeType: 'Type the Ukrainian letter'
		},
		yourAnswer: 'Your answer',
		check: 'Check',
		next: 'Next',
		correct: 'Right',
		incorrect: 'Not quite',
		answerIs: 'The answer is',
		keys: 'Keys 1 to 4 choose an answer; Enter goes on.',
		done: 'Round finished',
		score: (right: number, total: number) => `${right} of ${total} right.`,
		best: (n: number) => `Longest run: ${n} in a row.`,
		missed: 'To look at again',
		allRight: 'Nothing missed.',
		again: 'Another round',
		back: 'Back to the letters'
	},
	/** Grammar practice (/practice). The rules themselves are in practice/points.ts. */
	practice: {
		lead: 'Fill the gap in a sentence. A round is ten sentences and mixes the rules you are learning: prepositions with the case each one asks for, in real sentences, and numbers with the form of what they count.',
		none: 'There are no sentences to practise with yet.',
		answerLabel: 'Answer by',
		answer: { choice: 'Selecting', type: 'Writing' },
		start: 'Start a round',
		met: (n: number, total: number) => `${n} of ${total} rules met`,
		kept: 'Your progress is kept with your flashcards: in this browser, and in your account when you are signed in.',
		rules: 'The rules',
		/** Under the heading of the map of the rules. */
		map: 'Each rule is marked by how well you hold it. Select one to practise it alone.',
		/** Starts a round of the rules held least well, and what such a round is. */
		weak: 'Weak spots',
		weakTitle: 'A round of the rules you hold least well',
		/** What each lesson is about (lessons.ts), after "Lesson 3". */
		lessons: {
			where: 'Where something is',
			'where-to': 'Where something goes',
			'with-from': 'With whom and from where',
			numbers: 'Numbers with nouns',
			'for-about': 'For, without and about',
			'before-after': 'Before, after and through',
			around: 'Near, behind and between',
			'above-below': 'Above, below and against'
		} as Record<string, string>,
		lessonN: (n: number) => `Lesson ${n}`,
		/** On a lesson's heading: how many of its rules are known. */
		knownOf: (n: number, total: number) => `${n} of ${total} known`,
		search: 'Search the rules',
		/** A switch: the rules already known are left off the map. */
		hideKnown: 'Hide known',
		noMatch: 'No rule matches that.',
		/** Every rule is known and the known ones are hidden. */
		allKnown: 'Every rule is known and hidden.',
		/** After the case a number asks for: "nominative plural", називний відмінок множини. */
		ofNumber: { singular: 'singular', plural: 'plural' },
		/** Said of a rule's row, which starts a round of that rule alone. */
		only: 'Practise this rule alone',
		state: { new: 'new', weak: 'shaky', learning: 'learning', known: 'known' },
		/** What each preposition says with its case, in a few words. */
		meaning: {
			'u-loc': 'in, at: where something is',
			'na-loc': 'on, at: where something is',
			'u-acc': 'into, to: where something goes; on a day',
			'na-acc': 'onto, to: where something goes; for a time or a purpose',
			'z-ins': 'with, together with',
			'do-gen': 'to, up to, until',
			'z-gen': 'from, out of, off',
			'dlia-gen': 'for',
			'bez-gen': 'without',
			'pro-acc': 'about',
			'vid-gen': 'from, since, because of',
			'za-acc': 'for, in return for; than',
			'za-ins': 'behind, beyond; to fetch',
			'pislia-gen': 'after',
			'pered-ins': 'in front of, before',
			'bilia-gen': 'near, by',
			'cherez-acc': 'across, through; because of; in an hour',
			'po-loc': 'along, around, about',
			'pid-ins': 'under: where something is',
			'pid-acc': 'under: where something goes',
			'nad-ins': 'above, over',
			'mizh-ins': 'between, among',
			'proty-gen': 'against',
			'sered-gen': 'among, in the middle of',
			'one-nom': 'one, and numbers that end in one: the noun as the dictionary has it',
			'few-nom': 'two to four, and numbers that end in them: the plural',
			'many-gen': 'five and more, and 11 to 14: the plural in the genitive'
		} as Record<string, string>,
		count: (n: number, total: number) => `${n} of ${total}`,
		stop: 'Stop',
		ask: { choice: 'Which form fits the gap?', type: 'Type the word in the form that fits the gap' },
		/** Beside the word to put in, when the gap wants its plural. */
		plural: 'plural',
		hint: 'Show the case',
		/** A typed answer that is the right word in another form: one more try. */
		nudge: 'The right word, but not in this form. Try once more.',
		yourAnswer: 'Your answer',
		check: 'Check',
		next: 'Next',
		correct: 'Right',
		helped: 'Right, with help',
		incorrect: 'Not quite',
		keys: 'Keys 1 to 4 choose an answer; Enter goes on.',
		loading: 'Finding sentences…',
		failed: 'The sentences could not be loaded.',
		retry: 'Try again',
		done: 'Round finished',
		score: (right: number, total: number) => `${right} of ${total} right.`,
		missed: 'To look at again',
		allRight: 'Nothing missed.',
		again: 'Another round',
		back: 'Back to the rules'
	},
	pageTitle: {
		resources: 'Resources', saved: 'Saved words', about: 'About', grammar: 'The different Grammar words explained',
		review: 'Flashcards', alphabet: 'Ukrainian Alphabet', practice: 'Grammar practice', learn: 'Learn Ukrainian',
		privacy: 'Privacy'
	},
	/**
	 * What search results and link previews show for each page: its title and
	 * a description of about 150 characters (PageMeta.svelte, seo.ts). Search
	 * engines send no cookies, so they read the English ones.
	 */
	meta: {
		homeTitle: 'Nebokrai: Ukrainian–English dictionary with stress and declension',
		home: 'A free Ukrainian–English dictionary for learners. Search in Ukrainian, Latin letters or English and see the stress, full inflection tables, audio and examples.',
		about: 'What Nebokrai is, what you can do with it, where its words come from and who makes it.',
		learn: 'Start learning Ukrainian: the alphabet with a drill on its 33 letters, the 1,000 most common words, the grammar words explained, and grammar practice.',
		privacy: 'What Nebokrai keeps and what it does not: no ads and no tracking, cookies only for signing in and settings, and what an account or a report stores.',
		grammar: 'Ukrainian grammar words in plain English: gender, the seven cases and the question each answers, verb aspect, and what they change in a sentence.',
		resources: 'Courses, podcasts, dictionaries and tools for learning Ukrainian, chosen by hand, with the level and the cost of each.',
		support: 'Where to donate to Ukraine: United24 and other funds for defence, medicine, aid, children, education, animals, rebuilding, culture and veterans.',
		commonWords: 'The 1,000 most common Ukrainian words in order of frequency, each with its stress mark, part of speech and meaning in English.',
		words: 'Browse the whole Ukrainian–English dictionary by letter: every word in alphabetical order, each with its stress, forms and meanings.',
		/** Ukrainian words beginning with П, from па to перев */
		letter: (letter: string, first: string, last: string) =>
			`Ukrainian words beginning with ${letter}, from ${first} to ${last}, each with its meaning in English, stress and forms.`,
		other: 'Dictionary entries that begin with no Ukrainian letter: signs, and words written in other alphabets.',
		saved: 'The words you saved, kept in this browser or in your account.',
		review: 'Flashcards for your saved words and the commonest Ukrainian words, scheduled so that each word comes back shortly before you would forget it.',
		alphabet: 'Learn to read the Ukrainian alphabet: all 33 letters with their sounds and Latin spelling, and a drill on letters and real words that remembers the ones you miss.',
		practice: 'Practise Ukrainian grammar in real sentences: fill the gap after a preposition with the right case. Ten sentences a round, and each rule returns before you forget it.',
		report: 'Tell us about a mistake in the dictionary or a problem with the site.',
		/** What static/og.png shows, for those who cannot see it (scripts/og-image.ts draws it). */
		picture: 'Nebokrai, a Ukrainian–English dictionary. The entry for небокрай, “horizon”, with its stress marked and an example sentence.',
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
	/** The Resources page: the list itself is in resources.ts. */
	resources: {
		intro: 'Other good places to learn Ukrainian:',
		priceLabel: 'Price',
		prices: { any: 'Any', free: 'Free', paid: 'Paid' } as Record<Price, string>,
		orderLabel: 'Sort',
		orders: { easiest: 'Easiest first', hardest: 'Hardest first' } as Record<Order, string>,
		/** A group's heading */
		kinds: {
			course: 'Courses', podcast: 'Podcasts', reading: 'Reading', dictionary: 'Dictionaries',
			tool: 'Tools', tutor: 'Tutors', community: 'Community', book: 'Books'
		} as Record<Kind, string>,
		/** On a resource's own line */
		kind: {
			course: 'Course', podcast: 'Podcast or video', reading: 'Reading and listening',
			dictionary: 'Dictionary or reference', tool: 'Tool', tutor: 'Tutors', community: 'Community', book: 'Book'
		} as Record<Kind, string>,
		cost: { free: 'Free', freemium: 'Free + paid', paid: 'Paid' } as Record<Cost, string>,
		/** The price pill: green 'Free', gold 'Paid', or both halves for free + paid */
		pill: { free: 'Free', paid: 'Paid', plusPaid: '+ paid' },
		ukOnly: 'UK',
		ukOnlyHint: 'In Ukrainian only',
		levels: {
			beginner: 'Beginner',
			intermediate: 'Intermediate',
			advanced: 'Advanced',
			'beginner-intermediate': 'Beginner to intermediate',
			'intermediate-advanced': 'Intermediate and up',
			'beginner-intermediate-advanced': 'Every level'
		} as Record<LevelSpan, string>,
		count: (shown: number, total: number) =>
			shown === total ? `${total} ${total === 1 ? 'resource' : 'resources'}` : `${shown} of ${total}`,
		reviewed: (date: string) => `Last reviewed ${date}`,
		howTitle: 'How we choose',
		how: 'Every link here is one we have opened and looked through ourselves. Each is useful without paying, or is plainly marked as paid. Nothing here is made in Russia, and nobody pays to be listed: there are no adverts and no affiliate links.',
		suggestLead: 'Know a good one we missed?',
		suggest: 'Suggest a resource'
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
			resource: 'Suggest a learning resource',
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
			resource: 'The link, and who it’s good for',
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
		/** The bot check (Turnstile.svelte) gave no token, or the server refused it. */
		check: 'The check that you’re not a bot hasn’t finished. Wait for the box above to show a tick, or tick it, and send again.',
		checkNote: 'Cloudflare Turnstile checks that a person, not a bot, is sending this.',
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
	nav: { label: 'Головне меню', dictionary: 'Словник', learn: 'Навчання', resources: 'Ресурси', saved: 'Збережене' },
	support: { label: 'Підтримати Україну', hint: 'Куди задонатити: United24 та інші фонди, за тим, що вони роблять' },
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
		savedTo: 'Збережено до:',
		removed: 'Прибрано зі збереженого',
		copied: 'Посилання скопійовано',
		notCopied: 'Не вдалося скопіювати посилання',
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
		ankiHint:
			'В Anki виберіть «Файл» › «Імпортувати» й укажіть завантажений файл. Кожне слово має три поля: слово, значення й подробиці (граматика, вимова, приклад). Тип нотатки з двома полями візьме перші два.',
		send: 'Надіслати',
		ankiSend: 'Anki, просто в застосунок',
		ankiNeeds: 'Потрібен відкритий Anki з додатком AnkiConnect',
		ankiGet: 'Отримати AnkiConnect',
		ankiRetry: 'Спробувати ще раз',
		ankiSettings: {
			open: 'Налаштування Anki…',
			title: 'Налаштування Anki',
			intro: 'Куди «Anki, просто в застосунок» кладе ваші слова. Зберігається в цьому браузері.',
			deck: 'Колода',
			deckHint: 'Назва, якої в Anki ще немає, створить нову колоду. Пишіть :: для колоди всередині іншої: Мови::Українська.',
			noteType: 'Тип нотатки',
			own: 'Nebokrai (створений для цих слів)',
			fields: 'Що йде в кожне поле',
			values: { none: 'Нічого', word: 'Слово', meaning: 'Значення', details: 'Подробиці', both: 'Значення й подробиці' },
			problem: {
				word: 'Слово має бути рівно в одному полі: за ним нотатку знаходять знову.',
				first: 'Anki не приймає нотатку з порожнім першим полем.',
				tags: 'Потрібна хоча б одна мітка.'
			},
			ownNote: 'У вашому власному типі нотатки надісланими звідси вважаються лише нотатки з першою міткою нижче. Картки, які ви написали самі, лишаються як є.',
			tags: 'Мітки',
			tagsHint: 'Через пробіл. Кожна нотатка також отримує мітку з частиною мови (noun, verb…).',
			update: 'Тримати надіслані нотатки актуальними',
			updateHint:
				'Коли ви надсилаєте слово, яке вже є в Anki, а його стаття у словнику відтоді змінилася, нотатка отримує новий текст. Ваш поступ у повторенні зберігається. Вимкніть, якщо редагуєте ці нотатки в Anki: надсилання перезапише ваші правки.',
			offline: 'Anki не відповідає, тож його колоди й типи нотаток не можна показати.',
			loading: 'Питаємо Anki…',
			save: 'Зберегти',
			cancel: 'Скасувати'
		},
		ankiFile: 'Ще один крок, в Anki',
		ankiSent: {
			title: (deck: string) => `Надіслано до «${deck}» в Anki`,
			body: (added: number, updated: number, unchanged: number) =>
				`Додано: ${added} · оновлено: ${updated} · без змін: ${unchanged}.`
		},
		ankiError: {
			unreachable: {
				title: 'Anki не відповідає',
				steps: [
					'Відкрийте Anki на цьому комп’ютері.',
					'Установіть додаток AnkiConnect: «Інструменти» › «Додатки» › «Отримати додатки», код 2055492159. Потім перезапустіть Anki.',
					'Якщо браузер спитає, чи може цей сайт звертатися до застосунків на вашому пристрої, дозвольте.'
				]
			},
			denied: {
				title: 'Anki відхилив з’єднання',
				body: 'Спробуйте ще раз і виберіть «Так», коли Anki спитає, чи може цей сайт під’єднатися.'
			},
			key: {
				title: 'AnkiConnect вимагає ключ API',
				body: 'Ця сторінка не може його надіслати. Текстовий файл працює без нього.'
			},
			setup: {
				title: 'Налаштування Anki більше не підходять',
				body: 'Вибраного типу нотатки немає в Anki, або його поля змінилися. Відкрийте налаштування й виберіть знову.'
			},
			failed: { title: 'Anki не зміг прийняти слова' }
		},
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
	lists: {
		heading: 'Списки',
		all: 'Усі',
		choose: 'Додати до списку',
		none: 'Списків ще немає. Назвіть перший.',
		newName: 'Новий список',
		create: 'Створити',
		name: 'Назва',
		rename: 'Перейменувати',
		save: 'Зберегти',
		cancel: 'Скасувати',
		delete: 'Видалити список',
		deleted: (name: string) => `Список «${name}» видалено`,
		empty: 'У цьому списку ще немає слів. Щоб додати слово, натисніть кнопку списків біля збереженого слова.',
		taken: 'Список із такою назвою вже є.',
		full: (max: number) => `Можна мати до ${max} списків.`,
		whichIn: (name: string) => `Які слова зі списку «${name}»`,
		makeDefault: 'Зробити типовим',
		makeDefaultHint: 'Наступні збережені слова потраплятимуть до вибраних вище списків без цього запиту.',
		defaultIs: (names: string) =>
			names ? `Нові слова зберігаються до: ${names}, без запиту.` : 'Нові слова зберігаються без списку, без запиту.',
		askAgain: 'Питати щоразу'
	},
	settings: {
		open: 'Налаштування',
		appearance: 'Вигляд',
		system: 'Як у системі',
		light: 'Світлий',
		sepia: 'Сепія',
		dark: 'Темний',
		language: 'Мова інтерфейсу',
		layout: 'Розкладка клавіатури',
		standard: 'ЙЦУКЕН',
		phonetic: 'Фонетична',
		layoutHint: 'Фонетична ставить кожну літеру на латинську клавішу з подібним звуком.',
		background: 'Тло',
		backgrounds: { plain: 'Однотонне', field: 'Поле', hills: 'Пагорби' },
		radio: 'Радіо',
		radioHint: 'Кнопка в кутку, що вмикає українські радіостанції.',
		roman: 'Латиницею',
		romanHint: 'Сторінка слова показує його й латинськими літерами: вода́, vodá.',
		ipa: 'Фонетичний запис',
		ipaHint: 'Сторінка слова показує, як воно звучить, знаками Міжнародного фонетичного алфавіту: [wɔˈda].',
		blur: 'Приховувати переклад',
		blurHint: 'Англійський переклад під прикладом речення розмитий, доки ви його не натиснете.'
	},
	radio: {
		open: 'Радіо',
		openPlaying: (station: string) => `Радіо: грає ${station}`,
		play: 'Слухати',
		stop: 'Зупинити',
		loading: 'З’єднуємо…',
		playing: 'В ефірі',
		failed: 'Станція не відповідає. Спробуйте ще раз або виберіть іншу.',
		volume: 'Гучність',
		kinds: { talk: 'Розмовні', music: 'Музичні' },
		site: 'Сайт станції',
		minimise: 'Згорнути',
		move: 'Перетягніть, щоб пересунути радіо',
		hide: 'Сховати радіо',
		hidden: 'Радіо сховано. Повернути його можна в налаштуваннях.'
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
		about: 'Про проєкт',
		sources: 'Джерела й ліцензії',
		privacy: 'Приватність',
		words: 'Усі слова',
		discord: 'Спільнота в Discord'
	},
	learn: {
		kind: { cards: 'Картки', grammar: 'Граматика' },
		action: {
			cardsDue: (n) => `${counted(n, 'картка', 'картки', 'карток')} на повторення`,
			cardsNone: 'Сьогодні карток на повторення немає',
			cardsGo: 'Повторювати',
			rulesDue: (n) => `${counted(n, 'правило', 'правила', 'правил')} на повторення`,
			rulesNone: 'Сьогодні правил на повторення немає',
			notStarted: 'Ще не розпочато',
			rulesGo: 'Тренувати'
		},
		activity: 'Активність',
		inDays: (n) => `${n} за 14 днів`,
		vocabulary: 'Лексика',
		grammar: 'Граматика',
		reference: 'Довідка',
		manageDecks: 'Керувати колодами',
		wordsKnown: (total) => `з ${total} слів засвоєно`,
		learning: (n) => `вивчається: ${n}`,
		due: (n) => `на сьогодні: ${n}`,
		off: 'не ввімкнено',
		cases: 'Відмінки',
		short: {
			where: 'Де',
			'where-to': 'Куди',
			'with-from': 'З ким і звідки',
			numbers: 'Лічба',
			'for-about': 'Для і про',
			'before-after': 'До і після',
			around: 'Поруч',
			'above-below': 'Над і під'
		},
		// "з" takes the genitive: з 1 правила, з 3 правил
		rulesKnown: (n, total) => `засвоєно ${n} з ${total} ${total % 10 === 1 && total % 100 !== 11 ? 'правила' : 'правил'}`,
		practiseThis: 'Тренувати це',
		practise: 'Тренувати',
		column: { after: 'Після', takes: 'Відмінок', means: 'Значення', example: 'Приклад', state: 'Стан' },
		state: { new: 'Не розпочато', weak: 'Потребує практики', learning: 'Вивчається', known: 'Засвоєно' },
		tile: {
			alphabet: 'Абетка (кирилиця)',
			letters: (n, total) => `${n} з ${total} літер`,
			common: 'Найуживаніші слова',
			commonNote: (n) => `${n} слів`,
			grammar: 'Граматичні терміни',
			grammarNote: 'Рід, відмінки, дієслова…'
		},
		first: {
			title: 'Почніть тут',
			lead: 'Три кроки для початку, саме в такому порядку.',
			letters: {
				name: 'Навчіться читати літери',
				text: (n) => `${counted(n, 'літера', 'літери', 'літер')} кирилиці й коротка вправа, щоб навчитися їх читати.`,
				go: 'Вивчити літери',
				skip: 'Я вже вмію їх читати',
				done: 'Ви вмієте читати літери.',
				undo: 'Скасувати'
			},
			words: {
				name: 'Познайомтеся з першими словами',
				text: 'Щодня десять нових карток із 500 найуживаніших слів.',
				go: 'Почати з перших слів'
			},
			grammar: {
				name: 'Спробуйте раунд граматики',
				text: 'Десять справжніх речень, у кожному пропуск.',
				go: 'Почати раунд'
			}
		}
	},
	browse: {
		commonTitle: '1000 найуживаніших українських слів',
		commonLead: 'Слова, які трапляються найчастіше: спершу найуживаніші.',
		commonSource: 'Підраховано за субтитрами до фільмів і серіалів, тому розмовна мова важить більше за книжну.',
		commonPages: 'Частини списку',
		wordsTitle: 'Усі слова',
		wordsLead: 'Кожне слово словника під своєю першою літерою, за абеткою.',
		wordsCommon: 'Або почніть із 1000 найуживаніших слів.',
		wordsAlphabet: 'Ще не знаєте літер? Спершу вивчіть абетку.',
		letterTitle: (letter) => `Слова на літеру ${letter}`,
		otherTitle: 'Інші статті',
		otherLead: 'Статті, що не починаються з української літери.',
		other: 'Інше',
		alphabet: 'Літери',
		pages: 'Сторінки',
		previous: 'Попередня сторінка',
		next: 'Наступна сторінка',
		all: 'Усі літери'
	},
	home: {
		titlePair: 'Українсько-англійський',
		tryLabel: 'Спробуйте',
		wordOfDay: 'Слово дня',
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
		share: 'Поділитися словом',
		details: 'Докладніше',
		genitive: 'р. в.',
		noEntry: 'Українське слово, якого ще немає в словнику.',
		formFound: 'Знайдена форма:',
		moreForms: (n: number) => `ще ${n}`,
		moreMeanings: (n: number) => `ще ${n}`,
		someForm: 'Ваш запит є формою цього слова.'
	},
	word: {
		back: 'До пошуку',
		entries: 'Статті на цій сторінці',
		playRecording: 'Прослухати запис',
		playVoice: 'Прослухати синтезовану вимову',
		meanings: 'Значення',
		examples: 'Приклади речень',
		lookUp: 'Знайти це слово',
		sameSpelling: 'Однакове написання, різний наголос: від нього залежить значення.',
		forms: 'Форми',
		conjugation: 'Дієвідмінювання',
		cover: 'Перевірити себе',
		coverHow: 'Назвіть кожну форму, а тоді натисніть на її місце, щоб перевірити.',
		coverCount: (n, total) => `Відкрито ${n} з ${total}`,
		coverAgain: 'Сховати знову',
		coverShow: 'Показати форму',
		mode: 'Показати форми чи перевірити себе',
		reveal: 'Показати переклад',
		table: 'Таблиця',
		moreMeanings: (n: number) => `Ще ${counted(n, 'значення', 'значення', 'значень')}`,
		stressMoves: 'Підкреслено наголошені літери там, де наголос падає не так, як у слові',
		stressStays: 'У всіх формах наголос падає на той самий склад.',
		synonyms: 'Синоніми',
		antonyms: 'Антоніми',
		family: 'Споріднені слова',
		derived: 'Похідні',
		sameRoot: 'Спільний корінь',
		relatedRows: {
			relatedAdjective: 'Прикметники',
			diminutive: 'Зменшувальні',
			relatedNoun: 'Іменники',
			relatedAdverb: 'Прислівники',
			augmentative: 'Збільшувальні'
		},
		showAll: (n: number) => `показати всі ${n}`,
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
		particle: 'Частка', intj: 'Вигук', phrase: 'Фраза',
		suffix: 'Суфікс', prefix: 'Префікс', interfix: 'Інтерфікс', combining_form: 'Основа складних слів',
		det: 'Займенник', postp: 'Післяйменник', prep_phrase: 'Прийменникове сполучення',
		proverb: 'Прислів’я', character: 'Літера', symbol: 'Символ', punct: 'Розділовий знак'
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
	grammar: {
		more: 'Докладніше в довіднику',
		explained: 'Що означають ці слова',
		short: { perfective: 'док.', imperfective: 'недок.' },
		groups: {
			pos: 'Частини мови',
			gender: 'Рід',
			animacy: 'Істоти й неістоти',
			number: 'Число',
			cases: 'Відмінки',
			verbs: 'Дієслова',
			words: 'Споріднені форми',
			usage: 'Де вживається слово'
		},
		intros: {
			gender: 'Кожен український іменник належить до одного з трьох родів. Від роду залежать закінчення слів, що стоять при іменнику, і займенник, який його заступає.',
			animacy: 'Українська граматика розрізняє назви предметів і назви живих істот. Від цього залежить форма в одному відмінку, знахідному.',
			number: 'Один чи більше ніж один, а також слова, що мають тільки одне з двох чисел.',
			cases: 'Іменник змінює закінчення залежно від ролі в реченні. Таких ролей сім, вони звуться відмінками, і в українській школі кожен вивчають за питанням, на яке він відповідає.',
			verbs: 'Закінчення дієслова показують, хто діє і коли. Більшість дієслів утворює пари: одне для дії в процесі, друге для завершеної дії.',
			words: 'Форми, утворені від слова, які словник подає поруч із ним.',
			usage: 'Позначки при значенні, що кажуть, де або коли його вживають.'
		},
		caseTable: { name: 'Відмінок', question: 'Питання', example: 'Приклад' },
		sections: 'Розділи',
		toSections: 'Усі розділи',
		count: (n: number) => counted(n, 'термін', 'терміни', 'термінів'),
		terms: {
			noun: { name: 'Іменник', text: 'Слово, що називає предмет, людину, місце чи поняття. Має рід і змінює закінчення залежно від ролі в реченні.' },
			verb: { name: 'Дієслово', text: 'Слово, що називає дію або стан. Його закінчення показує, хто діє і коли.' },
			adjective: { name: 'Прикметник', text: 'Слово, що описує іменник. Узгоджується з ним у роді, числі й відмінку.' },
			adverb: { name: 'Прислівник', text: 'Слово, що описує дію чи ознаку: як, коли, де. Не змінює форми.' },
			pronoun: { name: 'Займенник', text: 'Слово, що вживається замість іменника.' },
			numeral: { name: 'Числівник', text: 'Слово, що називає число. Числівники відмінюються, а іменник після них теж змінює форму.' },
			preposition: { name: 'Прийменник', text: 'Коротке слово перед іменником: у, на, з, для. Кожен прийменник вимагає певного відмінка.' },
			conjunction: { name: 'Сполучник', text: 'Слово, що поєднує слова або речення.' },
			particle: { name: 'Частка', text: 'Коротке слово, що додає відтінок значення: питання, заперечення, підсилення. Не змінює форми.' },
			interjection: { name: 'Вигук', text: 'Слово, яке вимовляють окремо: вітання, реакція, оклик.' },
			determiner: { name: 'Детермінатив', text: 'Слово перед іменником, що вказує, який саме або скільки: цей, такий, кілька. Шкільна граматика відносить більшість із них до займенників або числівників.' },
			masculine: { name: 'Чоловічий рід', text: 'Один із трьох родів. Про такий іменник кажуть «він», а прикметник при ньому закінчується на -ий або -ій. Більшість іменників чоловічого роду закінчується на приголосний.' },
			feminine: { name: 'Жіночий рід', text: 'Один із трьох родів. Про такий іменник кажуть «вона», а прикметник при ньому закінчується на -а або -я. Більшість іменників жіночого роду закінчується на -а або -я.' },
			neuter: { name: 'Середній рід', text: 'Один із трьох родів. Про такий іменник кажуть «воно», а прикметник при ньому закінчується на -е або -є. Більшість іменників середнього роду закінчується на -о, -е або -я.' },
			inanimate: { name: 'Неістота', text: 'Предмет, а не людина чи тварина. Це важить у знахідному відмінку, тобто після «бачу»: іменник чоловічого роду і будь-який іменник у множині має там форму називного відмінка, якщо це неістота, і родового, якщо істота.' },
			animate: { name: 'Істота', text: 'Жива істота: людина чи тварина. У знахідному відмінку, тобто після «бачу», назва істоти чоловічого роду і будь-яка назва істоти в множині має форму родового відмінка.' },
			person: { name: 'Особа', text: 'Назва людини. Граматично це істота: після «бачу» назва людини чоловічого роду і будь-яка назва людини в множині має форму родового відмінка.' },
			animal: { name: 'Тварина', text: 'Назва тварини. Граматично це істота, як і людина. У множині після «бачу» вона теж зазвичай має форму родового відмінка, хоча деякі назви тварин можуть мати й форму називного.' },
			'common-gender': { name: 'Спільний рід', text: 'Назва людини, що буває чоловічого або жіночого роду залежно від того, про кого мова.' },
			singular: { name: 'Однина', text: 'Один предмет чи одна особа.' },
			plural: { name: 'Множина', text: 'Більше ніж один. Якщо «множина» стоїть у рядку самого іменника, слово вживається тільки в множині, як-от двері чи гроші.' },
			'plural-only': { name: 'Лише множина', text: 'Слово або це його значення вживається тільки в множині, навіть коли предмет один.' },
			countable: { name: 'Злічуване', text: 'Те, що можна порахувати, тож слово має множину.' },
			uncountable: { name: 'Незлічуване', text: 'Те, чого не рахують, тож слово зазвичай уживається тільки в однині.' },
			collective: { name: 'Збірне', text: 'Слово в однині, що називає сукупність як одне ціле.' },
			indeclinable: { name: 'Невідмінюване', text: 'Слово має одну форму для всіх відмінків і чисел. Здебільшого це запозичення.' },
			declension: { name: 'Відмінювання', text: 'Зміна закінчень іменника, прикметника чи займенника за сімома відмінками в однині й множині.' },
			nominative: { name: 'Називний відмінок', text: 'Словникова форма. Називає того, хто діє, або те, про що мова.' },
			genitive: { name: 'Родовий відмінок', text: 'Належність, відсутність, кількість. Стоїть після «немає», після багатьох прийменників і слів, що означають кількість. Словники подають цю форму, бо з неї видно, як слово відмінюється.' },
			dative: { name: 'Давальний відмінок', text: 'Той, кому щось дають або для кого щось роблять. У давальному відмінку також стоїть той, чий вік називають, і той, кому щось подобається.' },
			accusative: { name: 'Знахідний відмінок', text: 'Прямий додаток: предмет чи особа, на яких спрямована дія.' },
			instrumental: { name: 'Орудний відмінок', text: 'Без прийменника називає знаряддя або спосіб дії: чим. Після прийменника «з» називає того, з ким діють.' },
			locative: { name: 'Місцевий відмінок', text: 'Місце. Вживається тільки з прийменником, найчастіше з «в», «у» або «на».' },
			vocative: { name: 'Кличний відмінок', text: 'Форма звертання до когось.' },
			conjugation: { name: 'Дієвідмінювання', text: 'Зміна закінчень дієслова за особами, числами й часами.' },
			imperfective: { name: 'Недоконаний вид', text: 'Дія як процес, повторювана чи звична, без вказівки на те, що її завершено. Більшість дієслів утворює пару: одне недоконаного виду, друге доконаного.' },
			perfective: { name: 'Доконаний вид', text: 'Дія як завершене ціле: зроблена один раз і до кінця. Дієслово доконаного виду не має теперішнього часу: його форми, схожі на теперішній час, означають майбутнє.' },
			infinitive: { name: 'Інфінітив', text: 'Словникова форма дієслова. Закінчується на -ти.' },
			'first-person': { name: '1-ша особа', text: 'Той, хто говорить: я і ми.' },
			'second-person': { name: '2-га особа', text: 'Той, до кого говорять: ти (одна близька людина) і ви (кілька людей або ввічливо до однієї).' },
			'third-person': { name: '3-тя особа', text: 'Хтось або щось інше: він, вона, воно і вони.' },
			imperative: { name: 'Наказовий спосіб', text: 'Форма, якою просять або наказують щось зробити.' },
			transitive: { name: 'Перехідне', text: 'Дієслово має прямий додаток у знахідному відмінку: читати щось.' },
			intransitive: { name: 'Неперехідне', text: 'Дієслово не має прямого додатка: дія не переходить на предмет.' },
			impersonal: { name: 'Безособове', text: 'Вживається без того, хто діє. Так працюють і форми на -но та -то: вони кажуть, що щось зроблено, але не кажуть ким.' },
			participle: { name: 'Дієприкметник', text: 'Форма дієслова, що працює як прикметник.' },
			'adverbial-participle': { name: 'Дієприслівник', text: 'Форма дієслова, що називає другу дію тієї самої особи: «роблячи» (теперішній час) або «зробивши» (минулий час). Не змінює форми.' },
			comparative: { name: 'Вищий ступінь', text: 'Форма прикметника чи прислівника зі значенням «більш».' },
			superlative: { name: 'Найвищий ступінь', text: 'Форма зі значенням «най». Утворюється додаванням най- до вищого ступеня.' },
			relational: { name: 'Відносний прикметник', text: 'Прикметник, що називає ознаку через стосунок до чогось; найчастіше утворений від іменника. Не має ступенів порівняння.' },
			predicative: { name: 'Присудкове слово', text: 'Вживається як головний член речення без дієслова, зазвичай про стан або потребу.' },
			diminutive: { name: 'Зменшувальна форма', text: 'Форма, що надає слову значення малого або пестливого. В українській мові такі форми дуже поширені.' },
			augmentative: { name: 'Збільшувальна форма', text: 'Форма, що надає слову значення великого, сильного або грубого.' },
			derived: { name: 'Похідне слово', text: 'Слово, утворене від цього за допомогою префікса, суфікса чи іншого слова, часто з власним значенням.' },
			'same-root': { name: 'Спільнокореневе слово', text: 'Слово з тим самим коренем, носієм значення, хоч жодне з двох не утворене від іншого.' },
			colloquial: { name: 'Розмовне', text: 'Уживається в повсякденному мовленні, а не в офіційних текстах.' },
			dialectal: { name: 'Діалектне', text: 'Уживається в окремих регіонах, а не всюди в літературній мові.' },
			dated: { name: 'Застаріле', text: 'Колись було звичним і ще часом трапляється, але звучить старомодно.' },
			archaic: { name: 'Архаїчне', text: 'Вийшло із загального вжитку, але ще зрозуміле; трапляється в давніх текстах і в текстах, стилізованих під давнину.' },
			figurative: { name: 'Переносне значення', text: 'Не пряме значення: слово вжито як образ.' },
			slang: { name: 'Сленг', text: 'Дуже неформальні слова, що їх уживають у певному колі людей: за фахом, віком чи захопленням.' }
		},
		headForms: {
			genitive: 'родовий відмінок', plural: 'множина', genitivePlural: 'родовий множини',
			relatedAdjective: 'прикметник', relatedAdverb: 'прислівник', relatedNoun: 'іменник',
			perfectivePartner: 'пара доконаного виду', imperfectivePartner: 'пара недоконаного виду',
			feminineForm: 'жіноча форма', masculineForm: 'чоловіча форма', also: 'також',
			diminutive: 'зменшувальна форма', augmentative: 'збільшувальна форма', comparative: 'вищий ступінь',
			superlative: 'найвищий ступінь', uppercase: 'велика літера', lowercase: 'мала літера'
		},
		otherForms: {
			infinitive: 'інфінітив', presentAdverbial: 'дієприслівник теперішнього часу',
			pastAdverbial: 'дієприслівник минулого часу', impersonalPast: 'безособова форма на -но, -то',
			presentActive: 'активний дієприкметник теперішнього часу',
			pastActive: 'активний дієприкметник минулого часу',
			presentPassive: 'пасивний дієприкметник теперішнього часу',
			pastPassive: 'пасивний дієприкметник минулого часу'
		},
		// The commonest tags that are no term of their own. The rest of
		// Wiktionary's 200-odd tags stay in English, as the meanings do.
		tags: {
			rare: 'рідкісне', uncommon: 'рідковживане', obsolete: 'вийшло з ужитку', historical: 'історичне',
			literary: 'книжне', poetic: 'поетичне', informal: 'неформальне', vulgar: 'вульгарне',
			derogatory: 'зневажливе', offensive: 'образливе', humorous: 'жартівливе', ironic: 'іронічне',
			neologism: 'неологізм', abbreviation: 'скорочення', literally: 'буквально', idiomatic: 'ідіома',
			usually: 'зазвичай', often: 'часто', broadly: 'у ширшому значенні', reflexive: 'зворотне',
			present: 'теперішній час', past: 'минулий час', future: 'майбутній час',
			active: 'активний стан', passive: 'пасивний стан'
		}
	},
	review: {
		open: 'Картки',
		help: {
			open: 'Як працюють картки',
			close: 'Закрити',
			title: 'Як працюють картки',
			intro: 'На кожній картці українське слово. Спробуйте згадати, що воно означає, потім покажіть відповідь і скажіть, чи знали ви його.',
			sections: [
				{
					heading: '«Ще раз» і «Добре»',
					body: [
						'«Добре», якщо ви згадали значення, хай і не одразу. «Ще раз», якщо не згадали або помилилися.',
						'«Добре» щоразу відкладає картку на довше. «Ще раз» повертає її за десять хвилин, а наступні проміжки стають коротшими.'
					]
				},
				{
					heading: 'Коли картка повертається',
					body: [
						'Сайт використовує FSRS (Free Spaced Repetition Scheduler), той самий метод, що пропонує Anki. Для кожного слова він зберігає два числа: як довго ви, найімовірніше, його пам’ятатимете і наскільки воно для вас складне. Кожна відповідь змінює обидва.',
						'Картка з’являється знову того дня, коли ймовірність, що ви її згадаєте, має знизитися до 90%. Добре відоме слово може чекати тижні чи місяці, складне повертається раніше.',
						'Нове слово спершу показується двічі за кілька хвилин, через одну, а потім через десять хвилин, і лише після того проміжки рахуються днями.'
					]
				},
				{
					heading: 'День повторень',
					body: [
						'День починається о четвертій ранку, тож повторення одразу після півночі зараховується до попереднього вечора.',
						'«Нових карток на день» обмежує лише слова, яких ви ще не бачили. Усі картки, яким настав час, показуються, скільки б їх не було.'
					]
				},
				{
					heading: 'Колоди',
					body: [
						'«Збережені слова» охоплюють усі збережені слова разом зі списками. Список можна ввімкнути й окремо. Колоди найуживаніших слів містять найчастотніші українські слова за порядком частоти.'
					]
				},
				{
					heading: 'Серія',
					body: [
						'Вогник показує, скільки днів поспіль ви повторили хоча б одну картку. Він горить, коли ви вже повторювали сьогодні; день без повторень обриває серію лише тоді, коли закінчиться.'
					]
				},
				{
					heading: 'Де зберігаються ваші повторення',
					body: [
						'У цьому браузері. Якщо ви ввійшли, вони зберігаються й у вашому обліковому записі та однакові на всіх пристроях.',
						'Розклад використовує стандартні налаштування FSRS, а не підібрані під ваші власні відповіді.'
					]
				}
			],
			more: 'Докладніше про FSRS:',
			moreLink: 'алгоритм від проєкту Open Spaced Repetition (англійською)'
		},
		planned: { note: '(заплановано)', deck: 'Імпортувати колоду', list: 'Імпортувати до списку' },
		openDue: (n) => `Картки: ${counted(n, 'слово', 'слова', 'слів')} на повторення`,
		streakDays: (n) => `Серія: ${counted(n, 'день', 'дні', 'днів')}`,
		streakWaits: 'Повторіть сьогодні хоч одну картку, щоб її зберегти',
		practise: 'Тренувати ці слова',
		practiseCommon: 'Тренувати ці слова на картках',
		lead: 'Картки зі збережених і найуживаніших слів. Кожна картка повертається незадовго до того, як ви забули б слово.',
		learning: 'Вивчаються',
		due: 'Повторити',
		fresh: 'Нові',
		start: 'Почати',
		nothingToday: 'На сьогодні повторювати більше нічого.',
		noWords: 'Щоб почати, збережіть кілька слів або ввімкніть колоду найуживаніших слів.',
		decks: 'Колоди',
		deck: {
			saved: 'Збережені слова',
			'common-500': 'Найуживаніші слова 1–500',
			'common-1000': 'Найуживаніші слова 501–1000',
			'common-2000': 'Найуживаніші слова 1001–2000'
		},
		progress: (started, total) => `розпочато ${started} з ${total}`,
		inSaved: 'Входить до збережених слів',
		onlyList: (name) => `Лише колода «${name}».`,
		allDecks: 'Тренувати всі колоди',
		newPerDay: 'Нових карток на день',
		kept: 'Ваші повторення зберігаються в цьому браузері. Увійдіть на сторінці «Збережене», щоб мати їх на кожному пристрої.',
		keptAccount: 'Ваші повторення зберігаються у вашому обліковому записі.',
		show: 'Показати відповідь',
		again: 'Ще раз',
		good: 'Добре',
		keys: {
			action: {
				show: 'Показати відповідь, далі «Добре»',
				again: 'Ще раз',
				good: 'Добре',
				replay: 'Відтворити запис',
				undo: 'Скасувати'
			},
			hint: 'Клацніть клавішу, щоб змінити її.',
			press: 'Натисніть нову клавішу або Esc, щоб залишити стару.',
			reset: 'Повернути звичні клавіші',
			change: (action, key) => `${action}: ${key}. Змінити клавішу`
		},
		swipe: 'Торкніться картки, щоб побачити відповідь, потім змахніть її ліворуч («Ще раз») або праворуч («Добре»).',
		heatmap: {
			streak: 'Поточна серія',
			longest: 'Найдовша серія',
			average: 'У середньому за день',
			learned: 'Днів із заняттями',
			days: (n) => counted(n, 'день', 'дні', 'днів'),
			cards: (n) => (Number.isInteger(n) ? counted(n, 'картка', 'картки', 'карток') : `${n} картки`),
			reviewed: (n, when) => `${counted(n, 'повторення', 'повторення', 'повторень')}: ${when}`,
			none: (when) => `Без повторень: ${when}`,
			due: (n, when) => `${counted(n, 'картка', 'картки', 'карток')} на повторення: ${when}`,
			noneDue: (when) => `Нічого на повторення: ${when}`,
			less: 'Менше',
			more: 'Більше',
			dueLegend: 'Заплановано',
			label: (total, days) =>
				`Повторення за днями за останні вісім місяців і картки на наступні два: повторень ${total}, днів ${days}.`
		},
		undo: 'Скасувати',
		undone: 'Відповідь скасовано',
		openWord: 'Відкрити у словнику',
		left: (n) => `залишилося ${n}`,
		end: 'Зупинити',
		loading: 'Завантаження карток…',
		loadFailed: 'Не вдалося завантажити картки. Перевірте з’єднання і спробуйте ще раз.',
		retry: 'Спробувати ще раз',
		done: 'На зараз усе',
		reviewed: (n) => `Повторено ${counted(n, 'картку', 'картки', 'карток')}.`,
		next: (when) => `Наступна картка через ${when}.`,
		backToDecks: 'Назад до колод',
		span: {
			min: (n) => `${n} хв`,
			h: (n) => `${n} год`,
			d: (n) => `${n} дн`,
			mo: (n) => `${n} міс`,
			y: (n) => `${n} р`
		}
	},
	alphabet: {
		lead: 'Навчіться читати українську кирилицю. Оберіть групи для вправ.',
		chosen: (n) => `Обрано ${counted(n, 'літеру', 'літери', 'літер')}`,
		known: (n, total) => `Вивчено ${n} з ${total}`,
		start: 'Почати',
		kept: 'Ваш поступ зберігається в цьому браузері.',
		recordings: 'Літери читає',
		commons: 'на Вікісховищі',
		recordingsCut: 'Кожен запис обрізано до самої літери й очищено від шуму.',
		mute: 'Вимкнути звук записів',
		forget: 'Почати спочатку',
		forgetConfirm: 'Забути все, що ви вже вправляли? Кожна літера знову стане новою.',
		letters: 'Літери',
		group: {
			same: { name: 'Давні знайомі', note: 'На вигляд і на слух майже такі самі, як латинські.' },
			'false-friends': {
				name: 'Оманливі друзі',
				note: 'Схожі на латинські літери, а звучать інакше.'
			},
			'new-shapes': { name: 'Нові обриси', note: 'Нові для ока, знайомі для вуха.' },
			hushing: { name: 'Шиплячі та Ц', note: 'Одна літера там, де латинкою треба дві або більше.' },
			iotated: { name: 'Голосні з й', note: 'Звук й і голосний в одній літері, а ще сам звук й.' },
			signs: { name: 'Знаки', note: 'Власного звука не мають: змінюють вимову сусідніх літер.' }
		},
		state: { new: 'ще не вправляли', learning: 'вивчається', known: 'вивчено' },
		sign: { ь: 'м’який знак', "'": 'апостроф' },
		details: {
			latin: 'Латинкою',
			name: 'Назва',
			sound: 'Звук',
			example: 'Як у слові',
			words: (letter) => `Слова на літеру ${letter}`,
			listen: 'Послухати літеру',
			close: 'Закрити'
		},
		options: 'Як вправляти',
		answerLabel: 'Відповідати',
		answer: { choice: 'Вибором', type: 'Набором' },
		directionLabel: 'Вам показують',
		direction: { read: 'Кирилицю', write: 'Латинку' },
		contentLabel: 'Вправляти',
		content: { letters: 'Літери', words: 'Слова', both: 'І те, і те' },
		sound: 'Відтворювати запис після відповіді',
		wordsTooFew: (n) =>
			`${n ? `Із самих цих літер можна прочитати лише ${counted(n, 'поширене слово', 'поширені слова', 'поширених слів')}` : 'Із самих цих літер не прочитати жодного поширеного слова'}, тож питатимуть літери. Додайте групу, щоб вправляти слова.`,
		count: (n, total) => `${n} з ${total}`,
		right: 'Правильно',
		wrong: 'Хибно',
		streak: 'Поспіль',
		stop: 'Зупинити',
		ask: {
			letterChoice: 'Якими латинськими літерами її передають?',
			letterType: 'Наберіть її латинкою',
			signChoice: 'Що це за знак?',
			wordChoice: 'Як читається це слово?',
			wordType: 'Наберіть слово латинкою',
			writeChoice: 'Яка це літера?',
			writeType: 'Наберіть українську літеру'
		},
		yourAnswer: 'Ваша відповідь',
		check: 'Перевірити',
		next: 'Далі',
		correct: 'Правильно',
		incorrect: 'Не зовсім',
		answerIs: 'Правильна відповідь:',
		keys: 'Клавіші 1–4 обирають відповідь; Enter веде далі.',
		done: 'Раунд завершено',
		score: (right, total) => `Правильно: ${right} з ${total}.`,
		best: (n) => `Найдовша серія: ${n} поспіль.`,
		missed: 'Варто глянути ще раз',
		allRight: 'Жодної помилки.',
		again: 'Ще раунд',
		back: 'Назад до літер'
	},
	practice: {
		lead: 'Заповнюйте пропуски в реченнях. У раунді десять речень на різні правила, які ви вивчаєте: прийменники з відмінком, якого вимагає кожен із них, у справжніх реченнях, і числівники з формою того, що вони рахують.',
		none: 'Речень для вправ поки що немає.',
		answerLabel: 'Як відповідати',
		answer: { choice: 'Обирати', type: 'Писати' },
		start: 'Почати раунд',
		met: (n, total) => `Знайомі правила: ${n} з ${total}`,
		kept: 'Ваш поступ зберігається разом із картками: у цьому браузері, а після входу — і в обліковому записі.',
		rules: 'Правила',
		map: 'Позначка показує, наскільки добре ви тримаєте правило. Оберіть правило, щоб вправляти лише його.',
		weak: 'Слабкі місця',
		weakTitle: 'Раунд із правил, які ви тримаєте найгірше',
		lessons: {
			where: 'Де щось є',
			'where-to': 'Куди щось рухається',
			'with-from': 'З ким і звідки',
			numbers: 'Числівники з іменниками',
			'for-about': 'Для, без і про',
			'before-after': 'Перед, після й через',
			around: 'Біля, за й між',
			'above-below': 'Над, під і проти'
		},
		lessonN: (n) => `Урок ${n}`,
		knownOf: (n, total) => `Засвоєно: ${n} з ${total}`,
		search: 'Шукати серед правил',
		hideKnown: 'Сховати засвоєні',
		noMatch: 'Жодне правило не підходить.',
		allKnown: 'Усі правила засвоєно й сховано.',
		ofNumber: { singular: 'однини', plural: 'множини' },
		only: 'Вправляти лише це правило',
		state: { new: 'нове', weak: 'непевне', learning: 'вивчається', known: 'засвоєне' },
		meaning: {
			'u-loc': 'місце: де?',
			'na-loc': 'місце: де?',
			'u-acc': 'напрямок: куди?; день тижня',
			'na-acc': 'напрямок: куди?; час або мета',
			'z-ins': 'разом із кимось або чимось',
			'do-gen': 'напрямок або межа: куди? до якого часу?',
			'z-gen': 'звідки?; з якого матеріалу чи з якої групи',
			'dlia-gen': 'призначення: для кого? для чого?',
			'bez-gen': 'відсутність когось або чогось',
			'pro-acc': 'тема: про кого? про що?',
			'vid-gen': 'джерело, початок або причина',
			'za-acc': 'в обмін на щось, на користь когось; порівняння',
			'za-ins': 'позаду, по той бік; по що йдуть',
			'pislia-gen': 'пізніше за щось',
			'pered-ins': 'попереду; раніше за щось',
			'bilia-gen': 'поруч із чимось',
			'cherez-acc': 'упоперек, крізь; причина; за якийсь час',
			'po-loc': 'рух поверхнею або в межах чогось',
			'pid-ins': 'місце внизу: де?',
			'pid-acc': 'напрямок униз: куди?',
			'nad-ins': 'вище за щось',
			'mizh-ins': 'посередині між кимось або чимось',
			'proty-gen': 'усупереч комусь або чомусь',
			'sered-gen': 'у колі когось, усередині чогось',
			'one-nom': 'один і числа, що закінчуються на один: однина, як у словнику',
			'few-nom': 'два, три, чотири й числа, що закінчуються на них: множина',
			'many-gen': 'п’ять і більше, а також 11–14: множина в родовому відмінку'
		},
		count: (n, total) => `${n} з ${total}`,
		stop: 'Зупинити',
		ask: { choice: 'Яка форма пасує до пропуску?', type: 'Наберіть слово у формі, що пасує до пропуску' },
		plural: 'множина',
		hint: 'Показати відмінок',
		nudge: 'Слово правильне, а форма не та. Спробуйте ще раз.',
		yourAnswer: 'Ваша відповідь',
		check: 'Перевірити',
		next: 'Далі',
		correct: 'Правильно',
		helped: 'Правильно, з підказкою',
		incorrect: 'Не зовсім',
		keys: 'Клавіші 1–4 обирають відповідь; Enter веде далі.',
		loading: 'Шукаємо речення…',
		failed: 'Не вдалося завантажити речення.',
		retry: 'Спробувати ще раз',
		done: 'Раунд завершено',
		score: (right, total) => `Правильно: ${right} з ${total}.`,
		missed: 'Варто глянути ще раз',
		allRight: 'Жодної помилки.',
		again: 'Ще раунд',
		back: 'Назад до правил'
	},
	pageTitle: {
		resources: 'Ресурси', saved: 'Збережені слова', about: 'Про проєкт', grammar: 'Різні граматичні терміни з поясненнями',
		review: 'Картки', alphabet: 'Українська абетка', practice: 'Вправи з граматики', learn: 'Вчимо українську',
		privacy: 'Приватність'
	},
	meta: {
		homeTitle: 'Nebokrai: українсько-англійський словник з наголосами та відмінюванням',
		home: 'Безкоштовний українсько-англійський словник для тих, хто вивчає мову. Пошук українською, латинкою чи англійською; наголоси, таблиці відмінювання, аудіо та приклади.',
		about: 'Що таке Nebokrai, що тут можна робити, звідки взято слова й хто його створює.',
		learn: 'Почніть вивчати українську: абетка з вправами на всі 33 літери, 1000 найуживаніших слів, граматичні терміни з поясненнями та вправи з граматики.',
		privacy: 'Що Nebokrai зберігає, а що ні: без реклами й відстеження, файли cookie лише для входу й налаштувань, і що зберігають обліковий запис та повідомлення.',
		grammar: 'Українські граматичні терміни простими словами: рід, сім відмінків і питання до кожного, вид дієслова, і що вони змінюють у реченні.',
		resources: 'Курси, подкасти, словники й інструменти для вивчення української, дібрані вручну, з рівнем і вартістю кожного.',
		support: 'Куди задонатити для України: United24 та інші фонди для оборони, медицини, допомоги, дітей, освіти, тварин, відбудови, культури й ветеранів.',
		commonWords: '1000 найуживаніших українських слів за частотою, кожне з наголосом, частиною мови та значенням англійською.',
		words: 'Увесь українсько-англійський словник за літерами: кожне слово за абеткою, з наголосом, формами та значеннями.',
		letter: (letter, first, last) =>
			`Українські слова на літеру ${letter}, від «${first}» до «${last}», кожне зі значенням англійською, наголосом і формами.`,
		other: 'Статті словника, що не починаються з української літери: знаки та слова, записані іншими абетками.',
		saved: 'Слова, які ви зберегли: у цьому браузері або у вашому обліковому записі.',
		review: 'Картки для збережених і найуживаніших українських слів: кожне слово повертається незадовго до того, як ви його забули б.',
		alphabet: 'Навчіться читати українську абетку: усі 33 літери зі звуками й латинським записом та вправи на літерах і справжніх словах, які пам’ятають ваші помилки.',
		practice: 'Вправляйте українську граматику на справжніх реченнях: заповніть пропуск після прийменника потрібним відмінком. Десять речень у раунді, а кожне правило повертається, перш ніж забудеться.',
		report: 'Повідомте про помилку в словнику або про проблему на сайті.',
		picture: 'Nebokrai, українсько-англійський словник. Стаття «небокрай» (horizon) з наголосом і прикладом речення.',
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
	resources: {
		intro: 'Інші добрі місця, де можна вчити українську:',
		priceLabel: 'Ціна',
		prices: { any: 'Будь-яка', free: 'Безкоштовні', paid: 'Платні' },
		orderLabel: 'Порядок',
		orders: { easiest: 'Спершу легші', hardest: 'Спершу складніші' },
		kinds: {
			course: 'Курси', podcast: 'Подкасти', reading: 'Читання', dictionary: 'Словники',
			tool: 'Інструменти', tutor: 'Репетитори', community: 'Спільноти', book: 'Книжки'
		},
		kind: {
			course: 'Курс', podcast: 'Подкаст або відео', reading: 'Читання й слухання',
			dictionary: 'Словник або довідник', tool: 'Інструмент', tutor: 'Репетитори', community: 'Спільнота', book: 'Книжка'
		},
		cost: { free: 'Безкоштовно', freemium: 'Безкоштовно + платне', paid: 'Платно' },
		pill: { free: 'Безкоштовно', paid: 'Платно', plusPaid: '+ платне' },
		ukOnly: 'УКР',
		ukOnlyHint: 'Лише українською',
		levels: {
			beginner: 'Початковий рівень',
			intermediate: 'Середній рівень',
			advanced: 'Високий рівень',
			'beginner-intermediate': 'Початковий і середній рівні',
			'intermediate-advanced': 'Середній рівень і вище',
			'beginner-intermediate-advanced': 'Будь-який рівень'
		},
		count: (shown: number, total: number) =>
			shown === total ? counted(total, 'ресурс', 'ресурси', 'ресурсів') : `${shown} з ${total}`,
		reviewed: (date: string) => `Востаннє перевірено ${date}`,
		howTitle: 'Як ми добираємо',
		how: 'Кожне посилання тут ми самі відкрили й переглянули. Усе в списку корисне й без оплати або чітко позначене як платне. Тут немає російських ресурсів, і ніхто не платить за місце в списку: жодної реклами й жодних партнерських посилань.',
		suggestLead: 'Знаєте добрий ресурс, якого тут бракує?',
		suggest: 'Запропонуйте його'
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
			resource: 'Запропонувати ресурс для навчання',
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
			resource: 'Посилання і кому цей ресурс стане в пригоді',
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
		check: 'Перевірка, що ви не бот, ще не завершилася. Зачекайте, доки у віконці вище з’явиться позначка, або поставте її, і надішліть ще раз.',
		checkNote: 'Cloudflare Turnstile перевіряє, що це надсилає людина, а не бот.',
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

/** A grammar tag as a reader sees it: "animal-not-person" is "animal", or «тварина». */
export function tagLabel(m: Messages, lang: Lang, tag: string): string {
	const term = termOf(tag);
	if (term) return m.grammar.terms[term].name.toLocaleLowerCase(lang);
	return m.grammar.tags[tag] ?? tag.replace(/-/g, ' ');
}

/** A form's name with what it does not cover after it in brackets: "also (dialectal)". */
export function formName(m: Messages, lang: Lang, name: string | null, extra: string[]): string {
	const rest = extra.map((tag) => tagLabel(m, lang, tag)).join(', ');
	if (!name) return rest;
	return rest ? `${name} (${rest})` : name;
}
