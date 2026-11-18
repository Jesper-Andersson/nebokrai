// The page of a word only VESUM knows: книжечка has no dictionary entry, but
// VESUM knows it is a feminine noun and has all fourteen of its forms. The
// word page shows that when the dictionary has nothing at the address.
//
// Everything here is read from vesum.db at request time and never copied:
// VESUM is CC BY-NC-SA 4.0 and must stay in its own database (data/README.md,
// "VESUM form lookup"). With no vesum.db, or one built before 2026-11-17
// without these tables, every function returns nothing.

import type { Db } from './db.ts';
import { looseLatin } from './normalize.ts';
import { vesumNote, type UseInstead, type VesumKind } from './search.ts';
import { wordSlug } from './slug.ts';

export interface VesumWord {
	/** The word as VESUM spells it, lower case and without stress: книжечка */
	word: string;
	pos: string;
	/** The word's own tags in Wiktionary's words: ["feminine", "inanimate"] */
	tags: string[];
	/** Given name, surname, …, or distorted (not standard Ukrainian), where VESUM says so. */
	kind?: VesumKind;
	/** For a distorted word, what to say instead: митниця for таможня. */
	use?: UseInstead[];
	/**
	 * Every form, one row per table cell, in the shape `WordEntry.forms` has,
	 * so `formTables()` draws it. No stress marks: VESUM's snapshot has none.
	 */
	forms: { form: string; tags: string[] }[];
}

/** The rows of a query on a table an older vesum.db does not have. */
async function rowsOrNone<T>(db: Db, sql: string, params: unknown[]): Promise<T[]> {
	try {
		return await db.all<T>(sql, params);
	} catch (err) {
		if (/no such table/i.test(String(err))) return [];
		throw err;
	}
}

/** The forms of one paradigm (`vesum_words.id`), in VESUM's order. */
export async function vesumForms(vesum: Db, id: number): Promise<VesumWord['forms']> {
	const rows = await rowsOrNone<{ form: string; tags: string }>(vesum,
		`SELECT p.form, t.tags FROM vesum_paradigms p JOIN vesum_tagsets t ON t.id = p.tagset
		 WHERE p.word = ? ORDER BY p.n`, [id]);
	return rows.map((r) => ({ form: r.form, tags: JSON.parse(r.tags) }));
}

type WordRow = { id: number; lemma: string; pos: string; tags: string };

async function load(db: Db, vesum: Db, rows: WordRow[]): Promise<VesumWord[]> {
	return Promise.all(rows.map(async (r) => {
		const [forms, note] = await Promise.all([vesumForms(vesum, r.id), vesumNote(db, vesum, r.lemma, r.pos)]);
		const word: VesumWord = { word: r.lemma, pos: r.pos, tags: JSON.parse(r.tags), forms };
		if (note.kind) word.kind = note.kind;
		if (note.use?.length) word.use = note.use;
		return word;
	}));
}

/**
 * Every VESUM word whose page address is `slug`, the same way
 * `wordDetailsBySlug` finds dictionary entries: the loose romanisation finds
 * the candidates, the exact slug picks them. A lemma with two paradigms
 * (швидкий the adjective and the noun) gives two words.
 */
export async function vesumWordsBySlug(db: Db, vesum: Db, slug: string): Promise<VesumWord[]> {
	const rows = await rowsOrNone<WordRow>(vesum,
		'SELECT id, lemma, pos, tags FROM vesum_words WHERE latin = ? ORDER BY lemma, pos, id', [looseLatin(slug)]);
	return load(db, vesum, rows.filter((r) => wordSlug(r.lemma) === slug));
}

/** Every VESUM word spelled `word` (lower case, no stress), for an address with no slug. */
export async function vesumWords(db: Db, vesum: Db, word: string): Promise<VesumWord[]> {
	const rows = await rowsOrNone<WordRow>(vesum,
		'SELECT id, lemma, pos, tags FROM vesum_words WHERE lemma = ? ORDER BY pos, id', [word.toLowerCase()]);
	return load(db, vesum, rows);
}

/**
 * VESUM's forms for a dictionary word that has none of its own: an entry
 * written for Nebokrai, or one made from translation tables. The paradigm
 * with the same part of speech, when there is exactly one; else none, rather
 * than the wrong word's table.
 */
export async function vesumFormsFor(vesum: Db, word: string, pos: string): Promise<VesumWord['forms']> {
	const rows = await rowsOrNone<{ id: number }>(vesum,
		'SELECT id FROM vesum_words WHERE lemma = ? AND pos = ?', [word.toLowerCase(), pos]);
	return rows.length === 1 ? vesumForms(vesum, rows[0].id) : [];
}
