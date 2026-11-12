// Everything the Details page needs for one spelling. A spelling can have
// several entries (стан is a noun five times over), so the answer is a list.

import type { Db } from './db.ts';
import type { HeadForm } from './search.ts';
import { looseLatin, plain } from './normalize.ts';
import { wordSlug } from './slug.ts';

export interface Sense {
	n: number;
	gloss: string;
	tags: string[];
	/** Usage examples quoted in Wiktionary for this meaning. Often empty. */
	examples: { text: string; english: string | null }[];
}

export interface WordEntry {
	id: number;
	word: string;
	headword: string;
	pos: string;
	tags: string[];
	head_forms: HeadForm[];
	roman: string | null;
	ipa: string | null;
	audio_url: string | null;
	etymology: string | null;
	freq_rank: number | null;
	senses: Sense[];
	/** The declension or conjugation table, one row per cell. Empty if there is none. */
	forms: { form: string; tags: string[] }[];
	/** Tatoeba sentences that use the word, up to three. */
	examples: { uk: string; en: string; tatoeba_id: number }[];
}

export async function wordDetails(db: Db, word: string): Promise<WordEntry[]> {
	const rows = await db.all<Record<string, any>>(
		`SELECT id, word, headword, pos, tags, head_forms, roman, ipa, audio_url, etymology, freq_rank
		 FROM entries WHERE id IN (SELECT entry_id FROM search_keys WHERE key = ? AND kind = 'word')
		 ORDER BY freq_rank IS NULL, freq_rank, id`, [plain(word)]);
	const entries: WordEntry[] = [];
	for (const r of rows) {
		const [senses, forms, examples] = await Promise.all([
			db.all<Record<string, any>>(
				'SELECT n, gloss, tags, examples FROM senses WHERE entry_id=? ORDER BY n', [r.id]),
			db.all<Record<string, any>>('SELECT form, tags FROM forms WHERE entry_id=? ORDER BY id', [r.id]),
			db.all<WordEntry['examples'][number]>(
				'SELECT uk, en, tatoeba_id FROM examples WHERE entry_id=? ORDER BY id', [r.id])
		]);
		entries.push({
			id: r.id, word: r.word, headword: r.headword, pos: r.pos,
			tags: JSON.parse(r.tags), head_forms: JSON.parse(r.head_forms),
			roman: r.roman, ipa: r.ipa, audio_url: r.audio_url, etymology: r.etymology,
			freq_rank: r.freq_rank,
			senses: senses.map((s) => ({
				n: s.n, gloss: s.gloss, tags: JSON.parse(s.tags), examples: JSON.parse(s.examples)
			})),
			forms: forms.map((f) => ({ form: f.form, tags: JSON.parse(f.tags) })),
			examples
		});
	}
	return entries;
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
	/** The first Tatoeba sentence that uses the word, if there is one. */
	example: { uk: string; en: string; tatoeba_id: number } | null;
}

/**
 * A card for each of `words`, chosen and ordered as `wordSummaries` does: the
 * two share `bestEntries`, so a list and its export never show different
 * entries for one spelling.
 */
export async function wordCards(db: Db, words: string[]): Promise<WordCard[]> {
	const best = await bestEntries(db, words);
	const examples = new Map<number, NonNullable<WordCard['example']>>();
	if (best.size) {
		const rows = await db.all<{ entry_id: number; uk: string; en: string; tatoeba_id: number }>(
			`SELECT entry_id, uk, en, tatoeba_id FROM examples WHERE id IN (
			   SELECT MIN(id) FROM examples WHERE entry_id IN (SELECT value FROM json_each(?)) GROUP BY entry_id)`,
			[JSON.stringify([...best.values()].map((e) => e.id))]);
		for (const { entry_id, ...example } of rows) examples.set(entry_id, example);
	}
	return words.flatMap((w) => {
		const found = best.get(w);
		if (!found) return [];
		return [{
			word: found.word, headword: found.headword, glosses: found.glosses,
			pos: found.pos, tags: JSON.parse(found.tags), ipa: found.ipa,
			example: examples.get(found.id) ?? null
		}];
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
	glosses: string[];
}

/** The most common entry for each spelling in `words`, with its first three meanings. */
async function bestEntries(db: Db, words: string[]): Promise<Map<string, BestEntry>> {
	const best = new Map<string, BestEntry>();
	if (!words.length) return best;
	// One JSON parameter for the whole list: D1 binds at most 100.
	const rows = await db.all<Omit<BestEntry, 'glosses'>>(
		`SELECT id, word, headword, pos, tags, ipa FROM entries WHERE word IN (SELECT value FROM json_each(?))
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
