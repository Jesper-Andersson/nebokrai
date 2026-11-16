// Ukrainian swaps у and в, і and й at the start of a word to keep vowels and
// consonants apart from the word before (euphony, милозвучність): уміти and
// вміти, уже and вже, іти and йти are one word. The dictionary usually has
// only one spelling of each pair, so a list that writes the other finds it
// through this. Only the first letter: a prefix inside a word (навчити) is not
// swapped this way.
import { plain } from './normalize.ts';

const SWAP: Record<string, string> = { у: 'в', в: 'у', і: 'й', й: 'і' };

/** The word with its first letter swapped (вміти → уміти), as a `plain` key; null if it has no such letter. */
export function initialVariant(word: string): string | null {
	const key = plain(word);
	const other = SWAP[key[0]];
	// A lone в or у is a preposition with an entry of its own either way
	return other && key.length > 1 ? other + key.slice(1) : null;
}

/** Whether two words are the same but for that first letter: «умі́ти вмі́ти». */
export function areInitialVariants(a: string, b: string): boolean {
	return initialVariant(a) === plain(b);
}
