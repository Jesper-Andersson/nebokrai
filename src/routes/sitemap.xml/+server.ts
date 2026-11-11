// GET /sitemap.xml: the address of every page, for search engines (see
// src/lib/seo.ts). static/robots.txt points at it. Kept in Cloudflare's cache
// like a search answer, so crawlers asking for it do not reach the database.
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { sitemap } from '#lib/seo.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
	cached(`${url.origin}/sitemap.xml`, async () => {
		const { db } = await getDatabases();
		return new Response(await sitemap(db, url.origin), {
			headers: { 'content-type': 'application/xml; charset=utf-8' }
		});
	});
