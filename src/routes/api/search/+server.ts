// GET /api/search?q=…&limit=… — see docs/api.md.
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { MAX_QUERY_LENGTH } from '#lib/limits.ts';
import { lookup } from '#lib/search/suggest.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const query = url.searchParams.get('q') ?? '';
	if (!query.trim()) return Response.json({ query, results: [], suggestions: [] });
	// The work grows with the query: one database query per English word, and
	// typo guesses that are quadratic in its length.
	if (query.length > MAX_QUERY_LENGTH) return Response.json({ error: 'query_too_long' }, { status: 400 });

	const asked = Number(url.searchParams.get('limit'));
	const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, 50) : 20;

	const key = `${url.origin}/api/search?${new URLSearchParams({ q: query, limit: String(limit) })}`;
	return cached(platform, key, async () => {
		const { db, vesum } = await getDatabases(platform);
		return Response.json(await lookup(db, query, { limit, vesum }));
	});
};
