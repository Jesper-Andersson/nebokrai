// The files the Saved page offers for download: an Anki text file, a CSV for
// spreadsheets and other flashcard apps, a CSV for Readlang, and JSON. Text in, text out, so
// `npm test` can check every character without a browser.
//
// Everything here comes from the dictionary (Wiktionary, CC BY-SA 4.0) and
// Tatoeba (CC BY 2.0 FR). Each card links back to its word page, which carries
// the credits.

import { wordPath } from './search/slug.ts';
import type { WordCard } from './search/word.ts';

/** A card, and when its word was saved (milliseconds). */
export type ExportCard = WordCard & { saved_at: number };

export type ExportFormat = 'anki' | 'csv' | 'readlang' | 'json';

export interface ExportFile {
	name: string;
	/** The media type to download it as. */
	type: string;
	text: string;
}

const SITE = 'https://nebokrai.app';
const LICENCE =
	'Dictionary data from Wiktionary, with abbreviations added by Nebokrai, CC BY-SA 4.0. Example sentences from Tatoeba, CC BY 2.0 FR. See https://nebokrai.app/sources';

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
	if (format === 'readlang') {
		return { name: `${stem}-readlang.csv`, type: 'text/csv;charset=utf-8', text: readlangCsv(cards) };
	}
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
		const { word, meaning, details, tags } = ankiFields(card, posName);
		lines.push([`nebokrai:${card.word}`, word, meaning, details, tags.join(' ')].map(oneLine).join('\t'));
	}
	return lines.join('\n') + '\n';
}

/** What one Anki note holds: three fields of HTML, and its tags. */
export interface AnkiFields {
	word: string;
	meaning: string;
	details: string;
	tags: string[];
}

/** The same note whether it reaches Anki as a line of the text file or through AnkiConnect (anki-connect.ts). */
export function ankiFields(card: WordCard, posName: (pos: string) => string): AnkiFields {
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
	return { word: escapeHtml(card.headword), meaning, details, tags: ['nebokrai', card.pos.replace(/\s+/g, '_')] };
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

/** Most words Readlang's importer takes from one file. */
export const READLANG_MAX = 200;
/** Meanings on one Readlang card: it shows them all on one line, and the first few are the common ones. */
const READLANG_MEANINGS = 3;

/** A line break is not allowed inside a Readlang cell, even a quoted one. */
const cell = (text: string) => {
	const flat = text.replace(/\s+/g, ' ').trim();
	return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
};

/**
 * The example sentence, if it has the word exactly as the card spells it.
 * Readlang blanks the word out of its context to practise it, and refuses a
 * context without it: «Я читаю книгу.» cannot go with книга, and «Книга на
 * столі.» is left out too, since whether Readlang minds the capital letter is
 * not known. Stress marks are removed first, as the word has none.
 */
function readlangContext(card: ExportCard): string {
	const sentence = card.example?.uk.replace(/́/g, '') ?? '';
	const word = card.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// Not inside a longer word: кіт is not in «китом», nor in «кіт-воркіт»'s second half
	const whole = new RegExp(`(?<![\\p{L}\\p{M}'ʼ’])${word}(?![\\p{L}\\p{M}'ʼ’])`, 'u');
	return whole.test(sentence) ? sentence : '';
}

/**
 * A file for Readlang's "Import Words From CSV": the word, its meanings with
 * " / " between them (Readlang's mark for alternative translations), and a
 * context sentence where there is one. No header row, no byte-order mark
 * (it would become part of the first word), and no practice dates, so
 * Readlang schedules each word from the day it is imported. Takes the first
 * READLANG_MAX cards; the page says so when there were more.
 */
export function readlangCsv(cards: ExportCard[]): string {
	return cards
		.filter((card) => card.glosses.length)
		.slice(0, READLANG_MAX)
		.map((card) => {
			// An entry can give one meaning under several senses (вони: they, three times)
			const row = [card.word, [...new Set(card.glosses)].slice(0, READLANG_MEANINGS).join(' / ')];
			const context = readlangContext(card);
			if (context) row.push(context);
			return row.map(cell).join(',') + '\n';
		})
		.join('');
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
