// Text normalisation shared by the search. These mirror the Python functions in
// data/import_wiktionary.py exactly: the database keys were made with those, so
// what the user types must be normalised the same way.

const STRESS = '\u0301';

// Characters people and dictionaries use for the Ukrainian apostrophe (п'ять):
// typewriter ', curly ‘ ’, modifier letter ʼ, and the backtick ` and acute ´
// that turn up in quick typing.
const APOSTROPHES = /['‘’ʼ`´]/g;

/** Lookup form of a Ukrainian word: no stress mark, lowercase, one apostrophe style. */
export function plain(text: string): string {
	return text
		.normalize('NFC')
		.replaceAll(STRESS, '')
		.toLowerCase()
		.replace(APOSTROPHES, "'");
}

// Ukrainian national transliteration (Cabinet of Ministers resolution 55, 2010).
// Each letter maps to [word-initial, elsewhere].
const NATIONAL: Record<string, [string, string]> = {
	а: ['a', 'a'], б: ['b', 'b'], в: ['v', 'v'], г: ['h', 'h'],
	ґ: ['g', 'g'], д: ['d', 'd'], е: ['e', 'e'], є: ['ye', 'ie'],
	ж: ['zh', 'zh'], з: ['z', 'z'], и: ['y', 'y'], і: ['i', 'i'],
	ї: ['yi', 'i'], й: ['y', 'i'], к: ['k', 'k'], л: ['l', 'l'],
	м: ['m', 'm'], н: ['n', 'n'], о: ['o', 'o'], п: ['p', 'p'],
	р: ['r', 'r'], с: ['s', 's'], т: ['t', 't'], у: ['u', 'u'],
	ф: ['f', 'f'], х: ['kh', 'kh'], ц: ['ts', 'ts'], ч: ['ch', 'ch'],
	ш: ['sh', 'sh'], щ: ['shch', 'shch'], ю: ['yu', 'iu'],
	я: ['ya', 'ia'], ь: ['', ''], "'": ['', '']
};

/** калина -> kalyna (official Ukrainian romanisation). */
export function nationalTranslit(word: string): string {
	let out = '';
	let start = true;
	for (const ch of plain(word)) {
		const pair = NATIONAL[ch];
		if (pair === undefined) {
			out += ch;
			start = !/\p{L}/u.test(ch);
			continue;
		}
		out += start ? pair[0] : pair[1];
		start = false;
	}
	return out;
}

const LOOSE: [string, string][] = [
	['shch', 'sc'], ['sch', 'sc'],
	['kh', 'h'], ['ch', 'c'], ['zh', 'z'], ['sh', 's'], ['ts', 'c'],
	['x', 'h'], ['g', 'h'], ['w', 'v'], ['j', 'i'], ['y', 'i']
];

/**
 * Collapse Latin spelling variants so that different romanisation habits meet:
 * kalyna, kalina and kalýna all become "kalina"; khata, xata -> "hata".
 */
export function looseLatin(text: string): string {
	let t = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z]/g, '');
	for (const [from, to] of LOOSE) t = t.replaceAll(from, to);
	return t.replace(/(.)\1+/g, '$1');
}

export function isCyrillic(text: string): boolean {
	return /[Ѐ-ӿ]/.test(text);
}

/**
 * Collapse a loose Latin key further, merging sounds learners mix up: е/и/і all
 * become "i" and щ joins ш, so превіт meets привіт, shastya meets щастя and
 * kiev meets Київ. Input is the output of looseLatin().
 */
export function soundKey(loose: string): string {
	return loose.replaceAll('e', 'i').replaceAll('sc', 's').replace(/(.)\1+/g, '$1');
}

/**
 * Every way of removing one letter. Two keys within one typo of each other
 * always share one of these, or one contains the other, which is what lets an
 * ordinary index find typos.
 */
export function deletes(key: string): string[] {
	const out = new Set<string>();
	for (let i = 0; i < key.length; i++) out.add(key.slice(0, i) + key.slice(i + 1));
	return [...out];
}

/** Shorter keys are one typo away from far too many words. */
export const TYPO_MIN = 4;

/** True if a and b differ by at most one typo: a letter wrong, missing, extra, or two swapped. */
export function editsApart(a: string, b: string): boolean {
	if (a === b) return true;
	if (Math.abs(a.length - b.length) > 1) return false;
	let i = 0;
	while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
	if (a.length === b.length) {
		return (
			a.slice(i + 1) === b.slice(i + 1) ||
			(a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
		);
	}
	const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
	return longer.slice(i + 1) === shorter.slice(i);
}

// What the keys of a Latin (QWERTY) keyboard type on the Ukrainian layout, for
// people who forgot to switch: "ghbdsn" -> "привіт".
const QWERTY = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`\\";
const UKRAINIAN_KEYS = "йцукенгшщзхїфівапролджєячсмитьбю'ґ";

export function fromWrongLayout(text: string): string {
	let out = '';
	for (const ch of text.toLowerCase()) {
		const i = QWERTY.indexOf(ch);
		out += i === -1 ? ch : UKRAINIAN_KEYS[i];
	}
	return out;
}

// Letters from a Russian keyboard and their nearest Ukrainian spelling.
const RUSSIAN_LETTERS: Record<string, string> = { ы: 'и', э: 'е', ё: 'йо', ъ: "'" };

export function fromRussianLetters(text: string): string {
	let out = '';
	for (const ch of text) out += RUSSIAN_LETTERS[ch] ?? ch;
	return out;
}
