// Open a local SQLite file behind the same Db interface the site uses for D1.
import { DatabaseSync } from 'node:sqlite';
import type { Db } from '../src/lib/search/db.ts';
import { SCHEMA, type UserDb } from '../src/lib/server/users.ts';
import { STATS_SCHEMA, type StatsDb } from '../src/lib/server/stats.ts';

export function openLocal(path: string): Db & { rowsReturned: number; queries: number } {
	const sqlite = new DatabaseSync(path, { readOnly: true });
	return {
		rowsReturned: 0,
		queries: 0,
		async all<T>(sql: string, params: unknown[] = []) {
			const rows = sqlite.prepare(sql).all(...(params as any[])) as T[];
			this.queries += 1;
			this.rowsReturned += rows.length;
			return rows;
		}
	};
}

/** An empty in-memory user database (accounts, sessions, saved words). */
export function openMemoryUsers(): UserDb {
	const sqlite = new DatabaseSync(':memory:');
	for (const statement of SCHEMA) sqlite.exec(statement);
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			// node:sqlite rows have no prototype; copy them so deepEqual can compare with literals.
			return sqlite.prepare(sql).all(...(params as any[])).map((row) => ({ ...row })) as T[];
		},
		async run(sql: string, params: unknown[] = []) {
			sqlite.prepare(sql).run(...(params as any[]));
		}
	};
}

/** An empty in-memory statistics database (src/lib/server/stats.ts). */
export function openMemoryStats(): StatsDb {
	const sqlite = new DatabaseSync(':memory:');
	for (const statement of STATS_SCHEMA) sqlite.exec(statement);
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			return sqlite.prepare(sql).all(...(params as any[])).map((row) => ({ ...row })) as T[];
		},
		async run(sql: string, params: unknown[] = []) {
			sqlite.prepare(sql).run(...(params as any[]));
		}
	};
}
