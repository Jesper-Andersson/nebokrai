// Word lists as text: one word to a line, or columns split by tabs, commas or
// semicolons (a spreadsheet's CSV, Anki's "Notes in plain text", this site's
// own CSV export). The column with the Ukrainian in it is found by looking.
// Text brings no progress: its words are saved, as new words.
import { isCyrillic } from '../search/normalize.ts';
import { fieldText, meaningOf, wordsOf } from './clean.ts';
import type { ImportItem } from './deck.ts';

/** Headings of a column holding what the words mean. */
const MEANING_HEADINGS = /^(meanings?|english|translations?|definitions?|back)$/i;

export interface TextFile {
	items: ImportItem[];
	/** The column read, from 0, and how many there were. */
	column: number;
	columns: number;
}

const SEPARATORS: Record<string, string> = {
	tab: '\t', comma: ',', semicolon: ';', pipe: '|', colon: ':', space: ' '
};

/** Rows of cells. Quotes work as in CSV: "a, b" is one cell and "" is a quote mark inside one. */
export function parseRows(text: string, separator: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else cell += ch;
		} else if (ch === '"' && cell === '') quoted = true;
		else if (ch === separator) {
			row.push(cell);
			cell = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else cell += ch;
	}
	if (cell !== '' || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim()));
}

/**
 * The separator that splits every line into the same number of cells, quotes
 * respected: tab first, as no word holds one. "автомобіль, авто" on some lines
 * of a list is a word and its twin, not two columns, so a separator only
 * counts when every line has it.
 */
function guessSeparator(body: string): string {
	const sample = body.split(/\r?\n/).filter((l) => l.trim()).slice(0, 50).join('\n');
	if (sample.includes('\t')) return '\t';
	for (const sep of [';', ',']) {
		const widths = parseRows(sample, sep).map((r) => r.length);
		if (widths.length && widths.every((n) => n > 1 && n === widths[0])) return sep;
	}
	return '\n';
}

/** Anki's header lines (#separator:tab, #guid column:1), and the text after them. */
function headers(text: string): { options: Map<string, string>; body: string } {
	const options = new Map<string, string>();
	const lines = text.split(/\r?\n/);
	let i = 0;
	for (; i < lines.length && lines[i].startsWith('#'); i++) {
		const [key, ...value] = lines[i].slice(1).split(':');
		options.set(key.trim().toLowerCase(), value.join(':').trim());
	}
	return { options, body: lines.slice(i).join('\n') };
}

const GUID = /^nebokrai:(.+)$/;

/** The items in a text or CSV file. */
export function readText(input: string): TextFile {
	const { options, body } = headers(input.replace(/^﻿/, ''));
	const named = options.get('separator')?.toLowerCase();
	const separator = named ? (SEPARATORS[named] ?? named) : guessSeparator(body);
	let rows = separator === '\n' ? body.split(/\r?\n/).filter((l) => l.trim()).map((l) => [l]) : parseRows(body, separator);
	const columns = Math.max(0, ...rows.map((r) => r.length));

	// A note exported from this site names its word in the guid: nebokrai:вода
	const guidColumn = Number(options.get('guid column')) - 1;
	if (guidColumn >= 0 && rows.some((r) => GUID.test(r[guidColumn] ?? ''))) {
		const items = rows.flatMap((r) => {
			const word = GUID.exec(r[guidColumn] ?? '')?.[1];
			return word ? [{ source: word, words: [word], progress: null, suspended: false, meaning: '' }] : [];
		});
		return { items, column: guidColumn, columns };
	}

	// A header row: this site's CSV starts "word,headword,…", and the word column is named
	let column = rows[0]?.findIndex((c) => c.trim().toLowerCase() === 'word') ?? -1;
	// A named column of meanings beats guessing: this site's CSV also has part_of_speech, in Latin letters too
	const headed = rows[0]?.findIndex((c) => MEANING_HEADINGS.test(c.trim())) ?? -1;
	const meaningColumn = column >= 0 && headed >= 0 ? headed : -1;
	if (column >= 0) rows = rows.slice(1);
	else {
		let most = -1;
		for (let i = 0; i < columns; i++) {
			const score = rows.filter((r) => isCyrillic(r[i] ?? '')).length;
			if (score > most) [column, most] = [i, score];
		}
		// A first row with no Ukrainian in that column is a row of headings
		if (rows.length > 1 && !isCyrillic(rows[0][column] ?? '')) rows = rows.slice(1);
	}

	const items = rows.map((r) => {
		const cell = r[column] ?? '';
		return {
			source: fieldText(cell).replace(/\n+/g, ' · '),
			words: wordsOf(cell),
			progress: null,
			suspended: false,
			meaning: meaningOf(meaningColumn >= 0 ? [r[meaningColumn] ?? ''] : r.filter((_, i) => i !== column))
		};
	});
	return { items: items.filter((i) => i.source), column: Math.max(column, 0), columns };
}
