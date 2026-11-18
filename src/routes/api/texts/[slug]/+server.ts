// GET /api/texts/<slug> — see docs/api.md. One story: its pages, sentences,
// recordings and credits.
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { textBySlug } from '#lib/texts.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const slug = params.slug;
	return cached(`${url.origin}/api/texts/${encodeURIComponent(slug)}`, async () => {
		const { db } = await getDatabases();
		const text = await textBySlug(db, slug);
		return text ? Response.json({ text }) : Response.json({ error: 'not_found', slug }, { status: 404 });
	});
};
