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
//   8. prefix of a word, for search-as-you-type (entries made from translation
//      tables only when the others leave room)
// Within each step, more common words come first. An old word (every matched
// meaning archaic, obsolete or dated) comes after the modern words of its step,
// and an old exact English meaning after the English mentions; steps 1 to 3
// are left alone. A result found through a
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

// Sense tags that make a meaning old, mildest first. Not "historical":
// хрестоно́сець (crusader) is the modern word for a thing of the past, and the
// right answer.
const OLD = ['dated', 'archaic', 'obsolete'] as const;
export type OldLabel = (typeof OLD)[number];

/**
 * How old a word is by the meanings that matched: each meaning's strongest
 * tag, and of those the mildest, so the label never overstates. Undefined when
 * a meaning has no such tag. све́йський (archaic, obsolete) is "obsolete".
 */
function oldLabel(senses: { tags: string[] }[]): OldLabel | undefined {
	const strongest = senses.map((s) => Math.max(-1, ...s.tags.map((t) => OLD.indexOf(t as OldLabel))));
	if (!strongest.length || Math.min(...strongest) < 0) return undefined;
	return OLD[Math.min(...strongest)];
}

/**
 * What a word with no entry is, where VESUM says so; `distorted` (not standard
 * Ukrainian: таможня, криша) also where Nebokrai's own list says so.
 */
export type VesumKind = 'distorted' | 'given-name' | 'patronymic' | 'surname' | 'abbreviation';
// The likeliest first: Іванович is a patronymic far more often than the surname it also is,
// and таракан, typed in lower case, is the Russian word for тарган before it is anybody's surname.
const KINDS: VesumKind[] = ['distorted', 'given-name', 'patronymic', 'surname', 'abbreviation'];
const REFLEXIVE = ['ся', 'сь'];
/** Ukrainian words offered instead of a non-standard one, at most. */
const USE_MAX = 3;

/** A Ukrainian word offered instead of a non-standard one: при́суд for приговор. */
export interface UseInstead {
	/** The stressed headword where one entry has the spelling, else the plain spelling. */
	word: string;
	/** Whether it has an entry to link to (with `wordPath(word)`). */
	has_entry: boolean;
}

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
	/** утворюватися, for the entry утворювати; істори́чно, for істори́чний; криша, for дах */
	word: string;
	/** `nonstandard`: the word searched for is not standard Ukrainian, and this is what to say instead */
	kind: 'reflexive' | 'nonstandard' | HeadKind;
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
	 * Set when every meaning that matched is tagged dated, archaic or obsolete:
	 * the mildest of those meanings' strongest tags. све́йський is "obsolete".
	 */
	old?: OldLabel;
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
	 * The Ukrainian words to say instead of a non-standard word, at most three,
	 * Nebokrai's own first. On the entry that answers it (`through.kind` is
	 * `nonstandard`: дах for криша), this word included; on a VESUM-only result
	 * with `kind: 'distorted'` when none has an entry. May be empty there.
	 */
	use?: UseInstead[];
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
	const rows = await rowsOrNone<{ kind: string }>(vesum, 'SELECT kind FROM vesum_kinds WHERE lemma=?', [lemma]);
	const found = new Set(rows.map((row) => row.kind));
	return KINDS.find((kind) => found.has(kind));
}

/** The rows of a query on a table an older database may not have yet. */
async function rowsOrNone<T>(db: Db, sql: string, params: unknown[]): Promise<T[]> {
	try {
		return await db.all<T>(sql, params);
	} catch (err) {
		if (/no such table/i.test(String(err))) return [];
		throw err;
	}
}

/**
 * Nebokrai's own note on a spelling that is not standard Ukrainian
 * (data/nonstandard.tsv): its suggestions in order, [] when it lists none, or
 * null when the spelling is not listed.
 */
async function nonstandard(db: Db, word: string): Promise<string[] | null> {
	const rows = await rowsOrNone<{ n: number; use: string }>(
		db, 'SELECT n, use FROM nonstandard WHERE word=? ORDER BY n', [word]);
	return rows.length ? rows.filter((r) => r.n > 0).map((r) => r.use) : null;
}

/** A Ukrainian word to offer: the stressed headword where one entry has the spelling. */
async function offered(db: Db, word: string): Promise<UseInstead> {
	const rows = await db.all<{ headword: string }>(
		'SELECT e.headword FROM search_keys k JOIN entries e ON e.id = k.entry_id' +
		" WHERE k.key=? AND k.kind='word'", [word]);
	const heads = [...new Set(rows.map((r) => r.headword))];
	return { word: heads.length === 1 ? heads[0] : word, has_entry: heads.length > 0 };
}

/**
 * What to say instead of a non-standard word: Nebokrai's own suggestions in
 * their order, then VESUM's, those with an entry to link to before those
 * without; USE_MAX at most. криша -> дах, приговор -> присуд, вирок, осуд.
 * VESUM's order is kept otherwise: it is chosen, and the commonest word is
 * not always the right one (суд, "court", is commoner than вирок).
 */
async function useInstead(db: Db, vesum: Db | undefined, lemma: string, ours: string[]): Promise<UseInstead[]> {
	const theirs = vesum
		? (await rowsOrNone<{ use: string }>(vesum, 'SELECT use FROM vesum_suggest WHERE lemma=? ORDER BY n', [lemma]))
			.map((r) => r.use)
		: [];
	const mine = await Promise.all(ours.map((w) => offered(db, w)));
	const others = await Promise.all(theirs.filter((w) => !ours.includes(w)).map((w) => offered(db, w)));
	const found: UseInstead[] = [];
	const seen = new Set([lemma]);
	for (const o of [...mine, ...others.filter((o) => o.has_entry), ...others.filter((o) => !o.has_entry)]) {
		if (seen.has(o.word)) continue;
		seen.add(o.word);
		found.push(o);
	}
	return found.slice(0, USE_MAX);
}

/**
 * What to answer a word with no entry: the entry id and `use` when it is not
 * standard Ukrainian and one of the words to say instead has an entry, so
 * криша is answered with дах's own card (its most common entry, when the
 * spelling has several); else the bare result.
 */
async function instead(
	db: Db, vesum: Db | undefined, lemma: string, pos: string, ours: string[] | null
): Promise<{ stub: SearchResult } | { id: number; use: UseInstead[] }> {
	const stub = await stubFor(db, vesum, lemma, pos, ours);
	const first = stub.use?.find((u) => u.has_entry);
	if (!first) return { stub };
	const [row] = await db.all<{ entry_id: number }>(
		'SELECT k.entry_id FROM search_keys k JOIN entries e ON e.id = k.entry_id' +
		" WHERE k.key=? AND k.kind='word' ORDER BY e.freq_rank IS NULL, e.freq_rank, e.id LIMIT 1",
		[plain(first.word)]);
	return { id: row.entry_id, use: stub.use! };
}

/**
 * A result for a word that has no entry: only VESUM knows it, or it is in
 * Nebokrai's list of non-standard words (`ours` is not null).
 */
async function stubFor(
	db: Db, vesum: Db | undefined, lemma: string, pos: string, ours: string[] | null
): Promise<SearchResult> {
	const stub: SearchResult = {
		id: null, word: lemma, headword: lemma, pos, tags: [], head_forms: [],
		glosses: [], freq_rank: null, match: 'form', vesum_only: true
	};
	const kind = ours !== null ? 'distorted' : vesum ? await vesumKind(vesum, lemma) : undefined;
	if (kind) stub.kind = kind;
	if (kind === 'distorted') stub.use = await useInstead(db, vesum, lemma, ours ?? []);
	return stub;
}
const ENGLISH_FILLER = new Set(['to', 'a', 'an', 'the']);

/** The `source` of an entry made from translation tables (FROM_TRANSLATIONS in word.ts). */
const THIN = 'wiktionary-translations';

/**
 * The entries a word starting with the query may be, for search-as-you-type.
 *
 * The window is the first limit * 3 keys in alphabetical order; the common
 * words among them are sorted first afterwards. The entries made from
 * translation tables would crowd it (кал has more than a hundred words), and
 * they sort last anyway, so the window is filled from the others, and from
 * those only while the results are still short: шер finds шериф.
 */
async function prefixed(
	db: Db, kind: 'word' | 'latin', low: string, high: string, limit: number, hits: Map<number, number>
): Promise<KeyRow[]> {
	const sql = (op: string) =>
		'SELECT k.entry_id, k.kind FROM search_keys k JOIN entries e ON e.id = k.entry_id' +
		` WHERE k.kind=? AND k.key >= ? AND k.key < ? AND e.source ${op} ? ORDER BY k.key LIMIT ?`;
	const rows = await db.all<KeyRow>(sql('!='), [kind, low, high, THIN, limit * 3]);
	const found = new Set([...rows.map((row) => row.entry_id), ...hits.keys()]);
	if (found.size < limit) rows.push(...await db.all<KeyRow>(sql('='), [kind, low, high, THIN, limit * 3]));
	return rows;
}

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
	// entry id -> the Ukrainian words offered, when it answers a non-standard word
	const useOf = new Map<number, UseInstead[]>();
	/** A word with no entry: the Ukrainian word's entry, or a bare result. */
	const answer = async (lemma: string, pos: string, ours: string[] | null) => {
		const found = await instead(db, options.vesum, lemma, pos, ours);
		if ('stub' in found) {
			stubs.push(found.stub);
			return;
		}
		add([{ entry_id: found.id, kind: 'form' }]);
		if (!through.has(found.id)) through.set(found.id, { word: lemma, kind: 'nonstandard' });
		if (!useOf.has(found.id)) useOf.set(found.id, found.use);
	};

	const cyrillic = isCyrillic(q);
	// The query as it is looked up, which also tells which form of a word it is.
	const key = cyrillic ? plain(q) : looseLatin(q);

	if (cyrillic) {
		// A head-line word has a key only where no entry or form of Wiktionary's
		// own has the spelling, so it adds to the others only beside an entry
		// made from translation tables: походити is one, and ходити names it.
		add(await db.all<KeyRow>(
			"SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('word','form','head')", [key]));
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
				await answer(lemma, pos, await nonstandard(db, lemma));
			}
		}
		// криша without vesum.db, or бебісіттер, which VESUM does not know:
		// Nebokrai's own list still says what to write instead.
		if (hits.size === 0 && stubs.length === 0) {
			const ours = await nonstandard(db, key);
			if (ours !== null) await answer(key, '', ours);
		}
		if (hits.size < limit) add(await prefixed(db, 'word', key, key + '￿', limit, hits), RANK.prefix);
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
			add(await prefixed(db, 'latin', key, key + '{', limit, hits), RANK.prefix);
		}
	}

	// Load every matched entry and its meanings in two queries. The ids travel as
	// one JSON parameter, because D1 allows only 100 bound parameters per query.
	const ids = JSON.stringify([...hits.keys()]);
	const entries = hits.size === 0 ? [] : await db.all<EntryRow>(
		`SELECT id, word, headword, pos, tags, head_forms, freq_rank FROM entries
		 WHERE id IN (SELECT value FROM json_each(?))`, [ids]);
	const senseRows = hits.size === 0 ? [] : await db.all<{ entry_id: number; gloss: string; tags: string }>(
		`SELECT entry_id, gloss, tags FROM senses
		 WHERE entry_id IN (SELECT value FROM json_each(?)) ORDER BY entry_id, n`, [ids]);
	const sensesOf = new Map<number, { gloss: string; tags: string[] }[]>();
	for (const { entry_id, gloss, tags } of senseRows) {
		const sense = { gloss, tags: JSON.parse(tags) as string[] };
		const list = sensesOf.get(entry_id);
		if (list) list.push(sense);
		else sensesOf.set(entry_id, [sense]);
	}

	const lower = q.toLowerCase();
	const ranked = entries.map((e) => {
		let rank = hits.get(e.id)!;
		const senses = sensesOf.get(e.id) ?? [];
		const glosses = senses.map((s) => s.gloss);
		let matched = senses;
		if (rank === RANK.english) {
			// A word whose meaning *is* the query ("mother") beats one that merely
			// mentions it ("mother-in-law"). Case is ignored: "English" is the
			// meaning of англійський, and the query arrives lowercased.
			matched = senses.filter((s) =>
				s.gloss.replace(/\(.*?\)/g, '').split(/[,;]/).some((part) => part.trim().toLowerCase() === lower));
			if (!matched.length) {
				matched = senses;
				rank = RANK.english_mention;
			}
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
			const use = useOf.get(e.id);
			if (use) result.use = use;
		}
		if (rank === RANK.head) result.through = headThrough(result.head_forms, key);
		// An old word goes after the modern ones. The commonness count is of
		// spellings, so an old homograph borrows its rank: світ "light" (archaic)
		// has the count of світ "world", ум (dated) that of the Russian word.
		// Steps 1 to 3 keep their place: whoever types свейський means that word.
		const label = oldLabel(matched);
		if (label) result.old = label;
		const old = label !== undefined && rank > RANK.latin;
		const place = old && rank === RANK.english ? RANK.english_mention : rank;
		return { rank, place, old: old ? 1 : 0, tie: e.freq_rank ?? UNRANKED, result };
	});
	ranked.sort((a, b) =>
		a.place - b.place || a.old - b.old || a.tie - b.tie ||
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
