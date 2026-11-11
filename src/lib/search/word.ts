// Everything the Details page needs for one spelling. A spelling can have
// several entries (стан is a noun five times over), so the answer is a list.

import type { Db } from './db.ts';
import type { HeadForm } from './search.ts';
import { plain } from './normalize.ts';

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
