// Sample entries until real dictionary data exists.
// Stress is marked with U+0301 (combining acute accent) right after the stressed vowel.
export type Entry = {
	word: string;
	latin: string;
	partOfSpeech: string;
	tags: string[];
	genitive?: string;
	translations: string[];
};

export const entries: Entry[] = [
	{
		word: 'кали́на',
		latin: 'kalyna',
		partOfSpeech: 'Noun',
		tags: ['feminine', 'inanimate', 'uncountable'],
		genitive: 'кали́ни',
		translations: ['guelder rose', 'snowball tree', 'viburnum']
	},
	{
		word: 'кни́га',
		latin: 'knyha',
		partOfSpeech: 'Noun',
		tags: ['feminine', 'inanimate', 'countable'],
		genitive: 'кни́ги',
		translations: ['book']
	},
	{
		word: 'мо́ва',
		latin: 'mova',
		partOfSpeech: 'Noun',
		tags: ['feminine', 'inanimate', 'countable'],
		genitive: 'мо́ви',
		translations: ['language', 'speech']
	},
	{
		word: 'со́нце',
		latin: 'sontse',
		partOfSpeech: 'Noun',
		tags: ['neuter', 'inanimate', 'countable'],
		genitive: 'со́нця',
		translations: ['sun']
	},
	{
		word: 'приві́т',
		latin: 'pryvit',
		partOfSpeech: 'Interjection',
		tags: ['informal'],
		translations: ['hi', 'hello']
	}
];
