// GET /api/texts — see docs/api.md. Every story to read, with what the list
// shows and the words each is made of, so the page can say how much of each
// the visitor knows without asking again.
import { cached } from '#lib/server/cache.ts';
import { getDatabases } from '#lib/server/db.ts';
import { listTexts } from '#lib/texts.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
	cached(`${url.origin}/api/texts`, async () => {
		const { db } = await getDatabases();
		return Response.json({ texts: await listTexts(db) });
	});
