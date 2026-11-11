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
