// What a reader can suggest a correction to on a word's page, or a word the
// dictionary does not have yet, shared by the pages, the endpoint
// (/api/suggest) and the tests. The storage is in src/lib/server/suggestions.ts.
import type { WordEntry } from '#lib/search/word.ts';

/**
 * The parts of an entry a suggestion can point at: the headword's spelling,
 * its stress (вода́), one meaning, a quotation under a meaning, a Tatoeba
 * example sentence, or one form in the tables. `new-word` is a word with no
 * entry at all: it has no "before", and its meaning is the proposal.
 */
export const SUGGEST_TARGETS = ['headword', 'stress', 'meaning', 'quote', 'example', 'form', 'new-word'] as const;
export type SuggestTarget = (typeof SUGGEST_TARGETS)[number];

export const isSuggestTarget = (value: unknown): value is SuggestTarget =>
	typeof value === 'string' && (SUGGEST_TARGETS as readonly string[]).includes(value);

/** The longest corrected text: an example sentence or a meaning. */
export const MAX_SUGGEST_TEXT = 500;
/** The longest "why". */
export const MAX_SUGGEST_NOTE = 1000;
/** The longest name given for the credit. */
export const MAX_SUGGEST_NAME = 60;

/**
 * Where a suggestion points. Entry ids change with every rebuild of the
 * dictionary, so an entry is named by its spelling, part of speech and
 * stressed headword, and the part by something that survives a rebuild: a
 * meaning's number and text, Tatoeba's own sentence id, a form and its tags.
 */
export interface SuggestPlace {
	target: SuggestTarget;
	word: string;
	pos: string;
	headword: string;
	/** `meaning` and `quote`: the meaning's number, from 1. */
	sense_n?: number | null;
	/** `example`: Tatoeba's id of the sentence. */
	tatoeba_id?: number | null;
	/** `form`: the tags of the form (genitive, plural). */
	form_tags?: string[] | null;
	/** What the page shows now: the meaning, the quotation, the form. */
	current?: string | null;
}

/** What the dictionary holds at a place: the text, and its English where the part has one. */
export interface Current {
	current: string;
	current_en: string | null;
}

// Two spellings of one text (a composed and a decomposed й) are the same text.
const same = (a: string, b: string) => a.normalize('NFC') === b.normalize('NFC');

/** The tags of a form in one order, as stored with a suggestion. */
export const formTagsKey = (tags: readonly string[]) => [...tags].sort().join(' ');

/**
 * Looks a place up in the entries of its word (`wordDetails(db, place.word)`)
 * and returns what the dictionary holds there, or null when there is no such
 * part. The endpoint stores this, not what the browser sent, so a suggestion
 * always records the real "before".
 *
 * A spelling can have several entries with one part of speech (стан is a noun
 * five times); the part is then looked for in each of them.
 */
export function findCurrent(entries: readonly WordEntry[], place: SuggestPlace): Current | null {
	const candidates = entries.filter(
		(e) => same(e.word, place.word) && e.pos === place.pos && same(e.headword, place.headword)
	);
	const said = place.current ?? '';
	for (const entry of candidates) {
		switch (place.target) {
			case 'headword':
			case 'stress':
				return { current: entry.headword, current_en: null };
			case 'meaning': {
				const sense = entry.senses.find((s) => s.n === place.sense_n && same(s.gloss, said));
				if (sense) return { current: sense.gloss, current_en: null };
				break;
			}
			case 'quote': {
				const sense = entry.senses.find((s) => s.n === place.sense_n);
				const quote = sense?.examples.find((x) => same(x.text, said));
				if (quote) return { current: quote.text, current_en: quote.english };
				break;
			}
			case 'example': {
				const sentence = entry.examples.find((x) => x.tatoeba_id === place.tatoeba_id);
				if (sentence) return { current: sentence.uk, current_en: sentence.en };
				break;
			}
			case 'form': {
				const wanted = formTagsKey(place.form_tags ?? []);
				const form = entry.forms.find((f) => same(f.form, said) && formTagsKey(f.tags) === wanted);
				if (form) return { current: form.form, current_en: null };
				break;
			}
		}
	}
	return null;
}

/** Whether a proposal says anything new: the same text (and English) is not a suggestion. */
export function unchanged(now: Current, proposed: string, proposedEn: string | null): boolean {
	const text = same(now.current.trim(), proposed.trim());
	if (now.current_en === null || proposedEn === null) return text;
	return text && same(now.current_en.trim(), proposedEn.trim());
}

/**
 * What a reader can say a new word is. `unknown` is "not sure": better a word
 * without a part of speech than a guess the reviewer has to undo.
 */
export const NEW_WORD_POS = ['noun', 'verb', 'adjective', 'adverb', 'other', 'unknown'] as const;
export type NewWordPos = (typeof NEW_WORD_POS)[number];

export const isNewWordPos = (value: unknown): value is NewWordPos =>
	typeof value === 'string' && (NEW_WORD_POS as readonly string[]).includes(value);

const STRESS = '\u0301';
const VOWELS = 'аеєиіїоуюяАЕЄИІЇОУЮЯ';
// Ukrainian letters, the apostrophe in its usual spellings, a hyphen (пів-яблука)
// and spaces (for a phrase). Stress marks are checked on their own.
const UKRAINIAN = /^[а-щьюяґєіїА-ЩЬЮЯҐЄІЇ'‘’ʼ\- ]+$/;

/**
 * Whether a search can be offered as a new word: Ukrainian letters only, so
 * an English search (dog) or a sentence pasted in does not get the button.
 */
export function canAddWord(query: string): boolean {
	const text = query.normalize('NFC').replaceAll(STRESS, '').trim();
	return text.length > 0 && text.length <= 60 && /[а-щьюяґєії]/i.test(text) && UKRAINIAN.test(text);
}

/**
 * Whether `headword` is `word` with stress marks added and nothing else: the
 * same letters, in the same case, once U+0301 is removed (вода́ for вода), each mark straight
 * after a vowel, and at most two (a compound can have a second stress).
 */
export function stressMarks(word: string, headword: string): boolean {
	const marked = headword.normalize('NFC');
	if (marked.replaceAll(STRESS, '') !== word.normalize('NFC')) return false;
	let marks = 0;
	for (let i = 0; i < marked.length; i++) {
		if (marked[i] !== STRESS) continue;
		if (i === 0 || !VOWELS.includes(marked[i - 1])) return false;
		marks++;
	}
	return marks <= 2;
}

/**
 * Whether a search reads as English words (dog, ice cream, mother-in-law), so
 * that the reader can be offered to give the Ukrainian word for it.
 */
export function canAddEnglish(query: string): boolean {
	const text = query.trim();
	return text.length > 0 && text.length <= 60 && /^[A-Za-z][A-Za-z' -]*$/.test(text);
}
