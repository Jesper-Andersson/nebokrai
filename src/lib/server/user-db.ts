// Where accounts and saved words are kept (the tables are in users.ts).
//
// Production: the Cloudflare D1 binding USERS. `npm run dev`: users.db in the
// repo root (git-ignored, like every *.db). The tables are created on first use.
// With neither, there is no sign-in and the site saves words in the browser only.
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { openLocalWritable } from './db.ts';
import { SCHEMA, type UserDb } from './users.ts';

/** The part of Cloudflare's D1Database used here. */
export interface D1Users {
	prepare(sql: string): {
		bind(...params: unknown[]): { all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
		run(): Promise<unknown>;
	};
}

/** Whether accounts can work at all here, without opening anything. */
export function hasUserDb(): boolean {
	return dev || Boolean(env.USERS);
}

// A flag, never a promise kept between requests. On Workers a promise belongs
// to the request that made it: if that request ends before the tables are
// made (the visitor closes the tab), the promise never settles, and every
// later request that waits for it waits for ever. That left each signed-in
// visitor with a page that never loaded (seen 2026-11-14). The price is that
// two requests arriving together may both run the statements, which
// IF NOT EXISTS makes harmless.
let d1Ready = false;
let local: Promise<UserDb> | undefined;

export async function getUserDb(): Promise<UserDb | undefined> {
	// `dev` first: see getDatabases() in db.ts.
	if (dev) return (local ??= openLocal());
	const d1 = env.USERS;
	if (d1) {
		if (!d1Ready) {
			// A failure here leaves the flag unset, so the next request tries again
			for (const statement of SCHEMA) await d1.prepare(statement).run();
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
	return undefined;
}

async function openLocal(): Promise<UserDb> {
	const sqlite = await openLocalWritable('users.db', SCHEMA.join(';\n'));
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			return sqlite.all<T>(sql, params);
		},
		async run(sql: string, params: unknown[] = []) {
			sqlite.run(sql, params);
		}
	};
}
