// The files the Saved page offers for download: an Anki text file, a CSV for
// spreadsheets and other flashcard apps, and JSON. Text in, text out, so
// `npm test` can check every character without a browser.
//
// Everything here comes from the dictionary (Wiktionary, CC BY-SA 4.0) and
// Tatoeba (CC BY 2.0 FR). Each card links back to its word page, which carries
// the credits.

import { wordPath } from './search/slug.ts';
import type { WordCard } from './search/word.ts';

/** A card, and when its word was saved (milliseconds). */
export type ExportCard = WordCard & { saved_at: number };

export type ExportFormat = 'anki' | 'csv' | 'json';

export interface ExportFile {
	name: string;
	/** The media type to download it as. */
	type: string;
	text: string;
}

const SITE = 'https://nebokrai.app';
const LICENCE =
	'Dictionary data from Wiktionary, CC BY-SA 4.0. Example sentences from Tatoeba, CC BY 2.0 FR. See https://nebokrai.app/sources';

const wordUrl = (word: string) => SITE + wordPath(word);
const tatoebaUrl = (id: number) => `https://tatoeba.org/sentences/show/${id}`;

/**
 * The file for one format. `posName` gives a part of speech its name in the
 * visitor's language for the Anki card ("adj" → "Adjective"); CSV and JSON
 * keep the dictionary's own value.
 */
export function exportFile(
	format: ExportFormat, cards: ExportCard[], posName: (pos: string) => string, now: Date
): ExportFile {
	const stem = `nebokrai-saved-${now.toISOString().slice(0, 10)}`;
	if (format === 'anki') return { name: `${stem}.txt`, type: 'text/plain;charset=utf-8', text: ankiText(cards, posName) };
	if (format === 'csv') return { name: `${stem}.csv`, type: 'text/csv;charset=utf-8', text: csv(cards) };
	return { name: `${stem}.json`, type: 'application/json', text: json(cards, now) };
}

/** `"` too, so that a field can never open with the quote Anki reads as "quoted field". */
const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One field of a tab-separated line: a tab or line break inside it would start a new field or card. */
const oneLine = (text: string) => text.replace(/[\t\r\n]+/g, ' ');

/**
 * A text file for Anki's File > Import (Anki 2.1.54 or later reads the `#`
 * lines). Three columns of content: the word, its meaning, and the details
 * (grammar, pronunciation, an example, the link back). Anki gives them to the
 * note type's fields in order, so the built-in Basic type takes the word as
 * the front and the meaning as the back with no setup, and a note type with a
 * third field takes the details too.
 *
 * The columns are deliberately not named with `#columns:`. Anki would then
 * match them to fields by name, and a note type whose fields are called
 * anything else (Basic's are translated) would import empty. The note type is
 * not named either, since its name depends on the language Anki is set to.
 *
 * The first column is a stable id per word, so importing a later export
 * updates the cards already there instead of doubling them.
 */
export function ankiText(cards: ExportCard[], posName: (pos: string) => string): string {
	const lines = ['#separator:tab', '#html:true', '#guid column:1', '#tags column:5', '#deck:Nebokrai'];
	for (const card of cards) {
		const meaning = card.glosses.length === 1
			? escapeHtml(card.glosses[0])
			: `<ol>${card.glosses.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ol>`;
		const grammar = [posName(card.pos), card.tags.join(', ')].filter(Boolean).join(' · ');
		const details = [
			`<div>${escapeHtml(grammar)}</div>`,
			card.ipa && `<div>${escapeHtml(card.ipa)}</div>`,
			card.example &&
				`<div><i lang="uk">${escapeHtml(card.example.uk)}</i><br>${escapeHtml(card.example.en)}</div>`,
			`<div><a href="${escapeHtml(wordUrl(card.word))}">Nebokrai</a></div>`
		].filter(Boolean).join('');
		// A tag ends at a space, and "prep_phrase" has none
		const tags = `nebokrai ${card.pos.replace(/\s+/g, '_')}`;
		lines.push(
			[`nebokrai:${card.word}`, escapeHtml(card.headword), meaning, details, tags].map(oneLine).join('\t')
		);
	}
	return lines.join('\n') + '\n';
}

const CSV_COLUMNS = [
	'word', 'headword', 'part_of_speech', 'grammar', 'ipa', 'meanings', 'example_uk', 'example_en', 'url', 'saved_at'
];

/**
 * One row per word, one column per fact, as plain text. It starts with a
 * byte-order mark and ends lines with CRLF: without the mark Excel reads the
 * Ukrainian letters as Western European ones (ÐºÐ½Ð¸Ð³Ð° for книга).
 */
export function csv(cards: ExportCard[]): string {
	const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
	const rows = cards.map((card) => [
		card.word, card.headword, card.pos, card.tags.join(', '), card.ipa ?? '', card.glosses.join('; '),
		card.example?.uk ?? '', card.example?.en ?? '', wordUrl(card.word), new Date(card.saved_at).toISOString()
	]);
	return '﻿' + [CSV_COLUMNS, ...rows].map((row) => row.map(quote).join(',') + '\r\n').join('');
}

/** Everything, for a backup or the visitor's own scripts. */
export function json(cards: ExportCard[], now: Date): string {
	return JSON.stringify({
		exported_at: now.toISOString(),
		source: SITE,
		licence: LICENCE,
		words: cards.map((card) => ({
			word: card.word,
			headword: card.headword,
			pos: card.pos,
			tags: card.tags,
			ipa: card.ipa,
			glosses: card.glosses,
			example: card.example && { ...card.example, url: tatoebaUrl(card.example.tatoeba_id) },
			url: wordUrl(card.word),
			saved_at: card.saved_at
		}))
	}, null, '\t') + '\n';
}
