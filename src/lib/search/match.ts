// Which dictionary word each word of an imported list is (POST /api/words/match).
// A list says вода́, Київ or зламатися as its author wrote them; a saved word
// and a flashcard are keyed by an entry's `word` exactly. This finds that
// spelling: by the word itself first, then as an inflected form of one
// (автобусом → автобус), and failing both, offers a few guesses.
// It only reads search_keys and entries; the search itself is untouched.
import type { Db } from './db.ts';
import { plain } from './normalize.ts';
import { suggest } from './suggest.ts';

export interface WordMatch {
	/** The entry's `word`, or null if none is this word or a form of it. */
	word: string | null;
	/** Words it may have been meant as, most likely first; only when asked for and `word` is null. */
	suggestions: string[];
}

/** The most words in one request. */
export const MATCH_MAX = 500;
/** The most words to guess for in one request: each guess is several queries. */
export const SUGGEST_MAX = 20;

/** For each of `written`, the dictionary word it is. */
export async function matchWords(
	db: Db, written: string[], options: { suggest?: boolean } = {}
): Promise<Record<string, WordMatch>> {
	const keys = [...new Set(written.map(plain))];
	const rows = keys.length
		? await db.all<{ key: string; kind: string; word: string }>(
			`SELECT k.key, k.kind, e.word FROM search_keys k JOIN entries e ON e.id = k.entry_id
			 WHERE k.kind IN ('word', 'form') AND k.key IN (SELECT value FROM json_each(?))
			 ORDER BY k.kind = 'form', e.freq_rank IS NULL, e.freq_rank, e.id`,
			[JSON.stringify(keys)])
		: [];
	const byKey = new Map<string, typeof rows>();
	for (const row of rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);

	const matches: Record<string, WordMatch> = {};
	for (const w of new Set(written)) {
		const found = byKey.get(plain(w)) ?? [];
		// The spelling as written wins where letter case tells two words apart
		const asWritten = w.normalize('NFC').replaceAll('́', '');
		const exact = found.find((r) => r.kind === 'word' && r.word === asWritten);
		matches[w] = { word: (exact ?? found[0])?.word ?? null, suggestions: [] };
	}

	if (options.suggest) {
		const missing = Object.keys(matches).filter((w) => !matches[w].word).slice(0, SUGGEST_MAX);
		for (const w of missing) {
			const guesses = await suggest(db, w, { limit: 5 });
			matches[w].suggestions = [...new Set(guesses.map((g) => g.word))].slice(0, 3);
		}
	}
	return matches;
}
