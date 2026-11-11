// The word of the day on the home page: one entry, the same for everyone all
// day, chosen from the words a learner is likely to meet. No SvelteKit imports,
// so tests/word-of-day.test.ts runs it on the local database.
import type { Db } from './search/db.ts';
import type { HeadForm } from './search/search.ts';
import { wordDetails, type Sense } from './search/word.ts';

/** What the home page shows of the entry: enough for a card, not the form tables. */
export interface WordOfDay {
	word: string;
	headword: string;
	pos: string;
	tags: string[];
	head_forms: HeadForm[];
	roman: string | null;
	ipa: string | null;
	freq_rank: number | null;
	/** The first meanings, at most three. */
	senses: Pick<Sense, 'gloss' | 'tags'>[];
	example: { uk: string; en: string; tatoeba_id: number };
}

// Ranks 300 to 6000: past я, не and що, which nobody needs to be shown, and
// short of the words too rare to be worth a beginner's day.
const FIRST = 300;
const LAST = 6000;
// 5701 ranks, a prime number: multiplying the day by anything that is not a
// multiple of it visits every rank once before any comes round again, and
// this multiplier throws neighbouring days far apart.
const SPREAD = 2654435761;

/** The frequency rank the search for the day's word starts from. `day` counts days since 1970. */
export function rankForDay(day: number): number {
	return FIRST + ((day * SPREAD) % (LAST - FIRST + 1));
}

/** Days since 1970 in UTC: the word changes at the same moment for everyone. */
export function today(now = Date.now()): number {
	return Math.floor(now / 86_400_000);
}

// The frequency list comes from film subtitles, and so лайно́ and ку́рва are
// common words. They have entries, and no place on the front page.
const NOT_FOR_THE_FRONT_PAGE = ['vulgar', 'offensive', 'derogatory', 'slang']
	.map((tag) => `tags LIKE '%"${tag}"%'`).join(' OR ');

/**
 * The entry for `day`: the first noun, verb, adjective or adverb at or after
 * the day's rank that has a Tatoeba sentence to show. About 4,800 entries
 * qualify. Null only if the database has none.
 */
export async function wordOfDay(db: Db, day: number): Promise<WordOfDay | null> {
	const [found] = await db.all<{ id: number; word: string }>(
		`SELECT id, word FROM entries
		 WHERE freq_rank >= ? AND pos IN ('noun', 'verb', 'adj', 'adv')
		   AND EXISTS (SELECT 1 FROM examples WHERE entry_id = entries.id)
		   AND NOT EXISTS (SELECT 1 FROM senses WHERE entry_id = entries.id AND (${NOT_FOR_THE_FRONT_PAGE}))
		 ORDER BY freq_rank LIMIT 1`, [rankForDay(day)]);
	if (!found) return null;
	// A spelling can have several entries (стан has six); the day's is the ranked one.
	const entry = (await wordDetails(db, found.word)).find((e) => e.id === found.id);
	if (!entry) return null;
	return {
		word: entry.word, headword: entry.headword, pos: entry.pos, tags: entry.tags,
		head_forms: entry.head_forms, roman: entry.roman, ipa: entry.ipa, freq_rank: entry.freq_rank,
		senses: entry.senses.slice(0, 3).map(({ gloss, tags }) => ({ gloss, tags })),
		example: entry.examples[0]
	};
}
