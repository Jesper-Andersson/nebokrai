// The search only needs one thing from a database: run a query, get rows back.
// Keeping that behind a tiny interface lets the same search code run on
// Cloudflare D1 in production and on a local SQLite file in tests.

export interface Db {
	all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** The part of Cloudflare's D1Database that we use. */
interface D1Like {
	prepare(sql: string): {
		bind(...params: unknown[]): { all<T>(): Promise<{ results: T[] }> };
	};
}

/** Wrap a Cloudflare D1 binding (`env.DB` from 'cloudflare:workers'). */
export function fromD1(d1: D1Like): Db {
	return {
		async all<T>(sql: string, params: unknown[] = []) {
			const { results } = await d1.prepare(sql).bind(...params).all<T>();
			return results;
		}
	};
}
