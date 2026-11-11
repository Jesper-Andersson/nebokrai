// Open a local SQLite file behind the same Db interface the site uses for D1.
import { DatabaseSync } from 'node:sqlite';
import type { Db } from '../src/lib/search/db.ts';

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
