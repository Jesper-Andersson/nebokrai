// Where the search gets its data. In production that is Cloudflare D1
// (platform.env.DB, and platform.env.VESUM if bound). During `npm run dev` it
// is the local nebokrai.db and vesum.db in the repo root (see data/README.md).
import { dev } from '$app/env';
import { fromD1, type Db } from '#lib/search/db.ts';

export interface Databases {
	db: Db;
	vesum?: Db;
}

let local: Promise<Databases> | undefined;

export async function getDatabases(platform: App.Platform | undefined): Promise<Databases> {
	const env = platform?.env;
	if (env?.DB) return { db: fromD1(env.DB), vesum: env.VESUM ? fromD1(env.VESUM) : undefined };
	if (dev) return (local ??= openLocalFiles());
	throw new Error('No database: bind DB (and optionally VESUM) to the Cloudflare worker.');
}

async function openLocalFiles(): Promise<Databases> {
	const { existsSync } = await import('node:fs');
	const { DatabaseSync } = await import('node:sqlite');
	const open = (path: string): Db => {
		const sqlite = new DatabaseSync(path, { readOnly: true });
		return {
			async all<T>(sql: string, params: unknown[] = []) {
				return sqlite.prepare(sql).all(...(params as never[])) as T[];
			}
		};
	};
	if (!existsSync('nebokrai.db')) {
		throw new Error('nebokrai.db not found in the repo root. Build it with data/README.md.');
	}
	return { db: open('nebokrai.db'), vesum: existsSync('vesum.db') ? open('vesum.db') : undefined };
}

/** A local SQLite file you can write to (`npm run dev` only), e.g. reports.db. */
export interface LocalWritable {
	run(sql: string, params?: unknown[]): { lastInsertRowid: number | bigint };
	all<T>(sql: string, params?: unknown[]): T[];
}

/** Open (or create) a writable local database and run `schema` on it once. */
export async function openLocalWritable(path: string, schema: string): Promise<LocalWritable> {
	if (!dev) throw new Error(`Local database ${path} is only available during development.`);
	const { DatabaseSync } = await import('node:sqlite');
	const sqlite = new DatabaseSync(path);
	sqlite.exec(schema);
	return {
		run(sql, params = []) {
			return sqlite.prepare(sql).run(...(params as never[]));
		},
		all<T>(sql: string, params: unknown[] = []) {
			return sqlite.prepare(sql).all(...(params as never[])) as T[];
		}
	};
}
