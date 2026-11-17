// Everything the Details page needs for one spelling. A spelling can have
// several entries (стан is a noun five times over), so the answer is a list.

import type { Db } from './db.ts';
import type { HeadForm } from './search.ts';
import { looseLatin, plain } from './normalize.ts';
import { wordSlug } from './slug.ts';
import { recallOf, type FormRow, type Recall } from '../review/recall.ts';

export interface Sense {
	n: number;
	gloss: string;
	tags: string[];
	/** Usage examples quoted in Wiktionary for this meaning. Often empty. */
	examples: { text: string; english: string | null }[];
}

/** A key form beside the headword, as the Details page gets it. */
export interface WordHeadForm extends HeadForm {
	/**
	 * True when the form is spelled like a dictionary word other than this one:
	 * the aspect partner прочитати of читати has a page of its own, the
	 * genitive книги of книга does not.
	 */
	has_entry: boolean;
}

export type RelationKind = 'synonym' | 'antonym' | 'derived' | 'related';

/** Another word that an entry names. */
export interface Relation {
	kind: RelationKind;
	/** The meaning it belongs to (`Sense.n`), or null for the entry as a whole. */
	sense_n: number | null;
	/** The other word, with its stress where it is known: мали́й */
	word: string;
	/** Remarks on it: ["colloquial"], ["feminine"]. Often empty. */
	tags: string[];
	/** True when the dictionary has that word: link to it with `wordPath(word)`. */
	has_entry: boolean;
}

export interface WordEntry {
	id: number;
	word: string;
	headword: string;
	pos: string;
	tags: string[];
	head_forms: WordHeadForm[];
	roman: string | null;
	ipa: string | null;
	audio_url: string | null;
	etymology: string | null;
	freq_rank: number | null;
	/** Where the entry is from: Wiktionary, or written for Nebokrai (the abbreviations км, англ.). */
	source: EntrySource;
	/** A slur or a highly offensive word the page warns about (data/marked-offensive.tsv): хохол. */
	offensive: boolean;
	senses: Sense[];
	/** The declension or conjugation table, one row per cell. Empty if there is none. */
	forms: { form: string; tags: string[] }[];
	/** Tatoeba sentences that use the word, up to three. */
	examples: TatoebaSentence[];
	/** Synonyms, antonyms, derived and related words, in Wiktionary's order. Empty if it names none. */
	relations: Relation[];
}

type RelationRow = { sense_n: number | null; kind: RelationKind; word: string; plain: string; tags: string };

/** The rows of `relations` for one entry. */
async function relationRows(db: Db, entryId: number): Promise<RelationRow[]> {
	try {
		return await db.all<RelationRow>(
			'SELECT sense_n, kind, word, plain, tags FROM relations WHERE entry_id=? ORDER BY id', [entryId]);
	} catch (err) {
		// A database built before related words were stored has no such table.
		// The page then shows none, so the code and the data need not be
		// published in the same moment.
		if (/no such table/i.test(String(err))) return [];
		throw err;
	}
}

/** Which of `spellings` (as `plain()` writes them) are dictionary words. */
async function knownWords(db: Db, spellings: string[]): Promise<Set<string>> {
	if (!spellings.length) return new Set();
	// One JSON parameter for the whole list: D1 binds at most 100.
	const rows = await db.all<{ key: string }>(
		`SELECT DISTINCT key FROM search_keys
		 WHERE kind = 'word' AND key IN (SELECT value FROM json_each(?))`,
		[JSON.stringify([...new Set(spellings)])]);
	return new Set(rows.map((r) => r.key));
}

/**
 * A sentence from Tatoeba. `adapted` when a correction changed it: a
 * hand-written one in data/tatoeba-corrections.tsv (Він пише на правильній
 * англійській became Він пише правильною англійською) or a checked one that
 * fills a gap (data/sentence-fixes.tsv: нашомі became нашому). Its credit then
 * says so, as CC BY 2.0 FR asks. `original` is Tatoeba's Ukrainian when the
 * correction changed it, else null; the word page shows it behind the mark.
 */
export type TatoebaSentence = { uk: string; en: string; tatoeba_id: number; adapted: boolean; original: string | null };

/**
 * Where an entry is from: a Wiktionary page of its own; Nebokrai's own entries
 * (the abbreviations км, англ.); or the translation tables of English
 * Wiktionary pages, for a word with no page of its own (шериф, under
 * "sheriff"). The last are thin: no forms, no etymology, no frequency rank.
 */
export type EntrySource = 'wiktionary' | 'nebokrai' | 'wiktionary-translations';

/** The `source` of an entry made from translation tables; FROM_TRANSLATIONS in import_wiktionary.py. */
export const FROM_TRANSLATIONS = 'wiktionary-translations';

/**
 * Runs `query(column)`, and again with `fallback` in its place when the
 * database was built before that column was added. The code and the data then
 * need not be published in the same moment.
 */
async function withColumn<T>(column: string, fallback: string, query: (column: string) => Promise<T>): Promise<T> {
	try {
		return await query(column);
	} catch (err) {
		if (!/no such column/i.test(String(err))) throw err;
		return query(fallback);
	}
}

/** With the entries' `source` column; every entry was Wiktionary's before it was added. */
const withSource = <T>(query: (column: string) => Promise<T>) =>
	withColumn('source', "'wiktionary' AS source", query);

/**
 * With `<table>.adapted` from `examples` or `cloze`, named `table`; nothing
 * was adapted before 2026-11-16, when the column was added.
 */
export const withAdapted = <T>(table: string, query: (column: string) => Promise<T>) =>
	withColumn(`${table}.adapted AS adapted`, '0 AS adapted', query);

/**
 * With `examples.adapted` and `examples.original`; a database built before
 * `original` was added (November 2026) gives null, and the page then shows
 * the plain mark without Tatoeba's text.
 */
const withExampleColumns = <T>(query: (columns: string) => Promise<T>) =>
	withAdapted('examples', (adapted) =>
		withColumn('examples.original AS original', 'NULL AS original', (original) => query(`${adapted}, ${original}`)));

/** Where one entry is from; 'wiktionary' when there is no such entry. */
export async function entrySource(db: Db, id: number): Promise<EntrySource> {
	const rows = await withSource((column) =>
		db.all<{ source: EntrySource }>(`SELECT ${column} FROM entries WHERE id = ?`, [id]));
	return rows[0]?.source ?? 'wiktionary';
}

/** With `entries.offensive`; a database built before 2026-11-17 marks nothing. */
const withOffensive = <T>(query: (column: string) => Promise<T>) =>
	withColumn('offensive', 'NULL AS offensive', query);

export async function wordDetails(db: Db, word: string): Promise<WordEntry[]> {
	const rows = await withSource((source) => withOffensive((offensive) => db.all<Record<string, any>>(
		`SELECT id, word, headword, pos, tags, head_forms, roman, ipa, audio_url, etymology, freq_rank, ${source},
		        ${offensive}
		 FROM entries WHERE id IN (SELECT entry_id FROM search_keys WHERE key = ? AND kind = 'word')
		 ORDER BY freq_rank IS NULL, freq_rank, id`, [plain(word)])));
	const loaded = [];
	for (const r of rows) {
		const [senses, forms, examples, relations] = await Promise.all([
			db.all<Record<string, any>>(
				'SELECT n, gloss, tags, examples FROM senses WHERE entry_id=? ORDER BY n', [r.id]),
			db.all<Record<string, any>>('SELECT form, tags FROM forms WHERE entry_id=? ORDER BY id', [r.id]),
			withExampleColumns((columns) => db.all<TatoebaSentence>(
				`SELECT uk, en, tatoeba_id, ${columns} FROM examples WHERE entry_id=? ORDER BY id`, [r.id])),
			relationRows(db, r.id)
		]);
		loaded.push({ r, senses, forms, examples, relations, headForms: JSON.parse(r.head_forms) as HeadForm[] });
	}

	// Which of the words these entries point at have a page of their own: one
	// question for the whole page.
	const known = await knownWords(db, loaded.flatMap((e) =>
		[...e.relations.map((x) => x.plain), ...e.headForms.map((f) => plain(f.form))]));

	return loaded.map(({ r, senses, forms, examples, relations, headForms }): WordEntry => ({
		id: r.id, word: r.word, headword: r.headword, pos: r.pos,
		tags: JSON.parse(r.tags),
		head_forms: headForms.map((f) => {
			const spelling = plain(f.form);
			return { ...f, has_entry: spelling !== plain(r.word) && known.has(spelling) };
		}),
		roman: r.roman, ipa: r.ipa, audio_url: r.audio_url, etymology: r.etymology,
		freq_rank: r.freq_rank,
		source: r.source,
		offensive: r.offensive === 1,
		senses: senses.map((s) => ({
			n: s.n, gloss: s.gloss, tags: JSON.parse(s.tags), examples: JSON.parse(s.examples)
		})),
		forms: forms.map((f) => ({ form: f.form, tags: JSON.parse(f.tags) })),
		examples: examples.map((x) => ({ ...x, adapted: Boolean(x.adapted) })),
		relations: relations.map((x) => ({
			kind: x.kind, sense_n: x.sense_n, word: x.word, tags: JSON.parse(x.tags), has_entry: known.has(x.plain)
		}))
	}));
}

/** What a list of words (the Saved page) shows for one word. */
export interface WordSummary {
	word: string;
	headword: string;
	/** noun, verb, adj, … */
	pos: string;
	/** The first meanings, at most three. */
	glosses: string[];
}

/**
 * A short summary for each of `words` (the `word` field of an entry, exact
 * spelling), in the order given. Words with no entry are left out. A spelling
 * with several entries (стан) is summarised by its most common one.
 */
export async function wordSummaries(db: Db, words: string[]): Promise<WordSummary[]> {
	const best = await bestEntries(db, words);
	return words.flatMap((w) => {
		const found = best.get(w);
		return found
			? [{ word: found.word, headword: found.headword, pos: found.pos, glosses: found.glosses }]
			: [];
	});
}

/** What a flashcard made from a saved word holds (src/lib/export.ts). */
export interface WordCard extends WordSummary {
	pos: string;
	tags: string[];
	ipa: string | null;
	/** A recording of the word on Wikimedia Commons, where there is one. The review page plays it; no export uses it. */
	audio_url: string | null;
	/** The first Tatoeba sentence that uses the word, if there is one. */
	example: TatoebaSentence | null;
	/** Asked for by the review page alone: what typing the word needs (review/recall.ts). */
	recall?: Recall;
}

/**
 * A card for each of `words`, chosen and ordered as `wordSummaries` does: the
 * two share `bestEntries`, so a list and its export never show different
 * entries for one spelling. With `recall`, each card also carries its forms
 * and where its sentence has the word, for typing it on /review; the exports
 * do without, as they would only carry them.
 */
export async function wordCards(db: Db, words: string[], options: { recall?: boolean } = {}): Promise<WordCard[]> {
	const best = await bestEntries(db, words);
	const ids = JSON.stringify([...best.values()].map((e) => e.id));
	const examples = new Map<number, NonNullable<WordCard['example']>>();
	const forms = new Map<number, FormRow[]>();
	if (best.size) {
		const rows = await withExampleColumns((columns) => db.all<TatoebaSentence & { entry_id: number }>(
			`SELECT entry_id, uk, en, tatoeba_id, ${columns} FROM examples WHERE id IN (
			   SELECT MIN(id) FROM examples WHERE entry_id IN (SELECT value FROM json_each(?)) GROUP BY entry_id)`,
			[ids]));
		for (const { entry_id, ...example } of rows) examples.set(entry_id, { ...example, adapted: Boolean(example.adapted) });
	}
	if (best.size && options.recall) {
		const rows = await db.all<{ entry_id: number; form: string; plain: string; tags: string }>(
			'SELECT entry_id, form, plain, tags FROM forms WHERE entry_id IN (SELECT value FROM json_each(?)) ORDER BY id',
			[ids]);
		for (const { entry_id, tags, ...row } of rows) {
			const list = forms.get(entry_id) ?? [];
			list.push({ ...row, tags: JSON.parse(tags) });
			forms.set(entry_id, list);
		}
	}
	return words.flatMap((w) => {
		const found = best.get(w);
		if (!found) return [];
		const example = examples.get(found.id) ?? null;
		const card: WordCard = {
			word: found.word, headword: found.headword, glosses: found.glosses,
			pos: found.pos, tags: JSON.parse(found.tags), ipa: found.ipa, audio_url: found.audio_url,
			example
		};
		if (options.recall) card.recall = recallOf(found.word, found.headword, example?.uk ?? null, forms.get(found.id) ?? []);
		return [card];
	});
}

interface BestEntry {
	id: number;
	word: string;
	headword: string;
	pos: string;
	/** A JSON list, as stored. */
	tags: string;
	ipa: string | null;
	audio_url: string | null;
	glosses: string[];
}

/** The most common entry for each spelling in `words`, with its first three meanings. */
async function bestEntries(db: Db, words: string[]): Promise<Map<string, BestEntry>> {
	const best = new Map<string, BestEntry>();
	if (!words.length) return best;
	// One JSON parameter for the whole list: D1 binds at most 100.
	const rows = await db.all<Omit<BestEntry, 'glosses'>>(
		`SELECT id, word, headword, pos, tags, ipa, audio_url FROM entries WHERE word IN (SELECT value FROM json_each(?))
		 ORDER BY freq_rank IS NULL, freq_rank, id`, [JSON.stringify(words)]);
	for (const r of rows) if (!best.has(r.word)) best.set(r.word, { ...r, glosses: [] });
	const byId = new Map([...best.values()].map((s) => [s.id, s]));
	const senses = await db.all<{ entry_id: number; gloss: string }>(
		`SELECT entry_id, gloss FROM senses WHERE entry_id IN (SELECT value FROM json_each(?)) AND n <= 3
		 ORDER BY entry_id, n`, [JSON.stringify([...byId.keys()])]);
	for (const s of senses) byId.get(s.entry_id)!.glosses.push(s.gloss);
	return best;
}

/**
 * Details for every word whose page address is `slug` (see slug.ts). The
 * "latin" search key is the loose form of the same romanisation, so it finds
 * the candidates; the exact slug then picks the right ones.
 */
export async function wordDetailsBySlug(db: Db, slug: string): Promise<WordEntry[]> {
	const candidates = await db.all<{ word: string }>(
		`SELECT DISTINCT e.word FROM search_keys k JOIN entries e ON e.id = k.entry_id
		 WHERE k.key = ? AND k.kind = 'latin'`, [looseLatin(slug)]);
	const words = candidates.map((r) => r.word).filter((w) => wordSlug(w) === slug);
	// wordDetails ignores case, so А and а return the same entries: keep each once.
	const seen = new Set<number>();
	const entries: WordEntry[] = [];
	for (const list of await Promise.all(words.map((w) => wordDetails(db, w)))) {
		for (const e of list) if (!seen.has(e.id)) { seen.add(e.id); entries.push(e); }
	}
	return entries.sort((a, b) =>
		(a.freq_rank ?? Infinity) - (b.freq_rank ?? Infinity) || a.id - b.id);
}
