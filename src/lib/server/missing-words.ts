// Words that imports found in no dictionary entry, kept for adding to the
// dictionary later (POST /api/words/missing, src/lib/import/missing.ts).
//
// They live beside the reports, in the private REPORTS database, never in
// nebokrai.db: that one is rebuilt from open data, and this list must survive
// rebuilds. One row per word, counting how many imports named it, so the words
// most worth adding come first. Nothing about the sender is stored.
//
// Production: the D1 binding REPORTS. `npm run dev`: reports.db in the repo
// root. The table is made on first use. To read them in production:
// wrangler d1 execute <reports database> --remote --command
//   "SELECT word, times, last_seen FROM missing_words WHERE status = 'new' ORDER BY times DESC LIMIT 50"
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { openLocalWritable, type LocalWritable } from './db.ts';

// status: new → added | not_a_word
const SCHEMA = `CREATE TABLE IF NOT EXISTS missing_words (
	word TEXT PRIMARY KEY,
	times INTEGER NOT NULL DEFAULT 1,
	first_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
	last_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
	status TEXT NOT NULL DEFAULT 'new'
)`;

// The words go in as one JSON parameter: D1 binds at most 100. `WHERE true`
// tells SQLite the ON CONFLICT belongs to the INSERT, not to the SELECT.
const UPSERT = `INSERT INTO missing_words (word) SELECT value FROM json_each(?) WHERE true
	ON CONFLICT (word) DO UPDATE SET times = times + 1, last_seen = excluded.last_seen`;

// A flag, not a promise kept between requests: see user-db.ts.
let d1Ready = false;
let local: Promise<LocalWritable> | undefined;

/** Count one more import naming each of `words`. */
export async function saveMissing(words: string[]): Promise<void> {
	if (!words.length) return;
	const param = JSON.stringify(words);
	// `dev` first: see getDatabases() in db.ts.
	if (dev) {
		const sqlite = await (local ??= openLocalWritable('reports.db', SCHEMA));
		sqlite.run(UPSERT, [param]);
		return;
	}
	const d1 = env.REPORTS;
	if (!d1) throw new Error('No reports database: wrangler.jsonc must bind REPORTS.');
	if (!d1Ready) {
		await d1.prepare(SCHEMA).run();
		d1Ready = true;
	}
	await d1.prepare(UPSERT).bind(param).run();
}
