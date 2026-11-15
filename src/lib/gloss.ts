// What the small card over a word in a sentence shows (GlossWord.svelte),
// asked for by `GET /api/gloss` (docs/api.md). In "Дайте, будь ласка, склянку
// води." a press on склянку gives
//
//   скля́нка · noun, feminine · скля́нку: accusative singular · glass (drinking vessel)
//
// The word is first read together with its neighbour, because some pairs are
// entries of their own: ласка after будь is будь ла́ска, "please", before it
// is ла́ска, "caress". Only `search()` is asked, not `lookup()`: a pair is
// usually no entry at all, and the typo guesses `lookup()` would then make
// cost far more than the answer is worth.
//
// No server imports, so tests/gloss.test.ts runs it on the local database.
import { groupMatched, type MatchedForm } from '#lib/forms.ts';
import type { Db } from '#lib/search/db.ts';
import { search, type SearchResult } from '#lib/search/search.ts';

/** Longest word or neighbour asked about; the longest word in the dictionary is shorter. */
export const MAX_GLOSS_WORD = 40;
/** Readings of one spelling shown on the card: води is вода and водити. */
const READINGS = 3;

export interface Gloss {
	/** Plain spelling, for `wordPath()` and saving. */
	word: string;
	/** With its stress: скля́нка */
	headword: string;
	pos: string;
	tags: string[];
	/** Which forms of the word the sentence has: скля́нку, accusative singular. Empty for the word itself. */
	forms: MatchedForm[];
	/** The first meaning; null when only VESUM knows the word. */
	meaning: string | null;
	vesum_only?: true;
}

export interface GlossAnswer {
	/** The word and a neighbour read as one entry: будь ла́ска. */
	phrase: Gloss | null;
	/** The word alone, most likely first. Empty when the dictionary does not know it. */
	readings: Gloss[];
}

// What a word standing in a sentence never is: у there is the preposition,
// not the letter У, and -ка is not a suffix in "склянка".
const NOT_A_WORD = new Set(['character', 'symbol', 'punct', 'suffix', 'prefix', 'interfix', 'combining_form']);

// A word or one of its forms, never a word that only starts with it (ласкаво
// for ласка) or mentions it in a meaning.
const exact = (r: SearchResult) => (r.match === 'word' || r.match === 'form') && !NOT_A_WORD.has(r.pos);

// Wiktionary keeps some inflected forms as entries of their own, whose only
// meaning names the form: вихідних is "genitive/locative plural of вихідни́й".
// Beside the word it points to (вихідні, "weekend") such an entry says
// nothing, so it is left out when the word has another reading. A synonym
// or a verbal noun ("synonym of холоди́льник") is a word, and stays.
const FORM_NOTE =
	/^[a-z/ -]*\b(?:nominative|genitive|dative|accusative|instrumental|locative|vocative|singular|plural|person|infinitive|imperative|indicative|participle|present|past|future)\b[a-z/ -]* of [Ѐ-ӿ]/i;
const onlyNamesAForm = (r: SearchResult) => r.glosses.length > 0 && r.glosses.every((g) => FORM_NOTE.test(g));

function toGloss(r: SearchResult): Gloss {
	const gloss: Gloss = {
		word: r.word,
		headword: r.headword,
		pos: r.pos,
		tags: r.tags,
		forms: r.match === 'form' && r.matched_forms ? groupMatched(r.matched_forms).groups : [],
		meaning: r.glosses[0] ?? null
	};
	if (r.vesum_only) gloss.vesum_only = true;
	return gloss;
}

/**
 * The card for `word`, read with the word before and after it when they are
 * separated from it by a space only (the caller decides that: never across a
 * comma, as in "ласка, склянку").
 */
export async function glossFor(
	db: Db,
	vesum: Db | undefined,
	word: string,
	before?: string,
	after?: string
): Promise<GlossAnswer> {
	const w = word.trim();
	if (!w) return { phrase: null, readings: [] };

	let phrase: Gloss | null = null;
	for (const pair of [before && `${before.trim()} ${w}`, after && `${w} ${after.trim()}`]) {
		if (!pair) continue;
		const hit = (await search(db, pair, { limit: 3 })).find((r) => exact(r) && r.word.includes(' '));
		if (hit) {
			phrase = toGloss(hit);
			break;
		}
	}

	const found = (await search(db, w, { limit: 10, vesum })).filter(exact);
	const words = found.filter((r) => !onlyNamesAForm(r));
	const readings = (words.length ? words : found).slice(0, READINGS).map(toGloss);
	return { phrase, readings };
}
