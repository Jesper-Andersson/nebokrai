// GET /api/gloss?w=…&before=…&after=… — see docs/api.md.
import { glossFor, MAX_GLOSS_WORD } from '#lib/gloss.ts';
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const read = (name: string) => (url.searchParams.get(name) ?? '').trim();
	const word = read('w');
	const before = read('before');
	const after = read('after');
	if (!word) return Response.json({ phrase: null, readings: [] });
	if ([word, before, after].some((s) => s.length > MAX_GLOSS_WORD)) {
		return Response.json({ error: 'word_too_long' }, { status: 400 });
	}

	const params = new URLSearchParams({ w: word });
	if (before) params.set('before', before);
	if (after) params.set('after', after);
	return cached(`${url.origin}/api/gloss?${params}`, async () => {
		const { db, vesum } = await getDatabases();
		return Response.json(await glossFor(db, vesum, word, before || undefined, after || undefined));
	});
};
