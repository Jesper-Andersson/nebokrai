// Dictionary search. This is a port of data/search.py, which stays the reference:
// tests/search.test.ts checks that both return the same results.
//
// How a query is matched, best first:
//   1. exact dictionary word                      калина -> калина
//   2. an inflected form                          книги  -> книга
//   3. Latin letters, spelled the standard way    kalyna -> калина
//   4. English meaning that is exactly the query  good   -> добрий
//   5. Latin letters, loosely spelled             kalina -> калина
//   6. English meaning that mentions the query    good   -> добро ("good deed")
//   7. prefix of a word, for search-as-you-type
// Within each step, more common words come first.

import type { Db } from './db.ts';
import { isCyrillic, looseLatin, nationalTranslit, plain } from './normalize.ts';

export type MatchKind =
	| 'word' | 'form' | 'latin' | 'english' | 'latin_loose' | 'english_mention' | 'prefix';

const RANK: Record<MatchKind, number> = {
	word: 0, form: 1, latin: 2, english: 3, latin_loose: 4, english_mention: 5, prefix: 6
};
const KIND = Object.keys(RANK) as MatchKind[];

export interface HeadForm {
	form: string;
	tags: string[];
}

export interface SearchResult {
	/** Entry id, or null for a word that only VESUM knows. */
	id: number | null;
	/** Plain spelling: калина */
	word: string;
	/** With the stress mark: кали́на */
	headword: string;
	pos: string;
	tags: string[];
	head_forms: HeadForm[];
	glosses: string[];
	/** 1 = most common word. null when the word is too rare to rank. */
	freq_rank: number | null;
	/** Why this entry matched the query. */
	match: MatchKind;
	/** True when there is no dictionary entry, only a known spelling. */
	vesum_only?: true;
}

export interface SearchOptions {
	limit?: number;
	/** The separate VESUM database. Leave out to search Wiktionary data only. */
	vesum?: Db;
}

type KeyRow = { entry_id: number; kind: MatchKind };
type EntryRow = {
	id: number; word: string; headword: string; pos: string;
	tags: string; head_forms: string; freq_rank: number | null;
};

const UNRANKED = 1e9;
const ENGLISH_FILLER = new Set(['to', 'a', 'an', 'the']);

export async function search(db: Db, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
	const limit = options.limit ?? 20;
	const q = query.trim();
	if (!q) return [];

	const hits = new Map<number, number>(); // entry id -> best rank
	const add = (rows: KeyRow[], rank?: number) => {
		for (const row of rows) {
			const r = rank ?? RANK[row.kind];
			const old = hits.get(row.entry_id);
			if (old === undefined || r < old) hits.set(row.entry_id, r);
		}
	};

	const stubs: SearchResult[] = []; // words only VESUM knows

	if (isCyrillic(q)) {
		const key = plain(q);
		add(await db.all<KeyRow>(
			"SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('word','form')", [key]));
		if (hits.size === 0 && options.vesum) {
			const lemmas = await options.vesum.all<{ lemma: string; pos: string }>(
				'SELECT DISTINCT lemma, pos FROM vesum_forms WHERE form=? ORDER BY lemma, pos', [key]);
			for (const { lemma, pos } of lemmas) {
				const found = await db.all<KeyRow>(
					"SELECT entry_id, 'form' AS kind FROM search_keys WHERE key=? AND kind='word'", [lemma]);
				if (found.length) add(found);
				else stubs.push({
					id: null, word: lemma, headword: lemma, pos, tags: [], head_forms: [],
					glosses: [], freq_rank: null, match: 'form', vesum_only: true
				});
			}
		}
		if (hits.size < limit) {
			add(await db.all<KeyRow>(
				"SELECT entry_id, kind FROM search_keys WHERE kind='word' AND key >= ? AND key < ? ORDER BY key LIMIT ?",
				[key, key + '￿', limit * 3]), RANK.prefix);
		}
	} else {
		const words = q.toLowerCase().match(/[a-z]+(?:[-'][a-z]+)*/g) ?? [];
		const key = looseLatin(q);
		const oneWord = !q.includes(' ');
		if (key && oneWord) {
			add(await db.all<KeyRow>(
				"SELECT entry_id, kind FROM search_keys WHERE key=? AND kind='latin'", [key]));
		}
		// English: every word of the query must appear in the entry's meanings.
		const meaningful = words.filter((w) => !ENGLISH_FILLER.has(w));
		const content = meaningful.length ? meaningful : words;
		let common: number[] | null = null;
		for (const w of content) {
			const rows = await db.all<{ entry_id: number }>(
				"SELECT entry_id FROM search_keys WHERE key=? AND kind='english'", [w]);
			const ids = new Set(rows.map((r) => r.entry_id));
			common = common === null ? [...ids] : common.filter((id: number) => ids.has(id));
		}
		if (common) add(common.map((entry_id: number) => ({ entry_id, kind: 'english' as const })));
		if (hits.size < limit && key && oneWord && key.length >= 3) {
			add(await db.all<KeyRow>(
				"SELECT entry_id, kind FROM search_keys WHERE kind='latin' AND key >= ? AND key < ? ORDER BY key LIMIT ?",
				[key, key + '{', limit * 3]), RANK.prefix);
		}
	}

	// Load every matched entry and its meanings in two queries. The ids travel as
	// one JSON parameter, because D1 allows only 100 bound parameters per query.
	const ids = JSON.stringify([...hits.keys()]);
	const entries = hits.size === 0 ? [] : await db.all<EntryRow>(
		`SELECT id, word, headword, pos, tags, head_forms, freq_rank FROM entries
		 WHERE id IN (SELECT value FROM json_each(?))`, [ids]);
	const glossRows = hits.size === 0 ? [] : await db.all<{ entry_id: number; gloss: string }>(
		`SELECT entry_id, gloss FROM senses
		 WHERE entry_id IN (SELECT value FROM json_each(?)) ORDER BY entry_id, n`, [ids]);
	const glossesOf = new Map<number, string[]>();
	for (const { entry_id, gloss } of glossRows) {
		const list = glossesOf.get(entry_id);
		if (list) list.push(gloss);
		else glossesOf.set(entry_id, [gloss]);
	}

	const lower = q.toLowerCase();
	const ranked = entries.map((e) => {
		let rank = hits.get(e.id)!;
		const glosses = glossesOf.get(e.id) ?? [];
		if (rank === RANK.english) {
			// A word whose meaning *is* the query ("mother") beats one that merely
			// mentions it ("mother-in-law").
			const exact = glosses.some((g) =>
				g.replace(/\(.*?\)/g, '').split(/[,;]/).some((part) => part.trim() === lower));
			if (!exact) rank = RANK.english_mention;
		} else if (rank === RANK.latin && nationalTranslit(e.word) !== lower) {
			// "good" loosely matches год ("hod"), but the user most likely means English.
			rank = RANK.latin_loose;
		}
		const result: SearchResult = {
			id: e.id, word: e.word, headword: e.headword, pos: e.pos,
			tags: JSON.parse(e.tags), head_forms: JSON.parse(e.head_forms),
			glosses, freq_rank: e.freq_rank, match: KIND[rank]
		};
		return { rank, tie: e.freq_rank ?? UNRANKED, result };
	});
	ranked.sort((a, b) =>
		a.rank - b.rank || a.tie - b.tie ||
		compareCodePoints(a.result.word, b.result.word) || a.result.id! - b.result.id!);

	const exact = ranked.filter((r) => r.rank <= RANK.form).map((r) => r.result);
	const rest = ranked.filter((r) => r.rank > RANK.form).map((r) => r.result);
	return [...exact, ...stubs, ...rest].slice(0, limit);
}

/** Order strings the way Python does, so both searches break ties identically. */
function compareCodePoints(a: string, b: string): number {
	const x = [...a], y = [...b];
	for (let i = 0; i < Math.min(x.length, y.length); i++) {
		const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
		if (d) return d;
	}
	return x.length - y.length;
}
