// Turn accepted suggestions from readers into something to act on.
//   npm run suggestions                       from the local reports.db
//   npm run suggestions -- --from rows.json   from production, see below
//
// It prints, and changes nothing:
//  - for each accepted example-sentence fix, a line for
//    data/tatoeba-corrections.tsv (id, uk, en, source), to paste there; the
//    next build of the data applies it;
//  - the other accepted suggestions (headword, stress, meaning, quotation,
//    form) as a list, for fixing on Wiktionary: there is no override file for
//    those;
//  - each accepted new word as a draft Wiktionary entry, to check and finish
//    before saving it there.
//
//   npm run suggestions -- --check nebokrai.db
// lists instead the accepted new words that now have an entry, after a
// rebuild of the dictionary: those can be marked 'applied'.
// Afterwards mark them 'applied' on /review.
//
// From production, save the accepted rows first (a read-only query):
//   wrangler d1 execute <reports database> --remote --json
//     --command "SELECT * FROM suggestions WHERE status = 'accepted' ORDER BY id" > rows.json
// The TSV lines go to standard output and everything else to standard error,
// so `npm run --silent suggestions > new-rows.tsv` holds the lines alone.
// Run it from Bash: a PowerShell redirect adds a byte-order mark.
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { stripControls } from '../src/lib/report.ts';
import { plain } from '../src/lib/search/normalize.ts';
import { correctionRow, wiktionaryDraft, type Suggestion } from '../src/lib/server/suggestions.ts';

function load(): Suggestion[] {
	const from = process.argv.indexOf('--from');
	if (from !== -1) {
		const path = process.argv[from + 1];
		if (!path || !existsSync(path)) {
			console.error('--from needs the JSON file wrangler wrote.');
			process.exit(1);
		}
		// wrangler prints [{ results: [...] }]; a bare list of rows is accepted too.
		// PowerShell may have put a byte-order mark in front.
		const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
		const rows = Array.isArray(parsed) && parsed[0]?.results ? parsed[0].results : parsed;
		return (rows as Suggestion[]).filter((row) => row.status === 'accepted');
	}
	if (!existsSync('reports.db')) return [];
	const db = new DatabaseSync('reports.db', { readOnly: true });
	const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'suggestions'").get();
	if (!has) return [];
	return db.prepare("SELECT * FROM suggestions WHERE status = 'accepted' ORDER BY id").all() as unknown as Suggestion[];
}

// Text from strangers, printed in a terminal: no escape sequences (see scripts/reports.ts).
const accepted = load().map(
	(row) =>
		Object.fromEntries(
			Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? stripControls(v) : v])
		) as unknown as Suggestion
);

if (!accepted.length) {
	console.error('No accepted suggestions.');
	process.exit(0);
}

const check = process.argv.indexOf('--check');
if (check !== -1) {
	const path = process.argv[check + 1];
	if (!path || !existsSync(path)) {
		console.error('--check needs the dictionary database, for example nebokrai.db.');
		process.exit(1);
	}
	const dictionary = new DatabaseSync(path, { readOnly: true });
	const has = dictionary.prepare("SELECT 1 FROM search_keys WHERE key = ? AND kind = 'word' LIMIT 1");
	const arrived = accepted.filter((s) => s.target === 'new-word' && has.get(plain(s.word)));
	console.error(arrived.length
		? `${arrived.length} accepted new word(s) now in the dictionary, to mark as applied:
`
		: 'No accepted new word is in the dictionary yet.');
	for (const s of arrived) console.error(`#${s.id}  ${s.headword}`);
	process.exit(0);
}

const sentences = accepted.filter((s) => s.target === 'example');
const words = accepted.filter((s) => s.target === 'new-word');
const others = accepted.filter((s) => s.target !== 'example' && s.target !== 'new-word');

if (sentences.length) {
	console.error(`${sentences.length} line(s) for data/tatoeba-corrections.tsv:\n`);
	// Redirected output on Windows would otherwise be cp1252
	for (const s of sentences) {
		const row = correctionRow(s);
		if (row) process.stdout.write(Buffer.from(row + '\n', 'utf8'));
	}
	console.error();
}

if (others.length) {
	console.error(`${others.length} to fix on Wiktionary (no override file for these):\n`);
	for (const s of others) {
		const where = [
			s.target,
			s.sense_n !== null && `meaning ${s.sense_n}`,
			s.form_tags
		].filter(Boolean).join(', ');
		console.error(`#${s.id}  ${s.headword} (${s.pos})  ·  ${where}`);
		console.error(`    now:       ${s.current}${s.current_en ? `  /  ${s.current_en}` : ''}`);
		console.error(`    suggested: ${s.proposed}${s.proposed_en ? `  /  ${s.proposed_en}` : ''}`);
		if (s.note) console.error(`    why:       ${s.note.replace(/\n/g, '\n               ')}`);
		console.error();
	}
}

if (words.length) {
	console.error(`${words.length} new word(s), as drafts for Wiktionary:
`);
	for (const s of words) {
		console.error(`#${s.id}  ${s.headword}${s.name ? `  (from ${s.name})` : ''}
`);
		console.error(wiktionaryDraft(s));
		console.error();
	}
}
