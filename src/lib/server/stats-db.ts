// Where the visit and search counts are kept (the tables are in stats.ts).
//
// Production: the Cloudflare D1 binding STATS. `npm run dev`: stats.db in the
// repo root (git-ignored, like every *.db), and only when STATS_IN_DEV is set,
// so building the site does not count as using it. With neither, nothing is
// counted and the site works as before.
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { STATS_IN_DEV } from '$app/env/private';
import { openLocalWritable } from './db.ts';
import { STATS_SCHEMA, type StatsDb } from './stats.ts';

// A flag, not a promise kept between requests: see user-db.ts for why.
let d1Ready = false;
let local: Promise<StatsDb> | undefined;

export async function getStatsDb(): Promise<StatsDb | undefined> {
	// `dev` first: see getDatabases() in db.ts.
	if (dev) return STATS_IN_DEV ? (local ??= openLocal()) : undefined;
	const d1 = env.STATS;
	if (!d1) return undefined;
	if (!d1Ready) {
		// A failure here leaves the flag unset, so the next request tries again
		for (const statement of STATS_SCHEMA) await d1.prepare(statement).run();
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

async function openLocal(): Promise<StatsDb> {
	const sqlite = await openLocalWritable('stats.db', STATS_SCHEMA.join(';\n'));
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			return sqlite.all<T>(sql, params);
		},
		async run(sql: string, params: unknown[] = []) {
			sqlite.run(sql, params);
		}
	};
}
