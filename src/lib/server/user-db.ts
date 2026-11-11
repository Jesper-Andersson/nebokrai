// Where accounts and saved words are kept (the tables are in users.ts).
//
// Production: the Cloudflare D1 binding USERS. `npm run dev`: users.db in the
// repo root (git-ignored, like every *.db). The tables are created on first use.
// With neither, there is no sign-in and the site saves words in the browser only.
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
export function hasUserDb(platform: App.Platform | undefined): boolean {
	return Boolean(platform?.env?.USERS) || dev;
}

let d1Ready: Promise<void> | undefined;
let local: Promise<UserDb> | undefined;

export async function getUserDb(platform: App.Platform | undefined): Promise<UserDb | undefined> {
	const d1 = platform?.env?.USERS;
	if (d1) {
		await (d1Ready ??= (async () => {
			for (const statement of SCHEMA) await d1.prepare(statement).run();
		})().catch((err) => {
			// Forget the failure, so the next request tries again instead of
			// failing for as long as this server instance lives.
			d1Ready = undefined;
			throw err;
		}));
		return {
			async all<T>(sql: string, params: unknown[] = []) {
				return (await d1.prepare(sql).bind(...params).all<T>()).results;
			},
			async run(sql: string, params: unknown[] = []) {
				await d1.prepare(sql).bind(...params).run();
			}
		};
	}
	if (dev) return (local ??= openLocal());
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
