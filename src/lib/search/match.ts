// Which dictionary word each word of an imported list is (POST /api/words/match).
// A list says вода́, Київ or зламатися as its author wrote them; a saved word
// and a flashcard are keyed by an entry's `word` exactly. This finds that
// spelling: by the word itself first, then as an inflected form of one
// (автобусом → автобус), then both again with у and в (і and й) swapped at
// the start (вміти → уміти), and failing all of those, offers a few guesses.
// вміти has an entry too, but one that only says "alternative form of уміти":
// where the other spelling has the meanings, that one is the word to learn.
// It only reads search_keys and entries; the search itself is untouched.
import type { Db } from './db.ts';
import { plain } from './normalize.ts';
import { suggest } from './suggest.ts';
import { initialVariant } from './variants.ts';

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
	// Each word's other spelling (уміти for вміти) is asked for too, used only when the word itself is not found
	const keys = [...new Set(written.flatMap((w) => [plain(w), initialVariant(w) ?? []].flat()))];
	const rows = keys.length
		? await db.all<{ key: string; kind: string; word: string; pointer: number }>(
			`SELECT k.key, k.kind, e.word,
			        EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id) AND
			        NOT EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND s.tags NOT LIKE '%"alt-of"%') AS pointer
			 FROM search_keys k JOIN entries e ON e.id = k.entry_id
			 WHERE k.kind IN ('word', 'form') AND k.key IN (SELECT value FROM json_each(?))
			 ORDER BY k.kind = 'form', e.freq_rank IS NULL, e.freq_rank, e.id`,
			[JSON.stringify(keys)])
		: [];
	const byKey = new Map<string, typeof rows>();
	for (const row of rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);

	const matches: Record<string, WordMatch> = {};
	for (const w of new Set(written)) {
		const variant = initialVariant(w);
		const own = byKey.get(plain(w)) ?? [];
		const other = (variant ? byKey.get(variant) : undefined) ?? [];
		// The word as written, unless all it has is a pointer to another spelling and the у/в twin is a full entry
		const full = other.filter((r) => !r.pointer);
		const found = own.length && !(own.every((r) => r.pointer) && full.length) ? own : full.length ? full : other;
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
