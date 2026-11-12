// What search engines are told about the site: the title and description of a
// word's page, and the sitemap that lists every page worth finding. The word
// pages can only be reached by typing in the search box, so without the
// sitemap a crawler would never see them.
//
// Nothing here imports from SvelteKit, so `npm test` can run it.
import {
	ALPHABET, COMMON_PER_PAGE, COMMON_WORDS, OTHER, WORDS_PER_PAGE, commonPath, letterOf, letterPath
} from './browse.ts';
import { posLabel, type Messages, type WordFacts } from './i18n.ts';
import type { Db } from './search/db.ts';
import { wordPath } from './search/slug.ts';
import type { WordEntry } from './search/word.ts';

const STRESS = '́';
/** Search results cut a description off at about this many characters. */
const DESCRIPTION_LENGTH = 160;

/** Only what the page really has is promised: 6% of entries have no stress mark, 43% no recording. */
function facts(entry: WordEntry): WordFacts {
	return {
		stress: entry.headword.includes(STRESS),
		audio: Boolean(entry.audio_url),
		table: entry.forms.length === 0 ? null : entry.pos === 'verb' ? 'conjugation' : 'declension',
		examples: entry.examples.length > 0
	};
}

/** книга: meaning in English, stress and declension · Nebokrai */
export function wordTitle(m: Messages, entry: WordEntry): string {
	return `${m.meta.wordTitle(entry.word, facts(entry))} · Nebokrai`;
}

/**
 * кни́га (noun): book. With the stress marked, audio, a full declension table and example sentences.
 * The meanings are shortened to keep the whole within what a search result shows.
 */
export function wordDescription(m: Messages, entry: WordEntry): string {
	const start = `${entry.headword} (${posLabel(m, entry.pos).toLowerCase()}): `;
	const shows = m.meta.wordShows(facts(entry));
	const room = Math.max(40, DESCRIPTION_LENGTH - start.length - shows.length - 2);
	let meanings = entry.senses.map((sense) => sense.gloss).join('; ');
	// Cut at the last whole word that fits
	if (meanings.length > room) meanings = meanings.slice(0, room).replace(/[\s,;(]+\S*$/, '') + '…';
	return `${start}${meanings}${meanings.endsWith('…') ? '' : '.'} ${shows}`.trim();
}

/** The pages for everyone, apart from the words. /saved and /report are left out on purpose. */
const PAGES = ['/', '/about', '/resources', '/grammar', '/support', '/sources', '/words'];

const xml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * sitemap.xml: every page's address, one per word page, most common words
 * first. Several words can share a page (а, А and -а are all /word/a); each
 * page is listed once. About 29,000 addresses, under the limit of 50,000 for
 * one sitemap file.
 *
 * Before the words come the pages that list them (browse.ts): the ten of the
 * common words, and each letter's, as many as its words fill. A letter is a
 * Cyrillic address, written here the way a browser sends it (%D0%BF for п).
 */
export async function sitemap(db: Db, origin: string): Promise<string> {
	const rows = await db.all<{ word: string }>(
		'SELECT word FROM entries GROUP BY word ORDER BY min(coalesce(freq_rank, 1e9)), word');
	const paths = new Set(PAGES);
	for (let page = 1; page <= COMMON_WORDS / COMMON_PER_PAGE; page++) paths.add(commonPath(page));
	const under = new Map<string, number>();
	for (const { word } of rows) {
		const letter = letterOf(word) ?? OTHER;
		under.set(letter, (under.get(letter) ?? 0) + 1);
	}
	for (const letter of [...ALPHABET, OTHER]) {
		const pages = Math.ceil((under.get(letter) ?? 0) / WORDS_PER_PAGE);
		for (let page = 1; page <= pages; page++) paths.add(encodeURI(letterPath(letter, page)));
	}
	for (const { word } of rows) paths.add(wordPath(word));
	const urls = [...paths].map((path) => `<url><loc>${xml(origin + path)}</loc></url>`);
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls,
		'</urlset>',
		''
	].join('\n');
}
