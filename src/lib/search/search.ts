// Dictionary search. This is a port of data/search.py, which stays the reference:
// tests/search.test.ts checks that both return the same results.
//
// How a query is matched, best first:
//   1. exact dictionary word                      калина -> калина
//   2. an inflected form                          книги  -> книга
//      a word on another entry's head line        історично -> історичний
//   3. Latin letters, spelled the standard way    kalyna -> калина
//   4. English meaning that is exactly the query  good   -> добрий
//   5. an inflected form in Latin letters         knyhy  -> книга
//   6. Latin letters, loosely spelled             kalina -> калина
//   7. English meaning that mentions the query    good   -> добро ("good deed")
//   8. prefix of a word, for search-as-you-type
// Within each step, more common words come first. A result found through a
// form (steps 2 and 5) says which form in `matched_forms`; one found through
// a head-line word says how in `through`.

import type { Db } from './db.ts';
import { isCyrillic, looseLatin, nationalTranslit, plain } from './normalize.ts';

export type MatchKind =
	| 'word' | 'form' | 'head' | 'latin' | 'english' | 'latin_form' | 'latin_loose' | 'english_mention' | 'prefix';

const RANK: Record<MatchKind, number> = {
	word: 0, form: 1, head: 2, latin: 3, english: 4, latin_form: 5, latin_loose: 6, english_mention: 7, prefix: 8
};
const KIND = Object.keys(RANK) as MatchKind[];

/** What VESUM says a word with no entry is. */
export type VesumKind = 'given-name' | 'patronymic' | 'surname' | 'abbreviation';
// The likeliest first: Іванович is a patronymic far more often than the surname it also is.
const KINDS: VesumKind[] = ['given-name', 'patronymic', 'surname', 'abbreviation'];
const REFLEXIVE = ['ся', 'сь'];

/**
 * What a head-line word is to the entry that lists it, from Wiktionary's tags,
 * the first that applies. A word tagged with none of these (a genitive the
 * table lacks) is simply one of its forms.
 */
export const HEAD_KINDS = [
	'alternative', 'adverb', 'adjective', 'abstract-noun', 'perfective', 'imperfective',
	'feminine', 'diminutive', 'augmentative', 'comparative', 'superlative'
] as const;
export type HeadKind = (typeof HEAD_KINDS)[number] | 'form';

/** The word that led to an entry without being one of its forms. */
export interface Through {
	/** утворюватися, for the entry утворювати; істори́чно, for істори́чний */
	word: string;
	kind: 'reflexive' | HeadKind;
}

export interface HeadForm {
	form: string;
	tags: string[];
}

/** `through` for an entry found by a head-line word: the word as the head line writes it and what it is. */
function headThrough(headForms: HeadForm[], key: string): Through | undefined {
	for (const f of headForms) {
		if (plain(f.form) !== key) continue;
		return { word: f.form, kind: HEAD_KINDS.find((k) => f.tags.includes(k)) ?? 'form' };
	}
	return undefined;
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
	/**
	 * The forms of the word that the query spells, when `match` is `form` or
	 * `latin_form`: книги is кни́ги, genitive singular and nominative plural.
	 * Empty when only VESUM knew the form; absent on VESUM-only results.
	 */
	matched_forms?: HeadForm[];
	/** True when there is no dictionary entry, only a known spelling. */
	vesum_only?: true;
	/** On a VESUM-only result, what the word is, when VESUM says: a surname, an abbreviation. */
	kind?: VesumKind;
	/**
	 * Set when the query is a reflexive verb with no entry and this is the verb
	 * it is made from: утворюватися leads to утворювати. `match` is `form` and
	 * `matched_forms` is empty. Also set when the query is a word this entry
	 * lists on its head line (`match` is `head`), or one of that word's forms
	 * found through VESUM (`match` is `form`): історично is the adverb of істори́чний.
	 */
	through?: Through;
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

/**
 * 'surname' for шевченко, or undefined. A vesum.db built before kinds were
 * stored has no such table, and then no word has a kind.
 */
async function vesumKind(vesum: Db, lemma: string): Promise<VesumKind | undefined> {
	let rows: { kind: string }[];
	try {
		rows = await vesum.all<{ kind: string }>('SELECT kind FROM vesum_kinds WHERE lemma=?', [lemma]);
	} catch (err) {
		if (/no such table/i.test(String(err))) return undefined;
		throw err;
	}
	const found = new Set(rows.map((row) => row.kind));
	return KINDS.find((kind) => found.has(kind));
}
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
	// entry id -> the word that led to it; kind 'head' until the entry's head line says what it is
	const through = new Map<number, { word: string; kind: Through['kind'] | 'head' }>();

	const cyrillic = isCyrillic(q);
	// The query as it is looked up, which also tells which form of a word it is.
	const key = cyrillic ? plain(q) : looseLatin(q);

	if (cyrillic) {
		add(await db.all<KeyRow>(
			"SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('word','form')", [key]));
		if (hits.size === 0) {
			// A head-line word has a key only where no entry or form has the
			// spelling, so this finds nothing the line above could.
			add(await db.all<KeyRow>(
				"SELECT entry_id, kind FROM search_keys WHERE key=? AND kind='head'", [key]));
		}
		if (hits.size === 0 && options.vesum) {
			const lemmas = await options.vesum.all<{ lemma: string; pos: string }>(
				'SELECT DISTINCT lemma, pos FROM vesum_forms WHERE form=? ORDER BY lemma, pos', [key]);
			for (const { lemma, pos } of lemmas) {
				const found = await db.all<KeyRow>(
					"SELECT entry_id, 'form' AS kind FROM search_keys WHERE key=? AND kind='word'", [lemma]);
				if (found.length) {
					add(found);
					continue;
				}
				// мінеральних is a form of мінеральний, which мінера́л lists on its head line
				const listed = await db.all<KeyRow>(
					"SELECT entry_id, 'form' AS kind FROM search_keys WHERE key=? AND kind='head'", [lemma]);
				if (listed.length) {
					add(listed);
					for (const row of listed) {
						if (!through.has(row.entry_id)) through.set(row.entry_id, { word: lemma, kind: 'head' });
					}
					continue;
				}
				// утворюватися has no entry, утворювати has: the reflexive verb
				// leads to the verb it is made from, and the result says so.
				if (pos === 'verb' && REFLEXIVE.some((end) => lemma.endsWith(end))) {
					const base = await db.all<KeyRow>(
						"SELECT k.entry_id, 'form' AS kind FROM search_keys k JOIN entries e ON e.id = k.entry_id" +
						" WHERE k.key=? AND k.kind='word' AND e.pos='verb'", [lemma.slice(0, -2)]);
					if (base.length) {
						add(base);
						for (const row of base) {
							if (!through.has(row.entry_id)) through.set(row.entry_id, { word: lemma, kind: 'reflexive' });
						}
						continue;
					}
				}
				const stub: SearchResult = {
					id: null, word: lemma, headword: lemma, pos, tags: [], head_forms: [],
					glosses: [], freq_rank: null, match: 'form', vesum_only: true
				};
				const kind = await vesumKind(options.vesum, lemma);
				if (kind) stub.kind = kind;
				stubs.push(stub);
			}
		}
		if (hits.size < limit) {
			add(await db.all<KeyRow>(
				"SELECT entry_id, kind FROM search_keys WHERE kind='word' AND key >= ? AND key < ? ORDER BY key LIMIT ?",
				[key, key + '￿', limit * 3]), RANK.prefix);
		}
	} else {
		const words = q.toLowerCase().match(/[a-z]+(?:[-'][a-z]+)*/g) ?? [];
		const oneWord = !q.includes(' ');
		if (key && oneWord) {
			add(await db.all<KeyRow>(
				"SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('latin','latin_form')", [key]));
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
		const led = through.get(e.id);
		if (led && rank === RANK.form) {
			result.through = led.kind === 'head' ? headThrough(result.head_forms, led.word) : { word: led.word, kind: led.kind };
		}
		if (rank === RANK.head) result.through = headThrough(result.head_forms, key);
		return { rank, tie: e.freq_rank ?? UNRANKED, result };
	});
	ranked.sort((a, b) =>
		a.rank - b.rank || a.tie - b.tie ||
		compareCodePoints(a.result.word, b.result.word) || a.result.id! - b.result.id!);

	// Which form of the word the query is, for results found through a form.
	const viaForm = ranked.filter((r) => r.rank === RANK.form || r.rank === RANK.latin_form);
	if (viaForm.length) {
		const matched = await matchedForms(db, viaForm.map((r) => r.result.id!), key, cyrillic);
		for (const { result } of viaForm) result.matched_forms = matched.get(result.id!) ?? [];
	}

	const exact = ranked.filter((r) => r.rank <= RANK.head).map((r) => r.result);
	const rest = ranked.filter((r) => r.rank > RANK.head).map((r) => r.result);
	return [...exact, ...stubs, ...rest].slice(0, limit);
}

/**
 * The forms of each entry in `ids` that the query spells, in the order of the
 * entry's table. "руки" is руки́ (genitive singular) and also ру́ки (nominative,
 * accusative and vocative plural), so there can be several, stressed
 * differently. `key` is the query as search() looked it up: plain() of a
 * Cyrillic query, or looseLatin() of a Latin one ("ruky"). An entry found
 * through VESUM gets no forms: VESUM knows the dictionary word but not which
 * form it is.
 */
async function matchedForms(
	db: Db, ids: number[], key: string, cyrillic: boolean
): Promise<Map<number, HeadForm[]>> {
	const rows = await db.all<{ entry_id: number; form: string; plain: string; tags: string }>(
		`SELECT entry_id, form, plain, tags FROM forms
		 WHERE entry_id IN (SELECT value FROM json_each(?)) ORDER BY id`, [JSON.stringify(ids)]);
	const found = new Map<number, HeadForm[]>();
	const seen = new Set<string>();
	for (const row of rows) {
		if ((cyrillic ? row.plain : looseLatin(nationalTranslit(row.plain))) !== key) continue;
		const once = `${row.entry_id} ${row.form} ${row.tags}`;
		if (seen.has(once)) continue;
		seen.add(once);
		const list = found.get(row.entry_id) ?? [];
		list.push({ form: row.form, tags: JSON.parse(row.tags) });
		found.set(row.entry_id, list);
	}
	return found;
}

/** Order strings the way Python does, so both searches break ties identically. */
export function compareCodePoints(a: string, b: string): number {
	const x = [...a], y = [...b];
	for (let i = 0; i < Math.min(x.length, y.length); i++) {
		const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
		if (d) return d;
	}
	return x.length - y.length;
}
