// Where the stress falls in a word, and whether one of its forms carries it
// somewhere else (рука́ → ру́ки). Stress is U+0301 after the stressed vowel.
// Syllables are counted from the start of the word, one per vowel, which is
// enough to compare the forms of one word: they share their beginning.

const STRESS = '́';
const VOWELS = new Set('аеєиіїоуюя');

/** How many syllables a word has: one per vowel. */
export function syllables(word: string): number {
	let count = 0;
	for (const ch of word.toLowerCase()) if (VOWELS.has(ch)) count++;
	return count;
}

/**
 * The stressed syllables of `word`, the first being 0. Usually one; two when
 * both stresses are in use (по́ми́лка). A word of one syllable needs no mark
 * and is stressed there (стіл). Empty when it cannot be told: a longer word
 * with no mark, or several words (бу́ду чита́ти).
 */
export function stressedSyllables(word: string): number[] {
	const text = word.normalize('NFC').trim().toLowerCase();
	if (/\s/.test(text)) return [];
	const marked: number[] = [];
	let count = 0;
	let afterVowel = false;
	for (const ch of text) {
		if (ch === STRESS) {
			if (afterVowel) marked.push(count - 1);
			continue;
		}
		afterVowel = VOWELS.has(ch);
		if (afterVowel) count++;
	}
	if (marked.length) return marked;
	return count === 1 ? [0] : [];
}

/**
 * True when `form` is stressed on a different syllable from `headword`:
 * рука́ → ру́ки, стіл → стола́, писа́ти → пи́шеш. A form of one syllable is
 * never counted (рука́ → рук): it has nowhere else to put the stress, so
 * there is nothing to learn from it.
 */
export function stressMoved(headword: string, form: string): boolean {
	if (syllables(form) < 2) return false;
	const base = stressedSyllables(headword);
	const own = stressedSyllables(form);
	return base.length > 0 && own.length > 0 && !own.some((s) => base.includes(s));
}

/**
 * What the forms of a word do with its stress, for the line under its tables:
 * 'moves' when at least one form carries it elsewhere, 'stays' when every form
 * that can be compared keeps it, null when nothing can be compared.
 */
export function stressShift(headword: string, forms: string[]): 'moves' | 'stays' | null {
	if (!stressedSyllables(headword).length) return null;
	let compared = false;
	for (const form of forms) {
		if (stressMoved(headword, form)) return 'moves';
		compared ||= syllables(form) > 1 && stressedSyllables(form).length > 0;
	}
	return compared ? 'stays' : null;
}

/** True for two words spelled alike and stressed apart: за́мок (castle), замо́к (lock). */
export function differOnlyByStress(a: string, b: string): boolean {
	const bare = (text: string) => text.normalize('NFC').replaceAll(STRESS, '');
	if (bare(a) !== bare(b)) return false;
	const x = stressedSyllables(a);
	const y = stressedSyllables(b);
	return x.length > 0 && y.length > 0 && !x.some((s) => y.includes(s));
}
