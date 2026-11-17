// Where readers' suggestions are kept (the table is in suggestions.ts): beside
// the reports, in the private REPORTS database.
//
// Production: the Cloudflare D1 binding REPORTS. `npm run dev`: reports.db in
// the repo root. The table is created on first use. To read them: the owner's
// page /review, or `npm run suggestions`.
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { openLocalWritable } from './db.ts';
import { SUGGESTIONS_SCHEMA, type SuggestionDb } from './suggestions.ts';

// A flag, not a promise kept between requests: see user-db.ts.
let d1Ready = false;
let local: Promise<SuggestionDb> | undefined;

export async function getSuggestionDb(): Promise<SuggestionDb> {
	// `dev` first: see getDatabases() in db.ts.
	if (dev) return (local ??= openLocal());
	const d1 = env.REPORTS;
	if (!d1) throw new Error('No reports database: wrangler.jsonc must bind REPORTS.');
	if (!d1Ready) {
		// A failure here leaves the flag unset, so the next request tries again
		for (const statement of SUGGESTIONS_SCHEMA) await d1.prepare(statement).run();
		d1Ready = true;
	}
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			return (await d1.prepare(sql).bind(...params).all<T>()).results;
		},
		async run(sql: string, params: unknown[] = []) {
			await d1.prepare(sql).bind(...params).run();
		}
	};
}

async function openLocal(): Promise<SuggestionDb> {
	const sqlite = await openLocalWritable('reports.db', SUGGESTIONS_SCHEMA.join(';\n'));
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			return sqlite.all<T>(sql, params);
		},
		async run(sql: string, params: unknown[] = []) {
			sqlite.run(sql, params);
		}
	};
}
