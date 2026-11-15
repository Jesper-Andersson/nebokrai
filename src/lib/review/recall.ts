// Typing the answer on a flashcard (/review). A word reviewed before comes up
// English side first: the learner types the Ukrainian word, then the form a
// real sentence needs (склянку води, "a glass of water"). Typing it, rather
// than recognising it, is what builds the active use of a word; the research
// note behind this is in the plan for the feature. Also what /practice uses to
// mark a typed answer, so the two pages mark alike. No Svelte and no browser,
// so `npm test` runs this file.
import { isCyrillic, looseLatin, nationalTranslit, plain } from '../search/normalize.ts';
import { tokens } from '../sentence.ts';
import { REVIEW, type ReviewCard } from './fsrs.ts';
import type { Random } from '../practice/round.ts';

/**
 * Days a word must be expected to hold (FSRS stability) before it is typed.
 * Recalling a word unaided helps most where it mostly succeeds, and making
 * learners produce a word they have barely met can even get in the way of
 * learning it (Barcroft 2006), so a word is first recognised across a real
 * gap. With Good every time, a word met on day 0 (stability 2.3) is
 * recognised on day 2 and comes back to be typed about eleven days later
 * (stability 11). After Again it drops under a week and is turned over
 * again until it holds. No study gives this number; it is the first review
 * after one recall across days.
 */
export const TYPE_AFTER_DAYS = 7;

/** Whether a card is answered by typing: a word reviewed before, that has held for days. */
export const typable = (card: ReviewCard | null | undefined): boolean =>
	!!card && card.state === REVIEW && card.stability >= TYPE_AFTER_DAYS;

/**
 * What a typed answer is: the form wanted, another form of the same word
 * (the right word, the wrong ending), close to one of them, or none of these.
 */
export type Typed = 'right' | 'form' | 'close' | 'wrong';

/** Latin letters as typed, without accents or apostrophes: tsúkru -> tsukru. */
function bareLatin(text: string): string {
	return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z]/g, '');
}

/**
 * Marks `given` against `answer`, its other right spellings `also` (as
 * `plain()` writes them: столу beside столі) and every form of the word.
 * Stress marks, capitals and the kind of apostrophe do not count.
 *
 * An answer in Latin letters counts when it is the national transliteration
 * (nationalTranslit) of the form: tsukru for цукру. This tests the word, not
 * the alphabet. The match is exact, not loose: loosely y and i are one letter,
 * and stoly (столи) would then pass for stoli (столі), another case. Latin
 * that is near a form, spelled another way (cukru) or cut short (tsukr), is
 * "close", and the page lets it be tried again.
 */
export function checkTyped(answer: string, also: readonly string[], forms: readonly string[], given: string): Typed {
	const typed = plain(given.trim());
	if (!typed) return 'wrong';
	if (isCyrillic(typed)) {
		if (typed === plain(answer) || also.includes(typed)) return 'right';
		return forms.includes(typed) ? 'form' : 'wrong';
	}
	const roman = bareLatin(typed);
	if (!roman) return 'wrong';
	const wanted = [answer, ...also].map(nationalTranslit);
	const others = forms.map(nationalTranslit);
	if (wanted.includes(roman)) return 'right';
	if (others.includes(roman)) return 'form';
	const loose = looseLatin(roman);
	const near = (form: string) => looseLatin(form) === loose || (roman.length >= 2 && form.startsWith(roman));
	return [...wanted, ...others].some(near) ? 'close' : 'wrong';
}

/** One row of the `forms` table, its tags read. */
export interface FormRow {
	/** With stress: води́. */
	form: string;
	/** As `plain()` writes it: води. */
	plain: string;
	tags: string[];
}

/** What a spelling in a sentence can be: во́ди, nominative plural and accusative plural. */
export interface Reading {
	form: string;
	tags: string[][];
}

/** Where the word stands in the card's sentence, and what it can be there. */
export interface RecallGap {
	start: number;
	length: number;
	/** The word as the sentence has it, as `plain()` writes it: води. */
	plain: string;
	/** Other spellings of the same form, taken as right too: брату where the sentence has братові. */
	also: string[];
	/**
	 * What that spelling can be, by stress: води́ (genitive singular), во́ди
	 * (nominative and accusative plural). The sentence alone does not say
	 * which, so the card shows them all and the stress only where it is one.
	 */
	readings: Reading[];
}

/** What a card needs for typing: the forms to mark against, and the sentence's gap. */
export interface Recall {
	/** Every spelling of the word, the dictionary form first, as `plain()` writes them. */
	forms: string[];
	/** Null where the card has no sentence, or the sentence has the word in no form the dictionary lists. */
	gap: RecallGap | null;
}

const key = (tags: readonly string[]) => [...tags].sort().join(' ');

/**
 * The recall for a word: `word` and `headword` are the entry's, `sentence` is
 * its card's Tatoeba sentence and `rows` the entry's forms. The first word of
 * the sentence that is a form of the entry is the gap: the importer attached
 * the sentence to the entry by that word (data/import_wiktionary.py).
 */
export function recallOf(word: string, headword: string, sentence: string | null, rows: readonly FormRow[]): Recall {
	const own = plain(word);
	const forms = [...new Set([own, ...rows.map((row) => row.plain)])];
	if (!sentence) return { forms, gap: null };

	let start = 0;
	for (const token of tokens(sentence)) {
		const at = start;
		start += token.text.length;
		if (!token.word) continue;
		const spelling = plain(token.text);
		if (!forms.includes(spelling)) continue;

		let matching = rows.filter((row) => row.plain === spelling);
		// A vocative is a call to someone (Мамо!); next to another reading it is noise
		const called = (row: FormRow) => row.tags.includes('vocative');
		if (matching.some((row) => !called(row))) matching = matching.filter((row) => !called(row));

		const readings: Reading[] = [];
		for (const row of matching) {
			const had = readings.find((reading) => reading.form === row.form);
			if (had) had.tags.push(row.tags);
			else readings.push({ form: row.form, tags: [row.tags] });
		}
		// The dictionary form with no table of forms (an adverb, a particle)
		if (!readings.length) readings.push({ form: headword, tags: [] });

		const wanted = new Set(matching.map((row) => key(row.tags)));
		const also = [...new Set(rows.filter((row) => row.plain !== spelling && wanted.has(key(row.tags))).map((row) => row.plain))];
		return { forms, gap: { start: at, length: token.text.length, plain: spelling, also, readings } };
	}
	return { forms, gap: null };
}

/**
 * Whether the sentence asks for anything beyond the word itself: where it has
 * the dictionary form (Вода холодна), the second step would ask the same again.
 */
export const asksForm = (word: string, gap: RecallGap): boolean => gap.plain !== plain(word);

/** The sentence around the gap. */
export function around(sentence: string, gap: RecallGap): { before: string; word: string; after: string } {
	return {
		before: sentence.slice(0, gap.start),
		word: sentence.slice(gap.start, gap.start + gap.length),
		after: sentence.slice(gap.start + gap.length)
	};
}

/**
 * The first hint: the word's first letter, and a line for each letter after
 * it, so its length shows too (вода: в _ _ _). Spaces, hyphens and
 * apostrophes stay as they are.
 */
export function firstLetter(word: string): string {
	const letters = [...plain(word)];
	return letters.map((ch, i) => (i === 0 || !/\p{L}/u.test(ch) ? ch : '_')).join(' ');
}

/** A word offered among four, by its dictionary spelling and its stressed headword. */
export interface Choice {
	word: string;
	headword: string;
}

/** The fewest other words that make a choice of four. */
const OTHERS = 3;

/**
 * The second hint: the word among three others, to recognise where it could
 * not be recalled. The others are words the learner is reviewing too, of the
 * same part of speech where there are enough, so a noun is not picked out
 * from three verbs. Null when there are not three others to offer.
 */
export function choicesFor(
	target: Choice & { pos: string },
	pool: readonly (Choice & { pos: string })[],
	random: Random
): Choice[] | null {
	const own = plain(target.word);
	const seen = new Set([own]);
	const others = pool.filter((card) => {
		const key = plain(card.word);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	const alike = shuffled(others.filter((card) => card.pos === target.pos), random);
	const rest = shuffled(others.filter((card) => card.pos !== target.pos), random);
	const picked = [...alike, ...rest].slice(0, OTHERS);
	if (picked.length < OTHERS) return null;
	const keep = ({ word, headword }: Choice): Choice => ({ word, headword });
	return shuffled([target, ...picked].map(keep), random);
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * How a typed card went: how the word came (typed unaided, typed after its
 * first letter was shown, picked from four, or not at all), and whether its
 * form in the sentence was right (null where the sentence did not ask).
 */
export interface Recalled {
	word: 'right' | 'hinted' | 'chosen' | 'missed';
	form: 'right' | 'helped' | 'missed' | null;
}

/**
 * The answer a typed card suggests. Knowing the word is what the card is
 * about, so the word alone decides: recalled, even from its first letter
 * and with the wrong ending, it is Good; only recognised among four, or not
 * known, it is Again, and comes back soon.
 */
export const suggested = (recalled: Recalled): 'again' | 'good' =>
	recalled.word === 'right' || recalled.word === 'hinted' ? 'good' : 'again';
