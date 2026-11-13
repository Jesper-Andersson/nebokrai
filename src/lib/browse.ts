// The two ways into the dictionary that need no search box: the commonest
// words (/common-words), and every word under its first letter (/words), as
// the thumb index of a printed dictionary. A reader browses them; a search
// engine follows them to the word pages, which nothing else links to.
//
// No SvelteKit imports, so tests/browse.test.ts runs this on the local database.
import type { Db } from './search/db.ts';

/** The Ukrainian alphabet in its own order: ґ after г, є after е, і and ї after и. */
export const ALPHABET = [...'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'];
/** The address of the page for what begins with no Ukrainian letter: QR-код, Paryž, №. */
export const OTHER = 'other';
/** Words on one page of a letter. п has 3,800 words, so seven pages. */
export const WORDS_PER_PAGE = 600;

const PLACE = new Map(ALPHABET.map((letter, i) => [letter, i]));

/**
 * The letter a word is filed under, as a printed dictionary files it: by its
 * first letter whatever stands before it (-ський under с) and whatever its
 * case (Київ under к). Null for a word that begins with no Ukrainian letter.
 */
export function letterOf(word: string): string | null {
	const first = [...word.replace(/^[^\p{L}]+/u, '')][0]?.toLowerCase();
	return first !== undefined && PLACE.has(first) ? first : null;
}

// A database sorts by the number of each letter, and there і, ї, є and ґ
// stand after я, and every capital before every small letter. The key puts
// the alphabet's own order in their place, and leaves out what a dictionary
// ignores when it sorts: case, hyphens, apostrophes and spaces (п'ять stands
// after пюре, where пять would, not before па).
function sortKey(word: string): string {
	let key = '';
	for (const ch of word.toLowerCase()) {
		const place = PLACE.get(ch);
		if (place !== undefined) key += String.fromCharCode(0x30 + place);
		// Any other letter or digit, after the whole alphabet
		else if (/[\p{L}\p{N}]/u.test(ch)) key += '￿' + ch;
	}
	return key;
}

/** `words` in the order of a Ukrainian dictionary. */
export function sortWords(words: string[]): string[] {
	return words
		.map((word) => ({ word, key: sortKey(word) }))
		.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
		.map((sorted) => sorted.word);
}

const after = (letter: string) => String.fromCodePoint(letter.codePointAt(0)! + 1);

/**
 * Every spelling filed under `letter` (or under OTHER), in dictionary order.
 *
 * The database is asked for ranges of the index on `word`, never for all of
 * it: the small letter, the capital, and what begins with a hyphen or other
 * sign (words before "A"), from which the ones filed elsewhere are dropped.
 * OTHER is what stands outside the Cyrillic letters Ukrainian uses: before Є,
 * the first of them, and from U+0450 on, where only є, і, ї and ґ are Ukrainian.
 */
export async function wordsUnder(db: Db, letter: string): Promise<string[]> {
	const rows =
		letter === OTHER
			? await db.all<{ word: string }>("SELECT DISTINCT word FROM entries WHERE word < 'Є' OR word >= 'ѐ'")
			: await db.all<{ word: string }>(
					`SELECT DISTINCT word FROM entries
					 WHERE (word >= ? AND word < ?) OR (word >= ? AND word < ?) OR word < 'A'`,
					[letter, after(letter), letter.toUpperCase(), after(letter.toUpperCase())]);
	const filed = letter === OTHER ? null : letter;
	return sortWords(rows.map((row) => row.word).filter((word) => letterOf(word) === filed));
}

/** The first and last word of each page of a list: the guide words at the head of a dictionary's page. */
export function guideWords(words: string[]): { first: string; last: string }[] {
	const pages = [];
	for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
		pages.push({ first: words[i], last: words[Math.min(i + WORDS_PER_PAGE, words.length) - 1] });
	}
	return pages;
}

/** The address of a page of a letter. The first page has no number. */
export function letterPath(letter: string, page = 1): string {
	return `/words/${letter}${page > 1 ? `/${page}` : ''}`;
}

/** How many words /common-words lists, and how many on each of its pages. */
export const COMMON_WORDS = 1000;
export const COMMON_PER_PAGE = 100;

export interface CommonWord {
	word: string;
	/** With the stress mark */
	headword: string;
	/** Every part of speech the spelling has among the common entries: що is a pronoun and a conjunction */
	pos: string[];
	/** The first meaning of its commonest entry */
	gloss: string;
}

export function commonPath(page = 1): string {
	return `/common-words${page > 1 ? `/${page}` : ''}`;
}

/**
 * The commonest spellings, commonest first.
 *
 * The frequency rank belongs to an entry, and a spelling can be several
 * entries ranked one after another (що the pronoun, then що the conjunction):
 * a learner counts that as one word, so it is listed once. The first 1,000
 * spellings lie within the first 1,200 entries; half as many again are read.
 *
 * Left out: spellings with a capital, and what is not a word. The ranks come
 * from lower-case text, so a name spelled like a common word carries that
 * word's rank (По, the river, stands before по; Того, the country, is "того"),
 * and a list of vocabulary is no place for names in any case. Letters of the
 * alphabet, signs and affixes have entries too (я is also a letter).
 */
const NOT_WORDS = new Set(['name', 'character', 'symbol', 'punct', 'suffix', 'prefix', 'interfix', 'combining_form']);

interface Spelling {
	id: number;
	word: string;
	headword: string;
	pos: string[];
}

/** The `count` commonest spellings, each with the id of its commonest entry. */
async function commonSpellings(db: Db, count: number): Promise<Spelling[]> {
	const entries = await db.all<{ id: number; word: string; headword: string; pos: string }>(
		'SELECT id, word, headword, pos FROM entries WHERE freq_rank <= ? ORDER BY freq_rank',
		[count * 1.5]);
	const spellings = new Map<string, Spelling>();
	for (const { id, word, headword, pos } of entries) {
		if (word !== word.toLowerCase() || NOT_WORDS.has(pos)) continue;
		const had = spellings.get(word);
		if (!had) {
			if (spellings.size < count) spellings.set(word, { id, word, headword, pos: [pos] });
		} else if (!had.pos.includes(pos)) had.pos.push(pos);
	}
	return [...spellings.values()];
}

/**
 * The spellings in places `from` to `to` of that list, counting from 1: what a
 * review deck of common words holds (src/lib/review/decks.ts).
 */
export async function commonRange(db: Db, from: number, to: number): Promise<string[]> {
	return (await commonSpellings(db, to)).slice(from - 1).map((spelling) => spelling.word);
}

/** A meaning longer than this loses the explanation in brackets at its end. */
const LIST_GLOSS = 60;

/**
 * A meaning as one line of the list of common words.
 *
 * Wiktionary writes a sense for the word's own page, where there is room for
 * what case a preposition asks for and how its use differs from its
 * neighbour's. In a list of a hundred words a line that only names the word
 * in English reads better, and the word's page still has the rest:
 *
 *   "in, at [with locative] (used to express static position/location;
 *   followed by a vowel)" is "in, at" (в),
 *   "[with accusative]; onto (movement that reaches the top…)" is "onto" (на),
 *   "for (2)" is "for" (для) and "one (1)" is "one" (один).
 *
 * A short note in brackets stays: "you (singular); thou", "not (used to
 * negate verbs)". Empty when the sense is a note and nothing else
 * ("[with genitive]").
 */
export function listGloss(gloss: string): string {
	let text = gloss
		// The case the word asks for
		.replace(/\s*\[[^\]]*\]/g, '')
		// What stood between that note and the meaning: "; onto"
		.replace(/^[;,\s]+/, '')
		// The number of a sense on another page, or a numeral said again in figures
		.replace(/\s*\(\d+\)$/, '')
		.trim();
	if (text.length > LIST_GLOSS) {
		// Brackets within the brackets, one deep: "(to say (something) in confidence)"
		const short = text.replace(/\s*\((?:[^()]|\([^()]*\))*\)$/, '');
		if (short) text = short;
	}
	return text;
}

export async function commonWords(db: Db): Promise<CommonWord[]> {
	const list = await commonSpellings(db, COMMON_WORDS);
	// Every sense, not the first alone: where the first is only a note on
	// grammar, the next one is the meaning. One parameter however many ids:
	// D1 allows a query a hundred of them.
	const senses = await db.all<{ entry_id: number; gloss: string }>(
		'SELECT entry_id, gloss FROM senses WHERE entry_id IN (SELECT value FROM json_each(?)) ORDER BY entry_id, n',
		[JSON.stringify(list.map((spelling) => spelling.id))]);
	const glossOf = new Map<number, string>();
	const first = new Map<number, string>();
	for (const { entry_id, gloss } of senses) {
		if (!first.has(entry_id)) first.set(entry_id, gloss);
		if (!glossOf.has(entry_id) && listGloss(gloss)) glossOf.set(entry_id, listGloss(gloss));
	}
	return list.map(({ id, word, headword, pos }) => (
		{ word, headword, pos, gloss: glossOf.get(id) ?? first.get(id) ?? '' }));
}
