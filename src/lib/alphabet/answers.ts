// Checking what the learner typed in the alphabet trainer, and the Latin
// readings of a word: the right one and the tempting wrong one. No Svelte and
// no browser, so `npm test` runs this file.
import { nationalTranslit, plain } from '../search/normalize.ts';
import { APOSTROPHE, isSign, letterInfo } from './letters.ts';

/** A typed answer as it is compared: no spaces around it, lower case, one apostrophe style. */
const typed = (text: string): string => plain(text.trim());

/** The Latin a Ukrainian word is read as: вода is "voda". The right answer for a word. */
export const reading = (word: string): string => nationalTranslit(word);

/** Whether `answer` is the Latin of a letter: "zh" for ж. Nothing is right for a sign. */
export function checkLetter(letter: string, answer: string): boolean {
	return letterInfo(letter)?.accept.includes(typed(answer)) ?? false;
}

/** Whether `answer` is the letter itself, in either case: the answer when the Latin is shown. */
export function checkWritten(letter: string, answer: string): boolean {
	return typed(answer) === letter;
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * What may be typed for a word, letter by letter: any Latin its letter
 * accepts, so щастя is shchastia, schastya or shchastja. The soft sign and
 * the apostrophe may be typed as an apostrophe or left out, as the national
 * transliteration leaves them out: п'ять is piat or p'iat'.
 */
export function wordPattern(word: string): RegExp {
	let source = '';
	for (const ch of plain(word)) {
		const letter = letterInfo(ch);
		if (!letter) source += escaped(ch);
		else if (isSign(ch)) source += `${APOSTROPHE}?`;
		else source += `(?:${letter.accept.join('|')})`;
	}
	return new RegExp(`^${source}$`);
}

export function checkWord(word: string, answer: string): boolean {
	return wordPattern(word).test(typed(answer));
}

// The Latin letters these look like. A beginner reads ресторан as "pectopah";
// offered beside "restoran", that reading is the wrong choice worth refusing.
const LOOKS_LIKE: Record<string, string> = { в: 'b', н: 'h', р: 'p', с: 'c', у: 'y', х: 'x', и: 'u', г: 'r', п: 'n' };

/**
 * A word read by the look of its letters, the rest read rightly: вода is
 * "boda". Null for a word with no such letter (мама), which cannot be misread
 * this way.
 */
export function misreading(word: string): string | null {
	let out = '';
	let any = false;
	for (const ch of plain(word)) {
		const looks = LOOKS_LIKE[ch];
		if (looks) any = true;
		out += looks ?? reading(ch);
	}
	return any ? out : null;
}
