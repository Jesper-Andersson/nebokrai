// Readers' suggested corrections to the dictionary: the table and what is done
// with it. They sit beside the reports (reports.ts), in the same private
// database and for the same reasons: they hold text from strangers and a name
// some give for the credit, and they must survive rebuilds of nebokrai.db.
//
// A suggestion names its place by keys that survive a rebuild (src/lib/suggest.ts)
// and records what the dictionary said at the time (`current`), so it can
// still be read after the entry has changed.
//
// status: new → accepted | rejected; accepted → applied, once the fix is in
// the data (data/tatoeba-corrections.tsv) or on Wiktionary.
//
// No SvelteKit imports here, so tests/suggestions.test.ts can run it on an
// in-memory database. suggestion-db.ts opens the real one.
import type { SuggestTarget } from '#lib/suggest.ts';

export interface SuggestionDb {
	all<T>(sql: string, params?: unknown[]): Promise<T[]>;
	run(sql: string, params?: unknown[]): Promise<void>;
}

export const SUGGESTION_STATUSES = ['new', 'accepted', 'rejected', 'applied'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const isSuggestionStatus = (value: unknown): value is SuggestionStatus =>
	typeof value === 'string' && (SUGGESTION_STATUSES as readonly string[]).includes(value);

export const SUGGESTIONS_SCHEMA = [
	`CREATE TABLE IF NOT EXISTS suggestions (
		id INTEGER PRIMARY KEY,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
		status TEXT NOT NULL DEFAULT 'new',
		target TEXT NOT NULL,
		word TEXT NOT NULL,
		pos TEXT NOT NULL,
		headword TEXT NOT NULL,
		sense_n INTEGER,
		tatoeba_id INTEGER,
		form_tags TEXT,
		current TEXT NOT NULL,
		current_en TEXT,
		proposed TEXT NOT NULL,
		proposed_en TEXT,
		note TEXT,
		native INTEGER NOT NULL DEFAULT 0,
		name TEXT,
		user_id TEXT,
		lang TEXT,
		review_note TEXT,
		closed_at TEXT
	)`,
	'CREATE INDEX IF NOT EXISTS suggestions_status ON suggestions (status, id)'
];

export interface NewSuggestion {
	target: SuggestTarget;
	word: string;
	pos: string;
	headword: string;
	sense_n: number | null;
	tatoeba_id: number | null;
	/** The form's tags in one order (formTagsKey), or null. */
	form_tags: string | null;
	current: string;
	current_en: string | null;
	proposed: string;
	proposed_en: string | null;
	note: string | null;
	/** The sender ticked "I am a native speaker". Their word for it; nothing checks it. */
	native: boolean;
	name: string | null;
	/** The account that sent it, when signed in. */
	user_id: string | null;
	lang: string | null;
}

export interface Suggestion extends Omit<NewSuggestion, 'native'> {
	id: number;
	created_at: string;
	status: SuggestionStatus;
	native: number;
	review_note: string | null;
	closed_at: string | null;
}

const COLUMNS = [
	'target', 'word', 'pos', 'headword', 'sense_n', 'tatoeba_id', 'form_tags', 'current', 'current_en',
	'proposed', 'proposed_en', 'note', 'native', 'name', 'user_id', 'lang'
] as const;

/** Store a suggestion; returns its id. */
export async function addSuggestion(db: SuggestionDb, s: NewSuggestion): Promise<number> {
	const [row] = await db.all<{ id: number }>(
		`INSERT INTO suggestions (${COLUMNS.join(', ')})
		 VALUES (${COLUMNS.map(() => '?').join(', ')}) RETURNING id`,
		COLUMNS.map((column) => (column === 'native' ? Number(s.native) : s[column]))
	);
	return row.id;
}

/** The suggestions with one status, newest first. */
export async function listSuggestions(
	db: SuggestionDb,
	status: SuggestionStatus,
	limit = 100
): Promise<Suggestion[]> {
	return db.all<Suggestion>(
		'SELECT * FROM suggestions WHERE status = ? ORDER BY id DESC LIMIT ?',
		[status, Math.max(1, Math.min(500, limit))]
	);
}

/**
 * How many readers asked for a word that is still waiting: `new` and
 * `accepted` suggestions of the target `new-word`. The thank-you says "2 others
 * asked for this word too"; nothing else about them is shown.
 */
export async function countWordAsks(db: SuggestionDb, word: string): Promise<number> {
	const [row] = await db.all<{ n: number }>(
		`SELECT COUNT(*) AS n FROM suggestions
		 WHERE target = 'new-word' AND word = ? AND status IN ('new', 'accepted')`,
		[word]
	);
	return row?.n ?? 0;
}

/** How many suggestions there are with each status. */
export async function countSuggestions(db: SuggestionDb): Promise<Record<SuggestionStatus, number>> {
	const rows = await db.all<{ status: string; n: number }>(
		'SELECT status, COUNT(*) AS n FROM suggestions GROUP BY status'
	);
	const counts: Record<SuggestionStatus, number> = { new: 0, accepted: 0, rejected: 0, applied: 0 };
	for (const row of rows) if (isSuggestionStatus(row.status)) counts[row.status] = row.n;
	return counts;
}

/**
 * Move a suggestion to another status, with the reviewer's note. Returns
 * false when there is no such suggestion. Going back to 'new' reopens it.
 */
export async function reviewSuggestion(
	db: SuggestionDb,
	id: number,
	status: SuggestionStatus,
	note: string | null
): Promise<boolean> {
	const rows = await db.all<{ id: number }>(
		`UPDATE suggestions
		 SET status = ?, review_note = ?,
		     closed_at = CASE WHEN ? = 'new' THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%SZ', 'now') END
		 WHERE id = ? RETURNING id`,
		[status, note, status, id]
	);
	return rows.length > 0;
}

/**
 * One line for data/tatoeba-corrections.tsv from an accepted suggestion about
 * an example sentence: `id, uk, en, source`, separated by tabs. The English is
 * left empty when it was not changed, which keeps Tatoeba's. The credit is the
 * suggestion's number, the name when one was given, and the day it was sent.
 */
export function correctionRow(s: Suggestion): string | null {
	if (s.target !== 'example' || s.tatoeba_id === null) return null;
	// A tab or a line break inside a cell would shift every column after it.
	const cell = (text: string) => text.replace(/\s+/g, ' ').trim();
	const en = s.proposed_en !== null && s.proposed_en.trim() !== (s.current_en ?? '').trim() ? s.proposed_en : '';
	const credit = ['Nebokrai suggestion ' + s.id, s.name, s.created_at.slice(0, 10)].filter(Boolean).join(', ');
	return [String(s.tatoeba_id), cell(s.proposed), cell(en), cell(credit)].join('\t');
}

// Wiktionary's headings and head templates for the parts of speech a reader can choose.
const WIKI_POS: Record<string, [string, string]> = {
	noun: ['Noun', 'noun'],
	verb: ['Verb', 'verb'],
	adjective: ['Adjective', 'adjective'],
	adverb: ['Adverb', 'adverb']
};

/**
 * A draft English Wiktionary entry for an accepted new word, to check and
 * finish by hand before saving it there: the language and part-of-speech
 * headings, a generic head template with the reader's stress, and the meaning.
 * "Other" and "not sure" leave the part of speech for the reviewer to fill in.
 * The reader's note goes in as a comment, since it is evidence, not content.
 */
export function wiktionaryDraft(s: Suggestion): string | null {
	if (s.target !== 'new-word') return null;
	const line = (text: string) => text.replace(/\s+/g, ' ').trim();
	const [heading, template] = WIKI_POS[s.pos] ?? ['<!-- part of speech -->', '<!-- part of speech -->'];
	const lines = [
		'==Ukrainian==',
		'',
		`===${heading}===`,
		`{{head|uk|${template}|head=${line(s.headword)}}}`,
		'',
		`# ${line(s.proposed)}`
	];
	if (s.note) lines.push(`<!-- Nebokrai suggestion ${s.id}: ${line(s.note).replaceAll('--', '–')} -->`);
	return lines.join('\n');
}
