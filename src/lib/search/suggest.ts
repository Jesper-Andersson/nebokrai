// "Did you mean ...?" Guesses for a query that found no sure match. A port of
// suggest() and lookup() in data/search.py, which stays the reference.
//
// Tried in this order, most certain first:
//   layout     typed on the wrong keyboard layout   ghbdsn  -> привіт
//   respelled  same word, another spelling habit    привит  -> привіт
//              (also spaces: "dobra nich", and Russian letters: книгы)
//   sound      letters that sound alike             превіт  -> привіт
//   typo       one letter wrong, missing or extra   привфт  -> привіт
// Within one kind, more common words come first. Typo guesses cover dictionary
// words only; the other kinds also recognise inflected forms (кнегу -> книга).

import type { Db } from './db.ts';
import {
	TYPO_MIN, deletes, editsApart, fromRussianLetters, fromWrongLayout, isCyrillic,
	looseLatin, nationalTranslit, plain, soundKey
} from './normalize.ts';
import { compareCodePoints, search, type SearchOptions, type SearchResult } from './search.ts';

export type GuessKind = 'layout' | 'respelled' | 'sound' | 'typo';
const GUESS: GuessKind[] = ['layout', 'respelled', 'sound', 'typo'];

export interface Suggestion extends Omit<SearchResult, 'match' | 'id' | 'vesum_only'> {
	id: number;
	/** How the guess was made. */
	match: GuessKind;
}

export interface SuggestOptions {
	limit?: number;
	/** Entry ids already shown as results. */
	exclude?: Set<number | null>;
	/** Set to false to leave out the least certain guesses. */
	typos?: boolean;
}

type IdRow = { entry_id: number };

export async function suggest(db: Db, query: string, options: SuggestOptions = {}): Promise<Suggestion[]> {
	const limit = options.limit ?? 5;
	const q = query.trim();
	if (!q) return [];

	const found = new Map<number, number>(); // entry id -> index into GUESS
	const add = (ids: number[], kind: number) => {
		for (const id of ids) {
			if (!options.exclude?.has(id) && !found.has(id)) found.set(id, kind);
		}
	};
	const keyed = async (key: string, kind: string) =>
		(await db.all<IdRow>('SELECT entry_id FROM search_keys WHERE key=? AND kind=?', [key, kind]))
			.map((r) => r.entry_id);
	const exact = async (key: string) =>
		(await db.all<IdRow>(
			"SELECT entry_id FROM search_keys WHERE key=? AND kind IN ('word','form')", [key]))
			.map((r) => r.entry_id);

	let latin: string;
	if (isCyrillic(q)) {
		const key = plain(q);
		const fixed = fromRussianLetters(key);
		if (fixed !== key) add(await exact(fixed), 1);
		latin = looseLatin(nationalTranslit(fixed));
	} else {
		add(await exact(plain(fromWrongLayout(q))), 0);
		latin = looseLatin(q);
	}

	if (latin) {
		add([...(await keyed(latin, 'latin')), ...(await keyed(latin, 'latin_form'))], 1);
		const sk = soundKey(latin);
		add([...(await keyed(sk, 'sound')), ...(await keyed(sk, 'sound_form'))], 2);
		if (options.typos !== false && sk.length >= TYPO_MIN) {
			const variants = JSON.stringify([...deletes(sk), sk]);
			const near = new Set<number>([
				...(await db.all<IdRow>(
					`SELECT entry_id FROM search_keys WHERE kind IN ('sound','typo')
					 AND key IN (SELECT value FROM json_each(?))`, [variants])).map((r) => r.entry_id),
				...(await keyed(sk, 'typo'))
			]);
			for (const id of found.keys()) near.delete(id);
			if (near.size) {
				const rows = await db.all<{ entry_id: number; key: string }>(
					`SELECT entry_id, key FROM search_keys WHERE kind='sound'
					 AND entry_id IN (SELECT value FROM json_each(?))`, [JSON.stringify([...near])]);
				const close = new Set(rows.filter((r) => editsApart(sk, r.key)).map((r) => r.entry_id));
				add([...close].sort((a, b) => a - b), 3);
			}
		}
	}
	if (found.size === 0) return [];

	const ids = JSON.stringify([...found.keys()]);
	const entries = await db.all<Record<string, any>>(
		`SELECT id, word, headword, pos, tags, head_forms, freq_rank FROM entries
		 WHERE id IN (SELECT value FROM json_each(?))`, [ids]);
	const glossRows = await db.all<{ entry_id: number; gloss: string }>(
		`SELECT entry_id, gloss FROM senses
		 WHERE entry_id IN (SELECT value FROM json_each(?)) ORDER BY entry_id, n`, [ids]);
	const glossesOf = new Map<number, string[]>();
	for (const { entry_id, gloss } of glossRows) {
		glossesOf.set(entry_id, [...(glossesOf.get(entry_id) ?? []), gloss]);
	}

	return entries
		.map((e) => ({
			kind: found.get(e.id)!,
			tie: (e.freq_rank as number | null) ?? 1e9,
			guess: {
				id: e.id, word: e.word, headword: e.headword, pos: e.pos,
				tags: JSON.parse(e.tags), head_forms: JSON.parse(e.head_forms),
				glosses: glossesOf.get(e.id) ?? [], freq_rank: e.freq_rank,
				match: GUESS[found.get(e.id)!]
			} as Suggestion
		}))
		.sort((a, b) =>
			a.kind - b.kind || a.tie - b.tie ||
			compareCodePoints(a.guess.word, b.guess.word) || a.guess.id - b.guess.id)
		.slice(0, limit)
		.map((r) => r.guess);
}

export interface LookupResult {
	query: string;
	results: SearchResult[];
	/** Guesses, filled only when no result is a sure match. */
	suggestions: Suggestion[];
}

const SURE = new Set(['word', 'form', 'latin', 'english', 'latin_form', 'latin_loose']);

/** What the search endpoint returns: results, plus guesses when no result is a sure match. */
export async function lookup(
	db: Db, query: string, options: SearchOptions & { suggestions?: number } = {}
): Promise<LookupResult> {
	const results = await search(db, query, options);
	const kinds = new Set<string>(results.map((r) => r.match));
	let suggestions: Suggestion[] = [];
	if (![...kinds].some((k) => SURE.has(k))) {
		// Nothing, or only loose matches ("kiev" is mentioned in a few meanings but
		// the user wants Київ). Typo guesses are the least certain, so they are
		// offered only when there is nothing better to show, and not for several
		// Latin words, where they would mostly be noise for English.
		const onlyPrefix = [...kinds].every((k) => k === 'prefix');
		const typos = onlyPrefix && (!query.trim().includes(' ') || isCyrillic(query));
		suggestions = await suggest(db, query, {
			limit: options.suggestions ?? 5,
			exclude: new Set(results.map((r) => r.id)),
			typos
		});
	}
	return { query, results, suggestions };
}
