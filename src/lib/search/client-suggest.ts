// Suggestions while typing, done in the browser. The page downloads the list
// of dictionary words once (static/words.json, most common first) and matches
// against it locally, so typing costs no database reads.
//
// This is deliberately simpler than the server's search: it only knows
// dictionary words, not their inflected forms or English meanings. Use it for
// the dropdown under the search box; the results page still asks the server.

import {
	TYPO_MIN, editsApart, fromRussianLetters, fromWrongLayout, isCyrillic,
	looseLatin, nationalTranslit, plain, soundKey
} from './normalize.ts';

export type LocalMatch = 'prefix' | 'layout' | 'sound' | 'typo';

export interface LocalSuggestion {
	/** With the stress mark, as in words.json. */
	headword: string;
	/** Plain spelling, for the link to the word. */
	word: string;
	match: LocalMatch;
}

export interface WordIndex {
	headwords: string[];
	plain: string[];
	latin: string[];
	sound: string[];
}

/** Prepare the word list once after downloading it. Takes a few milliseconds per thousand words. */
export function buildIndex(headwords: string[]): WordIndex {
	const plains = headwords.map(plain);
	const latin = plains.map((w) => looseLatin(nationalTranslit(w)));
	return { headwords, plain: plains, latin, sound: latin.map(soundKey) };
}

/**
 * Words to offer for what has been typed so far, best first:
 *   prefix  the word starts with the query            кал    -> калина,  kal -> калина
 *   layout  it does when read on the Ukrainian layout  rfk    -> калина
 *   sound   it starts with letters that sound alike    преві  -> привіт
 *   typo    the whole query is one typo from the word  привфт -> привіт
 * Within one kind, more common words come first.
 */
export function suggestLocal(index: WordIndex, query: string, limit = 8): LocalSuggestion[] {
	const q = query.trim();
	if (!q) return [];
	const taken = new Set<number>();
	const out: LocalSuggestion[] = [];
	const collect = (match: LocalMatch, test: (i: number) => boolean) => {
		for (let i = 0; i < index.headwords.length && out.length < limit; i++) {
			if (!taken.has(i) && test(i)) {
				taken.add(i);
				out.push({ headword: index.headwords[i], word: index.plain[i], match });
			}
		}
	};

	let latin: string;
	if (isCyrillic(q)) {
		const key = fromRussianLetters(plain(q));
		collect('prefix', (i) => index.plain[i].startsWith(key));
		latin = looseLatin(nationalTranslit(key));
	} else {
		latin = looseLatin(q);
		if (latin.length >= 2) collect('prefix', (i) => index.latin[i].startsWith(latin));
		const other = plain(fromWrongLayout(q));
		if (isCyrillic(other)) collect('layout', (i) => index.plain[i].startsWith(other));
	}
	if (latin.length >= 3) {
		const sound = soundKey(latin);
		collect('sound', (i) => index.sound[i].startsWith(sound));
		if (sound.length >= TYPO_MIN) collect('typo', (i) => editsApart(sound, index.sound[i]));
	}
	return out;
}
