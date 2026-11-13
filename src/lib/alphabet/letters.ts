// The Ukrainian alphabet as the alphabet trainer (/alphabet) teaches it: each
// letter with the Latin it is answered by, its name, its sound and a word to
// meet it in. No imports: `npm test` runs this file.
//
// The letters are met in six groups, ordered for someone who reads the Latin
// alphabet: first the letters that are what they look like, then the ones that
// look familiar and are not (в is v, н is n, р is r), then the new shapes.

export const GROUP_IDS = ['same', 'false-friends', 'new-shapes', 'hushing', 'iotated', 'signs'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

/** The apostrophe is not one of the 33 letters, but no one reads п'ять without it. */
export const APOSTROPHE = "'";

export interface Letter {
	/** Lower case: ж. The apostrophe is its own entry. */
	letter: string;
	/** Upper case: Ж. The apostrophe has none. */
	upper: string;
	group: GroupId;
	/**
	 * The Latin shown for it: the national transliteration, as at the start of
	 * a word (є is ye). Empty for the soft sign and the apostrophe, which have
	 * no Latin letter.
	 */
	latin: string;
	/**
	 * What a typed answer may be. Lenient where romanisations differ (є is ye
	 * in one, ie or je in another), strict where the letter is the lesson: г is
	 * h and never g, because ґ is g.
	 */
	accept: string[];
	/** The letter's name in Ukrainian: же. */
	name: string;
	/** Its sound, without the slashes. */
	ipa: string;
	/** The sound for an English speaker. English only, as the dictionary's meanings are. */
	hint: string;
	/** A word of the dictionary that has the letter, in its plain spelling, and what it means. */
	example: string;
	meaning: string;
	/** The letters it is taken for, most likely first: what a wrong choice is made from. */
	confusable: string[];
}

type Row = [
	letter: string, group: GroupId, latin: string, accept: string, name: string, ipa: string, hint: string,
	example: string, meaning: string, confusable: string
];

// The Latin of each letter is the national transliteration (Cabinet of
// Ministers resolution 55, 2010), which src/lib/search/normalize.ts also
// follows; tests/alphabet.test.ts holds the two together.
const ROWS: Row[] = [
	['а', 'same', 'a', 'a', 'а', 'ɑ', 'a as in father', 'автобус', 'bus', 'оя'],
	['б', 'new-shapes', 'b', 'b', 'бе', 'b', 'b as in bed', 'банан', 'banana', 'вдп'],
	['в', 'false-friends', 'v', 'v', 'ве', 'ʋ', 'v as in vine; nearer to w at the end of a syllable', 'вода', 'water', 'бфу'],
	['г', 'new-shapes', 'h', 'h', 'ге', 'ɦ', 'h as in ahead, with voice; never the g of go', 'гітара', 'guitar', 'ґхр'],
	['ґ', 'new-shapes', 'g', 'g', 'ґе', 'ɡ', 'g as in go; a rare letter', 'ґанок', 'porch', 'гкд'],
	['д', 'new-shapes', 'd', 'd', 'де', 'd', 'd as in door', 'дім', 'house, home', 'бтл'],
	['е', 'same', 'e', 'e', 'е', 'ɛ', 'e as in met', 'екран', 'screen', 'єиі'],
	['є', 'iotated', 'ye', 'ye ie je', 'є', 'jɛ', 'ye as in yes', 'євро', 'euro', 'еїя'],
	['ж', 'hushing', 'zh', 'zh', 'же', 'ʒ', 's as in measure', 'жінка', 'woman', 'зшч'],
	['з', 'new-shapes', 'z', 'z', 'зе', 'z', 'z as in zoo', 'зима', 'winter', 'сжц'],
	['и', 'false-friends', 'y', 'y', 'и', 'ɪ', 'i as in bit', 'син', 'son', 'іуе'],
	['і', 'same', 'i', 'i', 'і', 'i', 'ee as in see', 'ідея', 'idea', 'иїе'],
	['ї', 'iotated', 'yi', 'yi ji i', 'ї', 'ji', 'yee as in yeast', 'їжа', 'food', 'ійє'],
	['й', 'iotated', 'y', 'y i j', 'йот', 'j', 'y as in boy', 'йогурт', 'yoghurt', 'їія'],
	['к', 'same', 'k', 'k', 'ка', 'k', 'k as in kite', 'кава', 'coffee', 'хґг'],
	['л', 'new-shapes', 'l', 'l', 'ел', 'l', 'l as in lamp', 'лимон', 'lemon', 'пдм'],
	['м', 'same', 'm', 'm', 'ем', 'm', 'm as in map', 'мама', 'mum', 'нтл'],
	['н', 'false-friends', 'n', 'n', 'ен', 'n', 'n as in net', 'небо', 'sky', 'гмп'],
	['о', 'same', 'o', 'o', 'о', 'ɔ', 'o as in more', 'око', 'eye', 'ауе'],
	['п', 'new-shapes', 'p', 'p', 'пе', 'p', 'p as in spot', 'парк', 'park', 'нлб'],
	['р', 'false-friends', 'r', 'r', 'ер', 'r', 'a rolled r, as in Spanish or Italian', 'риба', 'fish', 'пгл'],
	['с', 'false-friends', 's', 's', 'ес', 's', 's as in sun', 'сир', 'cheese', 'кзц'],
	['т', 'same', 't', 't', 'те', 't', 't as in stop', 'тато', 'dad', 'дчм'],
	['у', 'false-friends', 'u', 'u', 'у', 'u', 'oo as in boot', 'урок', 'lesson', 'июо'],
	['ф', 'new-shapes', 'f', 'f', 'еф', 'f', 'f as in fox', 'фото', 'photo', 'впх'],
	['х', 'false-friends', 'kh', 'kh', 'ха', 'x', 'ch as in the Scottish loch', 'хліб', 'bread', 'гкш'],
	['ц', 'hushing', 'ts', 'ts c', 'це', 't͡s', 'ts as in cats', 'цукор', 'sugar', 'чсз'],
	['ч', 'hushing', 'ch', 'ch', 'че', 't͡ʃ', 'ch as in church', 'час', 'time', 'цшщ'],
	['ш', 'hushing', 'sh', 'sh', 'ша', 'ʃ', 'sh as in ship', 'школа', 'school', 'щсж'],
	['щ', 'hushing', 'shch', 'shch sch', 'ща', 'ʃt͡ʃ', 'sh and ch together, as in fresh cheese', 'щастя', 'happiness', 'шчж'],
	['ь', 'signs', '', '', "м'який знак", 'ʲ', 'no sound of its own: it softens the consonant before it', 'день', 'day', "'бй"],
	['ю', 'iotated', 'yu', 'yu iu ju', 'ю', 'ju', 'like the word you', 'юрист', 'lawyer', 'уяє'],
	['я', 'iotated', 'ya', 'ya ia ja', 'я', 'jɑ', 'ya as in yard', 'яблуко', 'apple', 'аює'],
	[
		APOSTROPHE, 'signs', '', '', 'апостроф', '',
		'no sound: the consonant before it stays hard, and the vowel after it begins with y',
		"п'ять", 'five', 'ьйі'
	]
];

/** The 33 letters in the alphabet's order, then the apostrophe. */
export const LETTERS: readonly Letter[] = ROWS.map(
	([letter, group, latin, accept, name, ipa, hint, example, meaning, confusable]) => ({
		letter,
		upper: letter === APOSTROPHE ? '' : letter.toUpperCase(),
		group,
		latin,
		accept: accept ? accept.split(' ') : [],
		name,
		ipa,
		hint,
		example,
		meaning,
		confusable: [...confusable]
	}));

const BY_LETTER = new Map(LETTERS.map((letter) => [letter.letter, letter]));

/** The entry of a letter (lower case), or undefined for anything else. */
export const letterInfo = (letter: string): Letter | undefined => BY_LETTER.get(letter);

/** A sign has no Latin letter: the soft sign and the apostrophe. */
export const isSign = (letter: string): boolean => BY_LETTER.get(letter)?.latin === '';

/** The letters of the groups given, in the alphabet's order. */
export function lettersOf(groups: readonly GroupId[]): string[] {
	return LETTERS.filter((letter) => groups.includes(letter.group)).map((letter) => letter.letter);
}

/** How a letter is printed for the learner: "Ж ж", and the apostrophe alone. */
export const pair = (letter: string): string => {
	const upper = BY_LETTER.get(letter)?.upper;
	return upper ? `${upper} ${letter}` : letter;
};
