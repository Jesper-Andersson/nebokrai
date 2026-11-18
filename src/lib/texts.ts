// Stories to read (/read): the texts, their pages and sentences, and how much
// of a text a learner already knows. The rows are made by
// data/import_stories.py from the CC BY stories of Global Storybooks; each
// keeps its own licence, link and credits. Runs on D1 and on a local SQLite
// file alike (search/db.ts), so `npm test` checks it against the real rows.
//
// A text's difficulty is its Storybooks level, and what the reader is told
// is the share of its words they know (knownShare), from their own cards.
// There is no frequency band: the stories of every level needed the same one
// (children's stories, measured against film subtitles), so a band said
// nothing a learner could choose by.
import { stateOf } from './practice/round.ts';
import type { ReviewCard } from './review/fsrs.ts';
import type { Db } from './search/db.ts';

/** A slug is the title in Latin letters: duzhe-vysokyi-cholovik. */
const SLUG = /^[a-z0-9-]{1,100}$/;

/**
 * The words of a text by what they are: each item is the entry words one
 * word of the text may be (води: ["вода", "водити"]) and how many times
 * the text has a word that may be those. Words the dictionary does not know
 * are left out.
 */
export type Vocab = [lemmas: string[], count: number][];

export interface Credit {
	/** As the story's colophon has it: "Written by", "Illustrated by", "Translated by", "Read by". */
	role: string;
	name: string;
}

export interface TextSummary {
	slug: string;
	/** With stress marks where the dictionary gives one spelling only. */
	title: string;
	title_en: string;
	/** The Storybooks level, 1 (easiest) to 5: it follows length and sentences, not vocabulary. */
	level: number | null;
	/** Words in the text, and how many of them the dictionary does not know. */
	tokens: number;
	unknown: number;
	pages: number;
	/** The story on Storybooks, its licence, and who made it: to be shown with it. */
	url: string;
	licence: string;
	licence_url: string;
	credits: Credit[];
	/** Where Storybooks took the story from (African Storybook), when it says. */
	origin: { title: string; url: string; site: string; site_url: string } | null;
	vocab: Vocab;
}

export interface TextSentence {
	n: number;
	/** With stress marks added. */
	uk: string;
	/** As the story has it. */
	uk_source: string;
	/**
	 * For each word of the sentence, in order, the entry words it may be; [] for
	 * a word the dictionary does not know. The words are those `tokens()` in
	 * sentence.ts finds in `uk` (and import_stories.py in `uk_source`).
	 */
	lemmas: string[][];
}

export interface TextPage {
	/** 1 is the title page: its one sentence is the title. */
	page: number;
	/** The English of the whole page. */
	en: string;
	/** The human recording of the page, on this site: /audio/texts/<slug>/02.mp3. */
	audio: string;
	sentences: TextSentence[];
}

export interface Text extends TextSummary {
	cover_url: string | null;
	/** The share of words of two or more syllables left without a stress mark. */
	bare: number;
	/** The pages in order, each with its sentences. */
	contents: TextPage[];
}

interface TextRow {
	id: number;
	slug: string;
	title: string;
	title_en: string;
	level: number | null;
	tokens: number;
	unknown: number;
	bare: number;
	pages: number;
	url: string;
	licence: string;
	licence_url: string;
	credits: string;
	origin: string | null;
	cover_url: string | null;
}

const COLUMNS =
	'id, slug, title, title_en, level, tokens, unknown, bare, pages, url, licence, licence_url, credits, origin, cover_url';

/** The words of a text counted by what they may be, most frequent first. */
export function vocabOf(sentences: readonly (readonly (readonly string[])[])[]): Vocab {
	const counts = new Map<string, [string[], number]>();
	for (const words of sentences) {
		for (const lemmas of words) {
			if (!lemmas.length) continue;
			const key = lemmas.join('\n');
			const item = counts.get(key);
			if (item) item[1] += 1;
			else counts.set(key, [[...lemmas], 1]);
		}
	}
	return [...counts.values()].sort((a, b) => b[1] - a[1] || (a[0][0] < b[0][0] ? -1 : 1));
}

/**
 * The share of a text's known words (0 to 1) that the learner knows: a word
 * counts when one of the entries it may be has a card that `stateOf` calls
 * known. Words the dictionary does not know count neither way. 0 for a text
 * with no known words.
 */
export function knownShare(
	vocab: Vocab,
	cards: ReadonlyMap<string, ReviewCard>,
	now: number
): number {
	let all = 0;
	let known = 0;
	for (const [lemmas, count] of vocab) {
		all += count;
		if (lemmas.some((w) => stateOf(cards.get(w), now) === 'known')) known += count;
	}
	return all ? known / all : 0;
}

function summary(row: TextRow, vocab: Vocab): TextSummary {
	return {
		slug: row.slug,
		title: row.title,
		title_en: row.title_en,
		level: row.level,
		tokens: row.tokens,
		unknown: row.unknown,
		pages: row.pages,
		url: row.url,
		licence: row.licence,
		licence_url: row.licence_url,
		credits: JSON.parse(row.credits) as Credit[],
		origin: row.origin ? JSON.parse(row.origin) : null,
		vocab
	};
}

/** Every text, easiest first: by level (none last), then length, then title. */
export async function listTexts(db: Db): Promise<TextSummary[]> {
	const rows = await db.all<TextRow>(`SELECT ${COLUMNS} FROM texts`);
	const lemmas = await db.all<{ text_id: number; lemmas: string }>(
		'SELECT text_id, lemmas FROM text_sentences ORDER BY text_id, page, n'
	);
	const byText = new Map<number, string[][][]>();
	for (const { text_id, lemmas: json } of lemmas) {
		const list = byText.get(text_id) ?? [];
		list.push(JSON.parse(json));
		byText.set(text_id, list);
	}
	return rows
		.map((row) => summary(row, vocabOf(byText.get(row.id) ?? [])))
		.sort(
			(a, b) =>
				(a.level ?? Infinity) - (b.level ?? Infinity) ||
				a.tokens - b.tokens ||
				a.title.localeCompare(b.title, 'uk')
		);
}

/** One text with its pages and sentences, or null when no text has this slug. */
export async function textBySlug(db: Db, slug: string): Promise<Text | null> {
	if (!SLUG.test(slug)) return null;
	const [row] = await db.all<TextRow>(`SELECT ${COLUMNS} FROM texts WHERE slug = ?`, [slug]);
	if (!row) return null;
	const pages = await db.all<{ page: number; en: string; audio: string }>(
		'SELECT page, en, audio FROM text_pages WHERE text_id = ? ORDER BY page',
		[row.id]
	);
	const sentences = await db.all<{ page: number; n: number; uk: string; uk_source: string; lemmas: string }>(
		'SELECT page, n, uk, uk_source, lemmas FROM text_sentences WHERE text_id = ? ORDER BY page, n',
		[row.id]
	);
	const byPage = new Map<number, TextSentence[]>();
	for (const s of sentences) {
		const list = byPage.get(s.page) ?? [];
		list.push({ n: s.n, uk: s.uk, uk_source: s.uk_source, lemmas: JSON.parse(s.lemmas) });
		byPage.set(s.page, list);
	}
	const pagesList = pages.map((p) => ({ ...p, sentences: byPage.get(p.page) ?? [] }));
	return {
		...summary(row, vocabOf(pagesList.flatMap((p) => p.sentences.map((s) => s.lemmas)))),
		cover_url: row.cover_url,
		bare: row.bare,
		contents: pagesList
	};
}
