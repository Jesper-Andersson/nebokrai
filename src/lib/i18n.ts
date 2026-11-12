// Interface text in English and Ukrainian. The meanings stay in English: they
// come from English Wiktionary. Its grammar tags ("feminine", "genitive") are
// named and explained here in both languages (`grammar`); a tag with no name
// here is shown as it is stored.
import { termOf, type Group, type HeadFormKey, type OtherFormKey, type TermId } from './grammar.ts';
import type { Cost, Kind, LevelSpan } from './resources.ts';
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
	nav: { label: 'Main', dictionary: 'Dictionary', resources: 'Resources', saved: 'Saved', about: 'About' },
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
		layoutHint: 'Phonetic puts each letter on the Latin key that sounds alike.',
		background: 'Background',
		backgrounds: { plain: 'Plain', field: 'Field', hills: 'Hills' },
		radio: 'Radio',
		radioHint: 'A button in the corner of the page that plays Ukrainian radio stations.'
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
		grammar: 'Grammar words',
		sources: 'Sources and licences',
		source: 'Source code',
		common: 'Common words',
		words: 'All words'
	},
	/** The pages for browsing: /common-words and /words (browse.ts). */
	browse: {
		commonTitle: 'The 1,000 most common Ukrainian words',
		commonLead: 'The words you will meet most often, commonest first, each with its stress and first meaning. Follow a word for all its meanings and forms.',
		commonSource: 'Counted in film and television subtitles, so everyday speech weighs more than books.',
		commonPages: 'Parts of the list',
		wordsTitle: 'All words',
		wordsLead: 'Every word in the dictionary under its first letter, in alphabetical order.',
		wordsCommon: 'Or start with the 1,000 most common words.',
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
		/** Under the tables; the headword follows, then a full stop. */
		stressMoves: 'Underlined: the stress falls on a different syllable than in',
		stressStays: 'The stress stays on the same syllable in every form.',
		synonyms: 'Synonyms',
		antonyms: 'Antonyms',
		/** The section of derived words and words of the same root */
		family: 'Related words',
		derived: 'Derived',
		sameRoot: 'Same root',
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
		intros: {
			pos: 'Every entry begins with the kind of word it is.',
			gender: 'Every Ukrainian noun has one of three genders. The gender decides the endings of the words that go with the noun, and the pronoun that stands for it.',
			animacy: 'Ukrainian grammar treats a thing differently from a living being. It decides the form in one case, the accusative.',
			number: 'One or more than one, and the words that have only one of the two.',
			cases: 'A noun changes its ending with its role in the sentence. There are seven roles, called cases, and Ukrainian schools teach each by the question it answers.',
			verbs: 'A verb’s endings show who acts and when. Most verbs come in pairs, one for the action in progress and one for the action completed.',
			words: 'Forms made from a word that a dictionary lists beside it.',
			usage: 'Remarks on a meaning that say where or when it is used.'
		} as Record<Group, string>,
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
	pageTitle: { resources: 'Resources', saved: 'Saved words', about: 'About', grammar: 'Grammar words, explained' },
	/**
	 * What search results and link previews show for each page: its title and
	 * a description of about 150 characters (PageMeta.svelte, seo.ts). Search
	 * engines send no cookies, so they read the English ones.
	 */
	meta: {
		homeTitle: 'Nebokrai: Ukrainian–English dictionary with stress and declension',
		home: 'A free Ukrainian–English dictionary for learners. Search in Ukrainian, Latin letters or English and see the stress, full inflection tables, audio and examples.',
		about: 'What Nebokrai is, what you can do with it, where its words come from and who makes it.',
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
		intro: 'Other good places to learn Ukrainian: courses, podcasts, dictionaries and tools.',
		filterLabel: 'Narrow the list',
		filterPlaceholder: 'Type to narrow the list…',
		kindLegend: 'Kind of resource',
		all: 'All',
		/** On the chips that choose a kind */
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
		none: 'Nothing here matches.',
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
		layoutHint: 'Фонетична ставить кожну літеру на латинську клавішу з подібним звуком.',
		background: 'Тло',
		backgrounds: { plain: 'Однотонне', field: 'Поле', hills: 'Пагорби' },
		radio: 'Радіо',
		radioHint: 'Кнопка в кутку сторінки, що вмикає українські радіостанції.'
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
		grammar: 'Граматичні терміни',
		sources: 'Джерела й ліцензії',
		source: 'Вихідний код',
		common: 'Найуживаніші слова',
		words: 'Усі слова'
	},
	browse: {
		commonTitle: '1000 найуживаніших українських слів',
		commonLead: 'Слова, які трапляються найчастіше, від найуживанішого, з наголосом і першим значенням. Перейдіть до слова, щоб побачити всі його значення та форми.',
		commonSource: 'Підраховано за субтитрами до фільмів і серіалів, тому розмовна мова важить більше за книжну.',
		commonPages: 'Частини списку',
		wordsTitle: 'Усі слова',
		wordsLead: 'Кожне слово словника під своєю першою літерою, за абеткою.',
		wordsCommon: 'Або почніть із 1000 найуживаніших слів.',
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
		stressMoves: 'Підкреслено: наголос падає на інший склад, ніж у слові',
		stressStays: 'У всіх формах наголос падає на той самий склад.',
		synonyms: 'Синоніми',
		antonyms: 'Антоніми',
		family: 'Споріднені слова',
		derived: 'Похідні',
		sameRoot: 'Спільний корінь',
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
			pos: 'Кожна стаття починається з частини мови.',
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
	pageTitle: { resources: 'Ресурси', saved: 'Збережені слова', about: 'Про проєкт', grammar: 'Граматичні терміни' },
	meta: {
		homeTitle: 'Nebokrai: українсько-англійський словник з наголосами та відмінюванням',
		home: 'Безкоштовний українсько-англійський словник для тих, хто вивчає мову. Пошук українською, латинкою чи англійською; наголоси, таблиці відмінювання, аудіо та приклади.',
		about: 'Що таке Nebokrai, що тут можна робити, звідки взято слова й хто його створює.',
		grammar: 'Українські граматичні терміни простими словами: рід, сім відмінків і питання до кожного, вид дієслова, і що вони змінюють у реченні.',
		resources: 'Курси, подкасти, словники й інструменти для вивчення української, дібрані вручну, з рівнем і вартістю кожного.',
		support: 'Куди задонатити для України: United24 та інші фонди для оборони, медицини, допомоги, дітей, освіти, тварин, відбудови, культури й ветеранів.',
		commonWords: '1000 найуживаніших українських слів за частотою, кожне з наголосом, частиною мови та значенням англійською.',
		words: 'Увесь українсько-англійський словник за літерами: кожне слово за абеткою, з наголосом, формами та значеннями.',
		letter: (letter, first, last) =>
			`Українські слова на літеру ${letter}, від «${first}» до «${last}», кожне зі значенням англійською, наголосом і формами.`,
		other: 'Статті словника, що не починаються з української літери: знаки та слова, записані іншими абетками.',
		saved: 'Слова, які ви зберегли: у цьому браузері або у вашому обліковому записі.',
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
		intro: 'Інші добрі місця, де можна вчити українську: курси, подкасти, словники й інструменти.',
		filterLabel: 'Звузити список',
		filterPlaceholder: 'Введіть, щоб звузити список…',
		kindLegend: 'Вид ресурсу',
		all: 'Усі',
		kinds: {
			course: 'Курси', podcast: 'Подкасти', reading: 'Читання', dictionary: 'Словники',
			tool: 'Інструменти', tutor: 'Репетитори', community: 'Спільноти', book: 'Книжки'
		},
		kind: {
			course: 'Курс', podcast: 'Подкаст або відео', reading: 'Читання й слухання',
			dictionary: 'Словник або довідник', tool: 'Інструмент', tutor: 'Репетитори', community: 'Спільнота', book: 'Книжка'
		},
		cost: { free: 'Безкоштовно', freemium: 'Безкоштовно + платне', paid: 'Платно' },
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
		none: 'Нічого не знайдено.',
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
